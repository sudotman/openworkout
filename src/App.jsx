import { Check, Trash2 } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { FeatureLoader, MobileNav, MobileTopBar, Sidebar } from './components/AppChrome.jsx'
import {
  BaseWeightSheet,
  CustomExerciseSheet,
  ExerciseActionsSheet,
  ExerciseDetail,
  ExercisePicker,
  SessionMenuSheet,
} from './components/sheets/ExerciseSheets.jsx'
import { SettingsSheet } from './components/sheets/SettingsSheet.jsx'
import { ConfirmSheet, Sheet } from './components/sheets/Sheet.jsx'
import { FinishWorkoutSheet, WorkoutDaySheet, WorkoutDetail } from './components/sheets/WorkoutSheets.jsx'
import { exercises } from './data/exercises.js'
import { getTheme, isDarkTheme } from './data/themes.js'
import {
  loadProgressPhotos,
  loadProgressPlus,
  NutritionView,
  RoutinesView,
  SetOptions,
  WorkoutShareCard,
  WorkoutTools,
} from './features.js'
import {
  formatLoad,
  normalizeBaseWeight,
  totalWeight,
} from './lib/base-weight.js'
import { getCardioSummary, isCardioExercise } from './lib/cardio.js'
import { exportWorkoutsCsv } from './lib/csv.js'
import { MOTION } from './lib/motion.js'
import {
  clearPhotos,
  deletePhoto,
  loadAllPhotos,
  putPhoto,
  requestPersistentStorage,
} from './lib/photo-store.js'
import { suggestNextLoad } from './lib/progression.js'
import {
  clearAppState,
  exportAppState,
  importAppState,
  loadAppState,
  saveAppState,
} from './lib/storage.js'
import { playTimerSound } from './lib/timer-sound.js'
import {
  calculateElapsed,
  convertStateUnits,
  createInitialState,
  createWorkoutSet,
  getPersonalRecords,
  getPreviousExercise,
  getTrackingType,
  insertAt,
  normalizeState,
  routineDataFromWorkout,
  sortWorkouts,
  uid,
  workoutExerciseIds,
} from './lib/workout.js'
import { HistoryView } from './views/HistoryView.jsx'
import { LibraryView } from './views/LibraryView.jsx'
import { LiveWorkout, RestTimer } from './views/LiveWorkout.jsx'
import { ProgressView } from './views/ProgressView.jsx'
import { TrainView } from './views/TrainView.jsx'

function App() {
  const [appState, setAppState] = useState(() => normalizeState(loadAppState(createInitialState())))
  const [view, setView] = useState('train')
  const [sheet, setSheet] = useState(null)
  // { id, message, undo? } — a toast with undo stays up long enough to reach it.
  const [toast, setToast] = useState(null)
  const [now, setNow] = useState(Date.now())
  const [installPrompt, setInstallPrompt] = useState(null)
  // Photo images by id, mirrored from IndexedDB. 'unavailable' falls back to
  // keeping images inline in the app state, as before.
  const [photoData, setPhotoData] = useState(() => new Map())
  const [photoStore, setPhotoStore] = useState('loading')
  const importInputRef = useRef(null)
  const wakeLockRef = useRef(null)

  const activeWorkout = appState.activeWorkout
  const allExercises = useMemo(
    () => [...exercises, ...(appState.customExercises || [])],
    [appState.customExercises],
  )
  const exerciseMap = useMemo(
    () => new Map(allExercises.map((exercise) => [exercise.id, exercise])),
    [allExercises],
  )
  const elapsedSeconds = calculateElapsed(activeWorkout, now)
  const restTimer = appState.restTimer
  const restRemaining = restTimer ? Math.max(0, Math.ceil((restTimer.endsAt - now) / 1000)) : null
  const latestWeightKg = useMemo(() => {
    const measurement = appState.measurements
      .filter((entry) => Number(entry.weight) > 0)
      .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime())[0]
    if (!measurement) return null
    const value = Number(measurement.weight)
    return Math.round((appState.settings.unit === 'lb' ? value / 2.2046226218 : value) * 10) / 10
  }, [appState.measurements, appState.settings.unit])

  // localStorage is the only copy of everything, so a failed write (usually a
  // full quota) has to be said out loud — once per failure streak, not per keystroke.
  const saveFailedRef = useRef(false)
  useEffect(() => {
    const saved = saveAppState(appState)
    if (!saved && !saveFailedRef.current) {
      notify('Could not save on this device — storage may be full. Export a backup.')
    }
    saveFailedRef.current = !saved
  }, [appState])

  useEffect(() => {
    const theme = getTheme(appState.settings.theme)
    document.documentElement.dataset.theme = theme.id
    document.documentElement.style.colorScheme = isDarkTheme(theme.id) ? 'dark' : 'light'
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.browserColor)
  }, [appState.settings.theme])

  useEffect(() => {
    let cancelled = false
    loadAllPhotos()
      .then((stored) => {
        if (cancelled) return
        setPhotoData((current) => new Map([...stored, ...current]))
        setPhotoStore('ready')
      })
      .catch(() => {
        if (!cancelled) setPhotoStore('unavailable')
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Images still inline in the state — saves from before IndexedDB, or an
  // imported backup — move into the photo store, and only leave the state
  // once they're safely written there.
  useEffect(() => {
    if (photoStore !== 'ready') return
    const inline = appState.progressPhotos.filter((photo) => photo?.id && photo.dataUrl)
    if (!inline.length) return
    Promise.all(inline.map((photo) => putPhoto(photo.id, photo.dataUrl)))
      .then(() => {
        setPhotoData((current) => {
          const next = new Map(current)
          inline.forEach((photo) => next.set(photo.id, photo.dataUrl))
          return next
        })
        const moved = new Set(inline.map((photo) => photo.id))
        setAppState((state) => ({
          ...state,
          progressPhotos: state.progressPhotos.map((photo) => {
            if (!moved.has(photo?.id)) return photo
            const { dataUrl: _moved, ...meta } = photo
            return meta
          }),
        }))
      })
      .catch(() => {
        // Left inline; the next change to the photo list tries again.
      })
  }, [photoStore, appState.progressPhotos])

  const progressPhotos = useMemo(
    () =>
      appState.progressPhotos.map((photo) =>
        photo?.dataUrl || !photoData.has(photo?.id) ? photo : { ...photo, dataUrl: photoData.get(photo.id) },
      ),
    [appState.progressPhotos, photoData],
  )

  useEffect(() => {
    const captureInstallPrompt = (event) => {
      event.preventDefault()
      setInstallPrompt(event)
    }
    window.addEventListener('beforeinstallprompt', captureInstallPrompt)
    return () => window.removeEventListener('beforeinstallprompt', captureInstallPrompt)
  }, [])

  useEffect(() => {
    if (!activeWorkout) return undefined
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [activeWorkout])

  useEffect(() => {
    let cancelled = false
    const requestWakeLock = async () => {
      if (!activeWorkout || !appState.settings.keepAwake || !('wakeLock' in navigator) || document.visibilityState !== 'visible') {
        return
      }
      try {
        const lock = await navigator.wakeLock.request('screen')
        if (cancelled) {
          lock.release()
          return
        }
        wakeLockRef.current = lock
      } catch {
        wakeLockRef.current = null
      }
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && !wakeLockRef.current) requestWakeLock()
    }
    requestWakeLock()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
      wakeLockRef.current?.release?.()
      wakeLockRef.current = null
    }
  }, [Boolean(activeWorkout), appState.settings.keepAwake])

  // The rest timer is a deadline rather than a countdown, so it keeps true time
  // while the phone is locked or the tab is throttled, and survives a reload.
  const restEndsAt = restTimer?.endsAt
  useEffect(() => {
    if (!restEndsAt) return undefined
    const clear = () =>
      setAppState((state) => (state.restTimer?.endsAt === restEndsAt ? { ...state, restTimer: null } : state))
    const overdue = Date.now() - restEndsAt
    // Long past (the app was closed through it): end quietly rather than beep on open.
    if (overdue > 5000) {
      clear()
      return undefined
    }
    const timer = window.setTimeout(() => {
      window.navigator?.vibrate?.([80, 50, 80])
      if (appState.settings.timerSound) playTimerSound()
      clear()
    }, Math.max(0, -overdue))
    return () => window.clearTimeout(timer)
  }, [restEndsAt, appState.settings.timerSound])

  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(() => setToast(null), toast.undo ? 5000 : 2600)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    document.body.classList.toggle('sheet-open', Boolean(sheet))
    return () => document.body.classList.remove('sheet-open')
  }, [sheet])

  // Destructive actions act at once and offer an undo, rather than asking
  // first: a mis-tap costs one tap to reverse instead of a dialog every time.
  const notify = (message, undo) => {
    setToast(null)
    window.setTimeout(() => setToast({ id: Date.now(), message, undo }), 10)
  }

  const navigate = (nextView) => {
    if (nextView === 'progress') {
      void loadProgressPlus()
      void loadProgressPhotos()
    }
    setView(nextView)
    setSheet(null)
    window.scrollTo({ top: 0, behavior: 'auto' })
    document.querySelector('.app-main')?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Sets start from last session's numbers, or from a suggested step up when
  // every set last time reached the top of the rep range.
  const createWorkoutExercise = (exerciseId, prescription, setCount) => {
    const exercise = exerciseMap.get(exerciseId)
    const cardio = isCardioExercise(exercise)
    const lastEntry = getPreviousExercise(appState.workouts, exerciseId)
    const previous = lastEntry?.sets?.filter((set) => set.completed).at(-1) || null
    const suggestion = !cardio && getTrackingType(exercise) === 'weight-reps'
      ? suggestNextLoad({
          previousSets: lastEntry?.sets,
          minReps: prescription?.minReps,
          maxReps: prescription?.maxReps,
          equipment: exercise?.equipment,
          unit: appState.settings.unit,
        })
      : null
    const progression = suggestion && { ...suggestion, fromReps: Number(previous?.reps) || suggestion.topReps }
    return {
      id: uid('we'),
      exerciseId,
      notes: '',
      restSeconds: prescription?.restSeconds,
      targetMinReps: prescription?.minReps,
      targetMaxReps: prescription?.maxReps,
      baseWeight: appState.exerciseSettings?.[exerciseId]?.baseWeight || 0,
      progression: progression || undefined,
      sets: Array.from({ length: setCount || prescription?.sets || (cardio ? 1 : 3) }, () => {
        const set = createWorkoutSet(previous)
        return progression ? { ...set, weight: progression.weight, reps: progression.reps } : set
      }),
    }
  }

  const startWorkout = (template) => {
    const chosen = template?.exerciseIds || []
    const sourceRoutineId = template?.sourceRoutineId || (
      template?.id && appState.routines.some((routine) => routine.id === template.id)
        ? template.id
        : null
    )
    const workout = {
      id: uid('workout'),
      name: template?.name || 'Open workout',
      sourceRoutineId,
      startedAt: new Date().toISOString(),
      completedAt: null,
      durationSeconds: 0,
      pausedAt: null,
      pausedDurationSeconds: 0,
      exercises: chosen.map((exerciseId) =>
        createWorkoutExercise(exerciseId, template?.prescriptions?.[exerciseId]),
      ),
    }

    setNow(Date.now())
    setAppState((state) => ({ ...state, activeWorkout: workout }))
    setView('train')
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'auto' })
      document.querySelector('.app-main')?.scrollTo({ top: 0, behavior: 'auto' })
    })
    notify('Workout started')
  }

  const updateActiveWorkout = (updater) => {
    setAppState((state) => {
      if (!state.activeWorkout) return state
      const nextWorkout = typeof updater === 'function' ? updater(state.activeWorkout) : updater
      return { ...state, activeWorkout: nextWorkout }
    })
  }

  const toggleWorkoutTimer = () => {
    updateActiveWorkout((workout) => {
      if (workout.pausedAt) {
        const pauseLength = Math.max(0, (Date.now() - new Date(workout.pausedAt).getTime()) / 1000)
        return {
          ...workout,
          pausedAt: null,
          pausedDurationSeconds: Number(workout.pausedDurationSeconds || 0) + pauseLength,
        }
      }
      return { ...workout, pausedAt: new Date().toISOString() }
    })
    setNow(Date.now())
  }

  const addExercise = (exerciseId) => {
    updateActiveWorkout((workout) => {
      if (workout.exercises.some((item) => item.exerciseId === exerciseId)) return workout
      return {
        ...workout,
        exercises: [...workout.exercises, createWorkoutExercise(exerciseId, null, 1)],
      }
    })
    setSheet(null)
    notify('Exercise added')
  }

  const updateSet = (workoutExerciseId, setId, field, value) => {
    const normalized = value === '' ? '' : Number(value)
    updateActiveWorkout((workout) => ({
      ...workout,
      exercises: workout.exercises.map((item) =>
        item.id === workoutExerciseId
          ? {
              ...item,
              sets: item.sets.map((set) => (set.id === setId ? { ...set, [field]: normalized } : set)),
            }
          : item,
      ),
    }))
  }

  // The input holds what goes on the bar; the set stores the total, so volume,
  // records, and exports stay comparable across exercises with and without a
  // base weight.
  const updateWeight = (workoutExerciseId, setId, value) => {
    updateActiveWorkout((workout) => ({
      ...workout,
      exercises: workout.exercises.map((item) =>
        item.id === workoutExerciseId
          ? {
              ...item,
              sets: item.sets.map((set) =>
                set.id === setId
                  ? { ...set, weight: totalWeight(value === '' ? '' : Number(value), normalizeBaseWeight(item.baseWeight)) }
                  : set,
              ),
            }
          : item,
      ),
    }))
  }

  const toggleSet = (workoutExerciseId, setId) => {
    const item = activeWorkout?.exercises.find((exercise) => exercise.id === workoutExerciseId)
    const targetSet = item?.sets.find((set) => set.id === setId)
    const willComplete = !targetSet?.completed

    updateActiveWorkout((workout) => ({
      ...workout,
      exercises: workout.exercises.map((exercise) =>
        exercise.id === workoutExerciseId
          ? {
              ...exercise,
              sets: exercise.sets.map((set) =>
                set.id === setId ? { ...set, completed: !set.completed } : set,
              ),
            }
          : exercise,
      ),
    }))

    if (willComplete) {
      if (!isCardioExercise(exerciseMap.get(item?.exerciseId))) {
        startRest(item?.restSeconds || appState.settings.restSeconds)
      }
      window.navigator?.vibrate?.(35)
      const weight = Number(targetSet?.weight) || 0
      const reps = Number(targetSet?.reps) || 0
      if (weight > 0 && reps > 0) {
        const estimate = Math.round(weight * (1 + reps / 30) * 10) / 10
        // Earlier sets from this session count too, so a record is announced
        // once rather than on every set that beats last week.
        const sessionSoFar = {
          exercises: activeWorkout.exercises.map((exercise) => ({
            ...exercise,
            sets: exercise.sets.filter((set) => set.id !== setId),
          })),
        }
        const previousBest = getPersonalRecords([sessionSoFar, ...appState.workouts])
          .find((record) => record.exerciseId === item?.exerciseId)?.estimate || 0
        // A first log is a baseline, not a record worth interrupting a set for.
        if (previousBest && estimate > previousBest) {
          notify('New personal record · ' + estimate + ' ' + appState.settings.unit + ' e1RM')
        }
      }
      if (item?.supersetId) {
        const partner = activeWorkout.exercises.find(
          (exercise) => exercise.supersetId === item.supersetId && exercise.id !== item.id,
        )
        const targetIndex = item.sets.findIndex((set) => set.id === setId)
        const nextSet = partner?.sets?.[targetIndex] || partner?.sets?.find((set) => !set.completed)
        if (nextSet) {
          window.setTimeout(() => {
            document.querySelector('[data-set-id="' + nextSet.id + '"]')?.scrollIntoView({
              behavior: 'smooth',
              block: 'center',
            })
          }, 180)
        }
      }
    }
  }

  const startRest = (seconds) => {
    const total = Math.max(1, Number(seconds) || 90)
    const startedAt = Date.now()
    setNow(startedAt)
    setAppState((state) => ({ ...state, restTimer: { endsAt: startedAt + total * 1000, total } }))
  }

  const adjustRest = (deltaSeconds) => {
    const at = Date.now()
    setNow(at)
    setAppState((state) => {
      if (!state.restTimer) return state
      const remaining = Math.max(0, Math.ceil((state.restTimer.endsAt - at) / 1000)) + deltaSeconds
      // Taking it down to nothing means the rest is over: no alarm for that.
      if (remaining <= 0) return { ...state, restTimer: null }
      return {
        ...state,
        restTimer: {
          endsAt: at + remaining * 1000,
          total: Math.max(state.restTimer.total, remaining),
        },
      }
    })
  }

  const skipRest = () => setAppState((state) => ({ ...state, restTimer: null }))

  // Back to last session's numbers on every set not yet done.
  const keepPreviousLoad = (workoutExerciseId) => {
    updateActiveWorkout((workout) => ({
      ...workout,
      exercises: workout.exercises.map((exercise) => {
        if (exercise.id !== workoutExerciseId || !exercise.progression) return exercise
        const { fromWeight, fromReps } = exercise.progression
        return {
          ...exercise,
          progression: undefined,
          sets: exercise.sets.map((set) => (set.completed ? set : { ...set, weight: fromWeight, reps: fromReps })),
        }
      }),
    }))
  }

  const changeSetType = (workoutExerciseId, setId, type) => {
    updateActiveWorkout((workout) => ({
      ...workout,
      exercises: workout.exercises.map((exercise) =>
        exercise.id === workoutExerciseId
          ? {
              ...exercise,
              sets: exercise.sets.map((set) => (set.id === setId ? { ...set, type } : set)),
            }
          : exercise,
      ),
    }))
    setSheet(null)
  }

  const addSet = (workoutExerciseId) => {
    updateActiveWorkout((workout) => ({
      ...workout,
      exercises: workout.exercises.map((exercise) => {
        if (exercise.id !== workoutExerciseId) return exercise
        const previous = exercise.sets.at(-1)
        return {
          ...exercise,
          sets: [
            ...exercise.sets,
            { ...createWorkoutSet(previous), type: previous?.type || 'normal' },
          ],
        }
      }),
    }))
  }

  const removeSet = (workoutExerciseId, setId) => {
    const owner = activeWorkout?.exercises.find((exercise) => exercise.id === workoutExerciseId)
    const index = owner?.sets.findIndex((set) => set.id === setId) ?? -1
    const removed = owner?.sets[index]
    updateActiveWorkout((workout) => ({
      ...workout,
      exercises: workout.exercises.map((exercise) =>
        exercise.id === workoutExerciseId
          ? { ...exercise, sets: exercise.sets.filter((set) => set.id !== setId) }
          : exercise,
      ),
    }))
    if (!removed) return
    notify('Set ' + (index + 1) + ' removed', () =>
      updateActiveWorkout((workout) => ({
        ...workout,
        exercises: workout.exercises.map((exercise) =>
          exercise.id === workoutExerciseId && !exercise.sets.some((set) => set.id === setId)
            ? { ...exercise, sets: insertAt(exercise.sets, index, removed) }
            : exercise,
        ),
      })),
    )
  }

  const removeExercise = (workoutExerciseId) => {
    const index = activeWorkout?.exercises.findIndex((exercise) => exercise.id === workoutExerciseId) ?? -1
    const removed = activeWorkout?.exercises[index]
    updateActiveWorkout((workout) => ({
      ...workout,
      exercises: workout.exercises.filter((exercise) => exercise.id !== workoutExerciseId),
    }))
    setSheet(null)
    notify('Exercise removed', removed && (() =>
      updateActiveWorkout((workout) =>
        workout.exercises.some((exercise) => exercise.id === workoutExerciseId)
          ? workout
          : { ...workout, exercises: insertAt(workout.exercises, index, removed) },
      )
    ))
  }

  const moveExercise = (workoutExerciseId, direction) => {
    updateActiveWorkout((workout) => {
      const index = workout.exercises.findIndex((exercise) => exercise.id === workoutExerciseId)
      const target = index + direction
      if (index < 0 || target < 0 || target >= workout.exercises.length) return workout
      const next = [...workout.exercises]
      const [moved] = next.splice(index, 1)
      next.splice(target, 0, moved)
      return { ...workout, exercises: next }
    })
    setSheet(null)
  }

  const toggleSuperset = (workoutExerciseId) => {
    updateActiveWorkout((workout) => {
      const index = workout.exercises.findIndex((exercise) => exercise.id === workoutExerciseId)
      if (index < 0) return workout
      const current = workout.exercises[index]
      if (current.supersetId) {
        return {
          ...workout,
          exercises: workout.exercises.map((exercise) =>
            exercise.supersetId === current.supersetId ? { ...exercise, supersetId: null } : exercise,
          ),
        }
      }
      const partnerIndex = index < workout.exercises.length - 1 ? index + 1 : index - 1
      if (partnerIndex < 0) return workout
      const groupId = uid('superset')
      return {
        ...workout,
        exercises: workout.exercises.map((exercise, exerciseIndex) =>
          exerciseIndex === index || exerciseIndex === partnerIndex
            ? { ...exercise, supersetId: groupId }
            : exercise,
        ),
      }
    })
    setSheet(null)
    notify('Superset updated')
  }

  const setExerciseRest = (workoutExerciseId, seconds) => {
    updateActiveWorkout((workout) => ({
      ...workout,
      exercises: workout.exercises.map((exercise) =>
        exercise.id === workoutExerciseId ? { ...exercise, restSeconds: seconds } : exercise,
      ),
    }))
    notify('Exercise rest set to ' + seconds + ' seconds')
  }

  // Remembered per exercise, so a bar only has to be declared once. Weights
  // already logged keep their total — only the number in the input changes.
  const setExerciseBaseWeight = (workoutExerciseId, value) => {
    const baseWeight = normalizeBaseWeight(value)
    setAppState((state) => {
      const item = state.activeWorkout?.exercises.find((exercise) => exercise.id === workoutExerciseId)
      if (!item) return state
      const exerciseSettings = { ...state.exerciseSettings }
      if (baseWeight) {
        exerciseSettings[item.exerciseId] = { ...exerciseSettings[item.exerciseId], baseWeight }
      } else {
        delete exerciseSettings[item.exerciseId]
      }
      return {
        ...state,
        exerciseSettings,
        activeWorkout: {
          ...state.activeWorkout,
          exercises: state.activeWorkout.exercises.map((exercise) =>
            exercise.id === workoutExerciseId ? { ...exercise, baseWeight } : exercise,
          ),
        },
      }
    })
    setSheet(null)
    const exerciseId = activeWorkout?.exercises.find((item) => item.id === workoutExerciseId)?.exerciseId
    const name = exerciseMap.get(exerciseId)?.name || 'this exercise'
    notify(
      baseWeight
        ? name + ' starts at ' + formatLoad(baseWeight) + ' ' + appState.settings.unit
        : 'Base weight cleared for ' + name,
    )
  }

  const finishWorkout = (routineAction = 'none') => {
    if (!activeWorkout) return
    void requestPersistentStorage()
    const newRoutineId = routineAction === 'create' ? uid('routine') : null
    const cardio = getCardioSummary(activeWorkout, exerciseMap)
    const recordedDuration = Math.max(elapsedSeconds, cardio.totalDurationSeconds || 0)
    const finished = {
      ...activeWorkout,
      exercises: activeWorkout.exercises.map(({ progression: _suggestion, ...item }) => item),
      sourceRoutineId: newRoutineId || activeWorkout.sourceRoutineId || null,
      completedAt: new Date().toISOString(),
      durationSeconds: recordedDuration,
    }
    setAppState((state) => {
      // A second tap that lands before the sheet closes must not log it twice.
      if (state.activeWorkout?.id !== activeWorkout.id) return state
      const sourceRoutine = state.routines.find((routine) => routine.id === activeWorkout.sourceRoutineId)
      let routines = state.routines

      if (routineAction === 'update' && sourceRoutine) {
        const routineData = routineDataFromWorkout(finished, sourceRoutine)
        routines = state.routines.map((routine) =>
          routine.id === sourceRoutine.id ? { ...routine, ...routineData } : routine,
        )
      } else if (routineAction === 'create' && newRoutineId) {
        routines = [
          ...state.routines,
          { ...routineDataFromWorkout(finished, sourceRoutine), id: newRoutineId },
        ]
      }

      return {
        ...state,
        routines,
        activeWorkout: null,
        restTimer: null,
        hasStarterData: false,
        workouts: [finished, ...state.workouts.filter((workout) => !workout.isSample)],
        measurements: state.measurements.filter((entry) => !entry.isSample),
        nutrition: state.hasStarterData
          ? { ...state.nutrition, entries: state.nutrition.entries.filter((entry) => !entry.isSample) }
          : state.nutrition,
      }
    })
    setSheet({ type: 'share', workout: finished })
    setView('history')
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'auto' }))
    notify(
      routineAction === 'update'
        ? 'Workout saved and routine updated'
        : routineAction === 'create'
          ? 'Workout and new routine saved'
          : 'Workout saved on this device',
    )
  }

  const discardWorkout = () => {
    const discarded = activeWorkout
    setAppState((state) => ({ ...state, activeWorkout: null, restTimer: null }))
    setSheet(null)
    notify('Workout discarded', discarded && (() => {
      setAppState((state) => (state.activeWorkout ? state : { ...state, activeWorkout: discarded }))
      setView('train')
    }))
  }

  const createRoutine = (data) => {
    setAppState((state) => ({
      ...state,
      routines: [...state.routines, { ...data, id: uid('routine') }],
    }))
    notify('Routine saved')
  }

  const updateRoutine = (id, data) => {
    setAppState((state) => ({
      ...state,
      routines: state.routines.map((routine) => (routine.id === id ? { ...routine, ...data } : routine)),
    }))
    notify('Routine updated')
  }

  const duplicateRoutine = (id) => {
    setAppState((state) => {
      const source = state.routines.find((routine) => routine.id === id)
      if (!source) return state
      return {
        ...state,
        routines: [...state.routines, { ...source, id: uid('routine'), name: source.name + ' copy' }],
      }
    })
    notify('Routine duplicated')
  }

  const deleteRoutine = (id) => {
    const index = appState.routines.findIndex((routine) => routine.id === id)
    const removed = appState.routines[index]
    setAppState((state) => ({
      ...state,
      routines: state.routines.filter((routine) => routine.id !== id),
    }))
    notify('Routine deleted', removed && (() =>
      setAppState((state) =>
        state.routines.some((routine) => routine.id === id)
          ? state
          : { ...state, routines: insertAt(state.routines, index, removed) },
      )
    ))
  }

  const addMeasurement = (entry) => {
    setAppState((state) => ({
      ...state,
      measurements: [{ ...entry, id: uid('measure') }, ...state.measurements],
      nutrition: Number(entry.weight) > 0
        ? {
            ...state.nutrition,
            profile: {
              ...state.nutrition.profile,
              weightKg: Math.round((state.settings.unit === 'lb' ? Number(entry.weight) / 2.2046226218 : Number(entry.weight)) * 10) / 10,
            },
          }
        : state.nutrition,
    }))
    notify('Measurement saved')
  }

  const updateNutrition = (updater) => {
    setAppState((state) => ({
      ...state,
      nutrition: typeof updater === 'function' ? updater(state.nutrition) : updater,
    }))
  }

  const deleteMeasurement = (id) => {
    const index = appState.measurements.findIndex((entry) => entry.id === id)
    const removed = appState.measurements[index]
    setAppState((state) => ({
      ...state,
      measurements: state.measurements.filter((entry) => entry.id !== id),
    }))
    notify('Measurement removed', removed && (() =>
      setAppState((state) =>
        state.measurements.some((entry) => entry.id === id)
          ? state
          : { ...state, measurements: insertAt(state.measurements, index, removed) },
      )
    ))
  }

  const addProgressPhoto = async (photo) => {
    const id = photo.id || uid('photo')
    void requestPersistentStorage()
    if (photoStore === 'ready') {
      try {
        await putPhoto(id, photo.dataUrl)
      } catch {
        notify('Could not save the photo — this device may be out of space.')
        return
      }
      setPhotoData((current) => new Map(current).set(id, photo.dataUrl))
      setAppState((state) => ({
        ...state,
        progressPhotos: [{ id, date: photo.date }, ...state.progressPhotos],
      }))
      notify('Progress photo saved locally')
      return
    }
    const candidate = { ...appState, progressPhotos: [{ ...photo, id }, ...appState.progressPhotos] }
    if (JSON.stringify(candidate).length > 4_500_000) {
      notify('Photo storage is full. Export a backup, then remove an older photo.')
      return
    }
    setAppState(candidate)
    notify('Progress photo saved locally')
  }

  const deleteProgressPhoto = (id) => {
    const index = appState.progressPhotos.findIndex((photo) => photo.id === id)
    const removedMeta = appState.progressPhotos[index]
    const removedImage = photoData.get(id)
    if (photoStore === 'ready') void deletePhoto(id).catch(() => {})
    setPhotoData((current) => {
      if (!current.has(id)) return current
      const next = new Map(current)
      next.delete(id)
      return next
    })
    setAppState((state) => ({
      ...state,
      progressPhotos: state.progressPhotos.filter((photo) => photo.id !== id),
    }))
    notify('Progress photo removed', removedMeta && (async () => {
      if (removedImage && photoStore === 'ready') {
        try {
          await putPhoto(id, removedImage)
        } catch {
          notify('Could not restore the photo')
          return
        }
      }
      if (removedImage) setPhotoData((current) => new Map(current).set(id, removedImage))
      setAppState((state) =>
        state.progressPhotos.some((photo) => photo.id === id)
          ? state
          : { ...state, progressPhotos: insertAt(state.progressPhotos, index, removedMeta) },
      )
    }))
  }

  const saveCustomExercise = (data, existingId = null) => {
    const customExercise = {
      id: existingId || uid('custom'),
      name: data.name.trim(),
      primaryMuscle: data.primaryMuscle,
      secondaryMuscles: data.secondaryMuscles || [],
      equipment: data.equipment,
      difficulty: data.difficulty || 'Beginner',
      pattern: data.pattern || 'Custom',
      trackingType: data.trackingType || 'weight-reps',
      instructions: data.instructions?.filter(Boolean) || ['Set up the movement safely.', 'Move through a controlled range of motion.', 'Stop if you feel pain.'],
      cues: data.cues?.filter(Boolean) || ['Keep the movement controlled.', 'Use a load you can own.'],
      custom: true,
    }
    setAppState((state) => ({
      ...state,
      customExercises: existingId
        ? state.customExercises.map((exercise) => (exercise.id === existingId ? customExercise : exercise))
        : [...state.customExercises, customExercise],
    }))
    setSheet(null)
    notify(existingId ? 'Custom exercise updated' : 'Custom exercise created')
  }

  const deleteCustomExercise = (exerciseId) => {
    const isUsed = appState.workouts.some((workout) =>
      workout.exercises?.some((exercise) => exercise.exerciseId === exerciseId),
    ) || activeWorkout?.exercises.some((exercise) => exercise.exerciseId === exerciseId)
    if (isUsed) {
      notify('This exercise is used in a workout and cannot be deleted')
      return
    }
    setAppState((state) => ({
      ...state,
      customExercises: state.customExercises.filter((exercise) => exercise.id !== exerciseId),
    }))
    setSheet(null)
    notify('Custom exercise deleted')
  }

  const updateWorkout = (id, changes) => {
    setAppState((state) => ({
      ...state,
      // Re-sorted, since a corrected date can move a workout in the timeline.
      workouts: sortWorkouts(state.workouts.map((workout) => (workout.id === id ? { ...workout, ...changes } : workout))),
    }))
    notify('Workout updated')
  }

  const saveWorkoutAsRoutine = (workout) => {
    if (!workoutExerciseIds(workout).length) {
      notify('Add an exercise before saving a routine')
      return
    }
    const routineId = uid('routine')
    setAppState((state) => {
      const sourceRoutine = state.routines.find((routine) => routine.id === workout.sourceRoutineId)
      return {
        ...state,
        routines: [
          ...state.routines,
          { ...routineDataFromWorkout(workout, sourceRoutine), id: routineId },
        ],
        workouts: state.workouts.map((entry) =>
          entry.id === workout.id ? { ...entry, sourceRoutineId: routineId } : entry,
        ),
      }
    })
    notify('Routine created from workout')
  }

  const deleteWorkout = (id) => {
    const index = appState.workouts.findIndex((workout) => workout.id === id)
    const removed = appState.workouts[index]
    setAppState((state) => ({
      ...state,
      workouts: state.workouts.filter((workout) => workout.id !== id),
    }))
    setSheet(null)
    notify('Workout deleted', removed && (() =>
      setAppState((state) =>
        state.workouts.some((workout) => workout.id === id)
          ? state
          : { ...state, workouts: insertAt(state.workouts, index, removed) },
      )
    ))
  }

  const repeatWorkout = (workout) => {
    startWorkout({
      name: workout.name,
      exerciseIds: workout.exercises.map((exercise) => exercise.exerciseId),
      sourceRoutineId: workout.sourceRoutineId || null,
    })
    setSheet(null)
  }

  const changeUnit = (nextUnit) => {
    if (nextUnit === appState.settings.unit) return
    setAppState((state) => convertStateUnits(state, nextUnit))
    notify('Weights converted to ' + nextUnit)
  }

  const changeDistanceUnit = (distanceUnit) => {
    setAppState((state) => ({
      ...state,
      settings: { ...state.settings, distanceUnit: distanceUnit === 'mi' ? 'mi' : 'km' },
    }))
    notify('Running distances shown in ' + (distanceUnit === 'mi' ? 'miles' : 'kilometres'))
  }

  const changeTheme = (themeId) => {
    const theme = getTheme(themeId)
    if (theme.id === appState.settings.theme) return
    document.documentElement.dataset.theme = theme.id
    setAppState((state) => ({
      ...state,
      settings: { ...state.settings, theme: theme.id },
    }))
    notify(theme.name + ' applied')
  }

  const handleImport = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const imported = await importAppState(file)
      // The backup replaces everything, photos included; its images are moved
      // into the emptied store by the migration effect.
      if (photoStore === 'ready') await clearPhotos().catch(() => {})
      setPhotoData(new Map())
      setAppState(normalizeState(imported))
      setSheet(null)
      notify('Backup imported')
    } catch (error) {
      notify(error.message || 'Could not import backup')
    } finally {
      event.target.value = ''
    }
  }

  const resetData = () => {
    clearAppState()
    void clearPhotos().catch(() => {})
    setPhotoData(new Map())
    setAppState(createInitialState())
    setSheet(null)
    notify('Local data reset')
  }

  // The backup carries the photo images back inline, so one file restores
  // everything on another device.
  const exportBackup = () => {
    const exportedAt = new Date().toISOString()
    const ok = exportAppState({
      ...appState,
      progressPhotos,
      settings: { ...appState.settings, lastBackupAt: exportedAt },
    })
    if (ok) {
      setAppState((state) => ({ ...state, settings: { ...state.settings, lastBackupAt: exportedAt } }))
    }
    notify(ok ? 'Backup downloaded' : 'Could not create backup')
  }

  // Nudge once there's something worth losing: a few real sessions and no
  // backup in the last fortnight.
  const backupReminder = (() => {
    const realWorkouts = appState.workouts.filter((workout) => !workout.isSample).length
    if (appState.hasStarterData || realWorkouts < 3) return null
    if (Date.parse(appState.settings.backupSnoozedUntil) > Date.now()) return null
    const last = Date.parse(appState.settings.lastBackupAt)
    if (!last) return 'No backup yet'
    const days = Math.floor((Date.now() - last) / 86400000)
    return days >= 14 ? 'Last backup ' + days + ' days ago' : null
  })()

  const snoozeBackupReminder = () => {
    const until = new Date(Date.now() + 7 * 86400000).toISOString()
    setAppState((state) => ({ ...state, settings: { ...state.settings, backupSnoozedUntil: until } }))
  }

  const installApp = async () => {
    if (!installPrompt) return
    await installPrompt.prompt()
    await installPrompt.userChoice
    setInstallPrompt(null)
  }

  const clearStarterData = () => {
    setAppState((state) => ({
      ...state,
      hasStarterData: false,
      workouts: state.workouts.filter((workout) => !workout.isSample),
      measurements: state.measurements.filter((entry) => !entry.isSample),
      nutrition: {
        ...state.nutrition,
        entries: state.nutrition.entries.filter((entry) => !entry.isSample),
      },
    }))
    notify('Starter data cleared')
  }

  const inSession = view === 'train' && Boolean(activeWorkout)

  return (
    <div className={'app-shell' + (inSession ? ' is-in-session' : '') + (restTimer ? ' is-resting' : '')}>
      <Sidebar
        view={view}
        navigate={navigate}
        activeWorkout={activeWorkout}
        openSettings={() => setSheet({ type: 'settings' })}
      />

      <div className="app-pane">
        {!inSession && (
          <MobileTopBar
            openSettings={() => setSheet({ type: 'settings' })}
            openSession={() => navigate('train')}
            activeWorkout={activeWorkout}
          />
        )}
        <main className="app-main">
          <Suspense fallback={<FeatureLoader />}>
            <motion.div key={view + Boolean(activeWorkout)} className="view-frame" {...MOTION}>
              {view === 'train' &&
                (activeWorkout ? (
                  <LiveWorkout
                    workout={activeWorkout}
                    elapsedSeconds={elapsedSeconds}
                    unit={appState.settings.unit}
                    distanceUnit={appState.settings.distanceUnit}
                    exerciseMap={exerciseMap}
                    previousWorkouts={appState.workouts}
                    updateActiveWorkout={updateActiveWorkout}
                    updateSet={updateSet}
                    updateWeight={updateWeight}
                    toggleSet={toggleSet}
                    addSet={addSet}
                    removeSet={removeSet}
                    openExercisePicker={() => setSheet({ type: 'picker' })}
                    openExercise={(exerciseId) => setSheet({ type: 'exercise', exerciseId })}
                    openExerciseMenu={(workoutExerciseId) => setSheet({ type: 'exercise-menu', workoutExerciseId })}
                    openSetOptions={(workoutExerciseId, setId) => setSheet({ type: 'set-options', workoutExerciseId, setId })}
                    openBaseWeight={(workoutExerciseId) => setSheet({ type: 'base-weight', workoutExerciseId })}
                    openTools={() => setSheet({ type: 'tools' })}
                    openFinish={() => setSheet({ type: 'finish' })}
                    openDiscard={() => setSheet({ type: 'session-menu' })}
                    toggleWorkoutTimer={toggleWorkoutTimer}
                    keepPreviousLoad={keepPreviousLoad}
                  />
                ) : (
                  <TrainView
                    workouts={appState.workouts}
                    routines={appState.routines}
                    unit={appState.settings.unit}
                    distanceUnit={appState.settings.distanceUnit}
                    exerciseMap={exerciseMap}
                    hasStarterData={appState.hasStarterData}
                    clearStarterData={clearStarterData}
                    backupReminder={backupReminder}
                    exportBackup={exportBackup}
                    snoozeBackupReminder={snoozeBackupReminder}
                    startWorkout={startWorkout}
                    openWorkout={(workout) => setSheet({ type: 'workout', workout })}
                  />
                ))}
              {view === 'history' && (
                <HistoryView
                  workouts={appState.workouts}
                  unit={appState.settings.unit}
                  distanceUnit={appState.settings.distanceUnit}
                  exerciseMap={exerciseMap}
                  openWorkout={(workout) => setSheet({ type: 'workout', workout })}
                  startWorkout={startWorkout}
                />
              )}
              {view === 'routines' && (
                <RoutinesView
                  routines={appState.routines}
                  allExercises={allExercises}
                  onStart={startWorkout}
                  onCreate={createRoutine}
                  onUpdate={updateRoutine}
                  onDuplicate={duplicateRoutine}
                  onDelete={deleteRoutine}
                />
              )}
              {view === 'library' && (
                <LibraryView
                  allExercises={allExercises}
                  openExercise={(exerciseId) => setSheet({ type: 'exercise', exerciseId })}
                  openCreate={() => setSheet({ type: 'custom-exercise' })}
                />
              )}
              {view === 'nutrition' && (
                <NutritionView
                  nutrition={appState.nutrition}
                  updateNutrition={updateNutrition}
                  latestWeightKg={latestWeightKg}
                  notify={notify}
                />
              )}
              {view === 'progress' && (
                <ProgressView
                  workouts={appState.workouts}
                  unit={appState.settings.unit}
                  exerciseMap={exerciseMap}
                  measurements={appState.measurements}
                  photos={progressPhotos}
                  addMeasurement={addMeasurement}
                  deleteMeasurement={deleteMeasurement}
                  addProgressPhoto={addProgressPhoto}
                  deleteProgressPhoto={deleteProgressPhoto}
                  openWorkout={(workout, dayWorkouts = []) => setSheet(
                    dayWorkouts.length > 1
                      ? { type: 'workout-day', workouts: dayWorkouts }
                      : { type: 'workout', workout },
                  )}
                />
              )}
            </motion.div>
          </Suspense>
        </main>
      </div>

      <MobileNav view={view} navigate={navigate} activeWorkout={activeWorkout} />

      <AnimatePresence>
        {restRemaining !== null && (
          <RestTimer
            remaining={restRemaining}
            total={restTimer.total}
            adjust={adjustRest}
            skip={skipRest}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {sheet && (
          <Sheet
            onClose={() => setSheet(null)}
            kind={sheet.type}
            wide={sheet.type === 'picker' || sheet.type === 'exercise' || sheet.type === 'share'}
            share={sheet.type === 'share'}
            hideClose={sheet.type === 'tools' || sheet.type === 'set-options'}
          >
            <Suspense fallback={<FeatureLoader compact />}>
            {sheet.type === 'settings' && (
              <SettingsSheet
                settings={appState.settings}
                workoutCount={appState.workouts.length}
                changeUnit={changeUnit}
                changeDistanceUnit={changeDistanceUnit}
                changeTheme={changeTheme}
                changeRest={(seconds) =>
                  setAppState((state) => ({
                    ...state,
                    settings: { ...state.settings, restSeconds: seconds },
                  }))
                }
                changeKeepAwake={(enabled) =>
                  setAppState((state) => ({
                    ...state,
                    settings: { ...state.settings, keepAwake: enabled },
                  }))
                }
                changeTimerSound={(enabled) =>
                  setAppState((state) => ({
                    ...state,
                    settings: { ...state.settings, timerSound: enabled },
                  }))
                }
                canInstall={Boolean(installPrompt)}
                installApp={installApp}
                exportData={exportBackup}
                exportCsv={() => {
                  const ok = exportWorkoutsCsv(appState, exerciseMap)
                  notify(ok ? 'Workout CSV downloaded' : 'Could not create CSV')
                }}
                triggerImport={() => importInputRef.current?.click()}
                resetData={resetData}
              />
            )}
            {sheet.type === 'picker' && (
              <ExercisePicker
                allExercises={allExercises}
                currentIds={activeWorkout?.exercises.map((item) => item.exerciseId) || []}
                addExercise={addExercise}
                openDetails={(exerciseId) => setSheet({ type: 'exercise', exerciseId, returnTo: 'picker' })}
              />
            )}
            {sheet.type === 'exercise' && (
              <ExerciseDetail
                exercise={exerciseMap.get(sheet.exerciseId)}
                workouts={appState.workouts}
                unit={appState.settings.unit}
                distanceUnit={appState.settings.distanceUnit}
                canAdd={Boolean(activeWorkout) && !activeWorkout.exercises.some((item) => item.exerciseId === sheet.exerciseId)}
                addExercise={addExercise}
                goBack={sheet.returnTo ? () => setSheet({ type: sheet.returnTo }) : null}
                editCustom={exerciseMap.get(sheet.exerciseId)?.custom
                  ? () => setSheet({ type: 'custom-exercise', initial: exerciseMap.get(sheet.exerciseId) })
                  : null}
                deleteCustom={exerciseMap.get(sheet.exerciseId)?.custom
                  ? () => deleteCustomExercise(sheet.exerciseId)
                  : null}
              />
            )}
            {sheet.type === 'workout' && (
              <WorkoutDetail
                workout={appState.workouts.find((workout) => workout.id === sheet.workout.id) || sheet.workout}
                unit={appState.settings.unit}
                distanceUnit={appState.settings.distanceUnit}
                exerciseMap={exerciseMap}
                updateWorkout={updateWorkout}
                deleteWorkout={deleteWorkout}
                repeatWorkout={repeatWorkout}
                openShare={(workout) => setSheet({ type: 'share', workout })}
                saveWorkoutAsRoutine={saveWorkoutAsRoutine}
              />
            )}
            {sheet.type === 'workout-day' && (
              <WorkoutDaySheet
                workouts={sheet.workouts}
                unit={appState.settings.unit}
                distanceUnit={appState.settings.distanceUnit}
                exerciseMap={exerciseMap}
                openWorkout={(workout) => setSheet({ type: 'workout', workout })}
              />
            )}
            {sheet.type === 'tools' && (
              <WorkoutTools unit={appState.settings.unit} onClose={() => setSheet(null)} />
            )}
            {sheet.type === 'set-options' && (
              <SetOptions
                set={activeWorkout?.exercises
                  .find((exercise) => exercise.id === sheet.workoutExerciseId)?.sets
                  .find((set) => set.id === sheet.setId)}
                onChangeType={(type) => changeSetType(sheet.workoutExerciseId, sheet.setId, type)}
                onChangeRpe={(value) => updateSet(sheet.workoutExerciseId, sheet.setId, 'rpe', value)}
                onDelete={() => {
                  removeSet(sheet.workoutExerciseId, sheet.setId)
                  setSheet(null)
                }}
                onClose={() => setSheet(null)}
              />
            )}
            {sheet.type === 'base-weight' && (() => {
              const item = activeWorkout?.exercises.find((exercise) => exercise.id === sheet.workoutExerciseId)
              return (
                <BaseWeightSheet
                  exercise={exerciseMap.get(item?.exerciseId)}
                  item={item}
                  unit={appState.settings.unit}
                  onSave={(value) => setExerciseBaseWeight(sheet.workoutExerciseId, value)}
                  onClose={() => setSheet(null)}
                />
              )
            })()}
            {sheet.type === 'custom-exercise' && (
              <CustomExerciseSheet
                initial={sheet.initial}
                onSave={(data) => saveCustomExercise(data, sheet.initial?.id)}
              />
            )}
            {sheet.type === 'finish' && (
              <FinishWorkoutSheet
                workout={activeWorkout}
                elapsedSeconds={elapsedSeconds}
                unit={appState.settings.unit}
                distanceUnit={appState.settings.distanceUnit}
                exerciseMap={exerciseMap}
                sourceRoutine={appState.routines.find((routine) => routine.id === activeWorkout?.sourceRoutineId)}
                finishWorkout={finishWorkout}
                cancel={() => setSheet(null)}
              />
            )}
            {sheet.type === 'share' && (
              <WorkoutShareCard
                workout={sheet.workout}
                unit={appState.settings.unit}
                distanceUnit={appState.settings.distanceUnit}
                exerciseMap={exerciseMap}
                onDone={() => setSheet(null)}
                notify={notify}
              />
            )}
            {sheet.type === 'session-menu' && (
              <SessionMenuSheet
                openPicker={() => setSheet({ type: 'picker' })}
                openSettings={() => setSheet({ type: 'settings' })}
                openDiscard={() => setSheet({ type: 'discard' })}
                close={() => setSheet(null)}
              />
            )}
            {sheet.type === 'discard' && (
              <ConfirmSheet
                icon={Trash2}
                title="Discard this workout?"
                body="This active session and its entered sets will be removed. Finished workouts are unaffected."
                confirmLabel="Discard workout"
                onConfirm={discardWorkout}
                onCancel={() => setSheet(null)}
                danger
              />
            )}
            {sheet.type === 'exercise-menu' && (
              <ExerciseActionsSheet
                workout={activeWorkout}
                workoutExerciseId={sheet.workoutExerciseId}
                unit={appState.settings.unit}
                moveExercise={moveExercise}
                toggleSuperset={toggleSuperset}
                setExerciseRest={setExerciseRest}
                openBaseWeight={(workoutExerciseId) => setSheet({ type: 'base-weight', workoutExerciseId })}
                removeExercise={removeExercise}
                close={() => setSheet(null)}
              />
            )}
            </Suspense>
          </Sheet>
        )}
      </AnimatePresence>

      <input
        ref={importInputRef}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        onChange={handleImport}
      />

      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            className="toast"
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8 }}
            role="status"
          >
            <Check size={16} strokeWidth={2.5} />
            <span>{toast.message}</span>
            {toast.undo && (
              <button
                className="toast-undo"
                onClick={() => {
                  toast.undo()
                  setToast(null)
                }}
              >
                Undo
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default App
