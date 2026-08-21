import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  Activity,
  ArrowLeft,
  BarChart3,
  BookOpen,
  Check,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  Clock3,
  Copy,
  Database,
  Download,
  Dumbbell,
  Ellipsis,
  FileJson,
  History,
  Info,
  ListPlus,
  LockKeyhole,
  Link2,
  Minus,
  MoreVertical,
  Palette,
  Pause,
  Play,
  Plus,
  Search,
  Settings,
  Share2,
  ShieldCheck,
  Sparkles,
  Target,
  TimerReset,
  Trash2,
  Upload,
  Wrench,
  X,
  Zap,
} from 'lucide-react'
import { exercises, equipmentOptions, muscleGroups } from './data/exercises.js'
import { getTheme, normalizeTheme, THEMES } from './data/themes.js'
import {
  clearAppState,
  exportAppState,
  importAppState,
  loadAppState,
  saveAppState,
} from './lib/storage.js'
import { exportWorkoutsCsv } from './lib/csv.js'
import {
  cardioSetDistanceKm,
  cardioSetPaceSecondsPerKm,
  formatCardioDistance,
  formatCardioPace,
  formatCardioSpeed,
  formatCardioTime,
  getCardioSummary,
  isCardioExercise,
  workoutIsCardioOnly,
} from './lib/cardio.js'

const RoutinesView = lazy(() =>
  import('./components/RoutinesView.jsx').then((module) => ({ default: module.RoutinesView })),
)
const loadProgressPlus = () => import('./components/ProgressPlus.jsx')
const loadProgressPhotos = () => import('./components/ProgressPhotos.jsx')

const TrainingCalendar = lazy(() =>
  loadProgressPlus().then((module) => ({ default: module.TrainingCalendar })),
)
const MeasurementsPanel = lazy(() =>
  loadProgressPlus().then((module) => ({ default: module.MeasurementsPanel })),
)
const MuscleBreakdown = lazy(() =>
  loadProgressPlus().then((module) => ({ default: module.MuscleBreakdown })),
)
const ExercisePerformance = lazy(() =>
  loadProgressPlus().then((module) => ({ default: module.ExercisePerformance })),
)
const ExerciseMuscleMap = lazy(() => import('./components/ExerciseMuscleMap.jsx'))
const ProgressPhotos = lazy(() =>
  loadProgressPhotos().then((module) => ({ default: module.ProgressPhotos })),
)
const WorkoutTools = lazy(() =>
  import('./components/WorkoutTools.jsx').then((module) => ({ default: module.WorkoutTools })),
)
const SetOptions = lazy(() =>
  import('./components/WorkoutTools.jsx').then((module) => ({ default: module.SetOptions })),
)
const WorkoutShareCard = lazy(() =>
  import('./components/WorkoutShareCard.jsx').then((module) => ({ default: module.WorkoutShareCard })),
)
const CardioTracker = lazy(() =>
  import('./components/CardioTracker.jsx').then((module) => ({ default: module.CardioTracker })),
)

const NAV_ITEMS = [
  { id: 'train', label: 'Train', icon: Dumbbell },
  { id: 'routines', label: 'Routines', icon: ClipboardList },
  { id: 'history', label: 'History', icon: History },
  { id: 'library', label: 'Exercises', icon: BookOpen },
  { id: 'progress', label: 'Progress', icon: BarChart3 },
]

const TEMPLATES = [
  {
    id: 'upper-strength',
    name: 'Upper strength',
    eyebrow: 'Recommended',
    description: '4 exercises · about 55 min',
    exerciseIds: ['barbell-bench-press', 'barbell-bent-over-row', 'barbell-overhead-press', 'pull-up'],
  },
  {
    id: 'lower-strength',
    name: 'Lower strength',
    eyebrow: 'Strength',
    description: '4 exercises · about 60 min',
    exerciseIds: ['barbell-back-squat', 'barbell-romanian-deadlift', 'leg-press', 'standing-calf-raise'],
  },
  {
    id: 'push-express',
    name: 'Push express',
    eyebrow: 'Quick',
    description: '4 exercises · about 35 min',
    exerciseIds: ['incline-dumbbell-press', 'seated-dumbbell-shoulder-press', 'dumbbell-lateral-raise', 'rope-triceps-pushdown'],
  },
  {
    id: 'full-body',
    name: 'Full body',
    eyebrow: 'Balanced',
    description: '4 exercises · about 45 min',
    exerciseIds: ['goblet-squat', 'push-up', 'one-arm-dumbbell-row', 'kettlebell-swing'],
  },
  {
    id: 'treadmill-run-session',
    name: 'Treadmill run',
    eyebrow: 'Cardio',
    description: 'Distance, pace, incline & heart rate',
    exerciseIds: ['treadmill-run'],
    prescriptions: { 'treadmill-run': { sets: 1 } },
  },
]

const EXERCISE_MAP = new Map(exercises.map((exercise) => [exercise.id, exercise]))
const DURATION_EXERCISES = new Set(['forearm-plank', 'side-plank'])
const DISTANCE_EXERCISES = new Set([
  'farmers-carry',
  'suitcase-carry',
  'kettlebell-front-rack-carry',
  'sled-push',
])
const MOTION = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
}

function uid(prefix = 'id') {
  const value = globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)
  return prefix + '-' + value
}

function daysAgoIso(days, hour = 18, minute = 0) {
  const date = new Date()
  date.setHours(hour, minute, 0, 0)
  date.setDate(date.getDate() - days)
  return date.toISOString()
}

function seedExercise(exerciseId, values, notes = '') {
  return {
    id: uid('we'),
    exerciseId,
    notes,
    sets: values.map(([weight, reps, rpe]) => ({
      id: uid('set'),
      weight,
      reps,
      rpe,
      type: 'normal',
      completed: true,
    })),
  }
}

function createInitialState() {
  const upperStart = daysAgoIso(2, 18, 12)
  const lowerStart = daysAgoIso(5, 7, 8)
  const pullStart = daysAgoIso(9, 18, 32)
  const fullStart = daysAgoIso(13, 9, 15)

  return {
    version: 1,
    settings: {
      theme: 'graphite',
      unit: 'kg',
      distanceUnit: 'km',
      restSeconds: 90,
      keepAwake: true,
      countWarmups: false,
      timerSound: true,
    },
    routines: TEMPLATES.map((template) => ({
      ...template,
      id: 'routine-' + template.id,
      folder: template.id === 'full-body' ? 'Essentials' : 'My training',
    })),
    measurements: [
      { id: uid('measure'), date: daysAgoIso(14, 8, 0).slice(0, 10), weight: 76.4, bodyFat: 16.2, waist: 82, chest: 101, arm: 35, thigh: 57 },
      { id: uid('measure'), date: daysAgoIso(0, 8, 0).slice(0, 10), weight: 75.8, bodyFat: 15.8, waist: 81.5, chest: 101.5, arm: 35.3, thigh: 57.2 },
    ],
    progressPhotos: [],
    customExercises: [],
    hasStarterData: true,
    activeWorkout: null,
    workouts: [
      {
        id: uid('workout'),
        isSample: true,
        name: 'Upper strength',
        startedAt: upperStart,
        completedAt: new Date(new Date(upperStart).getTime() + 56 * 60000).toISOString(),
        durationSeconds: 56 * 60,
        exercises: [
          seedExercise('barbell-bench-press', [[70, 8, 8], [70, 8, 8], [70, 7, 9]]),
          seedExercise('barbell-bent-over-row', [[62.5, 10, 8], [62.5, 10, 8], [62.5, 9, 9]]),
          seedExercise('barbell-overhead-press', [[40, 8, 8], [40, 8, 9], [37.5, 9, 9]]),
          seedExercise('pull-up', [[0, 8, 8], [0, 7, 9], [0, 6, 9]]),
        ],
      },
      {
        id: uid('workout'),
        isSample: true,
        name: 'Lower strength',
        startedAt: lowerStart,
        completedAt: new Date(new Date(lowerStart).getTime() + 64 * 60000).toISOString(),
        durationSeconds: 64 * 60,
        exercises: [
          seedExercise('barbell-back-squat', [[90, 6, 8], [90, 6, 8], [90, 5, 9]]),
          seedExercise('barbell-romanian-deadlift', [[80, 8, 8], [80, 8, 8], [80, 8, 9]]),
          seedExercise('leg-press', [[150, 10, 8], [150, 10, 8], [150, 9, 9]]),
          seedExercise('standing-calf-raise', [[60, 12, 8], [60, 12, 8], [60, 11, 9]]),
        ],
      },
      {
        id: uid('workout'),
        isSample: true,
        name: 'Pull volume',
        startedAt: pullStart,
        completedAt: new Date(new Date(pullStart).getTime() + 48 * 60000).toISOString(),
        durationSeconds: 48 * 60,
        exercises: [
          seedExercise('lat-pulldown', [[55, 10, 8], [55, 10, 8], [55, 9, 9]]),
          seedExercise('seated-cable-row', [[52.5, 12, 8], [52.5, 11, 8], [52.5, 10, 9]]),
          seedExercise('hammer-curl', [[14, 10, 8], [14, 9, 9], [12, 11, 9]]),
        ],
      },
      {
        id: uid('workout'),
        isSample: true,
        name: 'Full body',
        startedAt: fullStart,
        completedAt: new Date(new Date(fullStart).getTime() + 43 * 60000).toISOString(),
        durationSeconds: 43 * 60,
        exercises: [
          seedExercise('goblet-squat', [[26, 12, 8], [26, 12, 8], [26, 10, 9]]),
          seedExercise('dumbbell-bench-press', [[24, 10, 8], [24, 9, 9], [22, 10, 9]]),
          seedExercise('one-arm-dumbbell-row', [[26, 10, 8], [26, 10, 8], [26, 10, 9]]),
        ],
      },
    ],
  }
}

function normalizeState(state) {
  const fallback = createInitialState()
  if (!state || typeof state !== 'object') return fallback
  return {
    ...fallback,
    ...state,
    version: 1,
    workouts: Array.isArray(state.workouts) ? state.workouts : fallback.workouts,
    routines: Array.isArray(state.routines) ? state.routines : fallback.routines,
    measurements: Array.isArray(state.measurements) ? state.measurements : fallback.measurements,
    progressPhotos: Array.isArray(state.progressPhotos) ? state.progressPhotos : [],
    customExercises: Array.isArray(state.customExercises) ? state.customExercises : [],
    hasStarterData: Boolean(state.hasStarterData),
    activeWorkout: state.activeWorkout || null,
    settings: {
      ...fallback.settings,
      ...(state.settings || {}),
      theme: normalizeTheme(state.settings?.theme),
    },
  }
}

function formatDate(dateValue, options) {
  const date = new Date(dateValue)
  return new Intl.DateTimeFormat('en', options).format(date)
}

function formatDuration(seconds) {
  const safeSeconds = Math.max(0, Math.floor(seconds || 0))
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  const remainingSeconds = safeSeconds % 60
  if (hours > 0) return String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0') + ':' + String(remainingSeconds).padStart(2, '0')
  return String(minutes).padStart(2, '0') + ':' + String(remainingSeconds).padStart(2, '0')
}

function calculateElapsed(workout, nowValue = Date.now()) {
  if (!workout?.startedAt) return 0
  const endTime = workout.pausedAt ? new Date(workout.pausedAt).getTime() : nowValue
  const pausedMilliseconds = Number(workout.pausedDurationSeconds || 0) * 1000
  return Math.max(0, Math.floor((endTime - new Date(workout.startedAt).getTime() - pausedMilliseconds) / 1000))
}

function workoutVolume(workout) {
  return (workout?.exercises || []).reduce(
    (total, item) =>
      total +
      (item.sets || []).reduce((setTotal, set) => {
        if (!set.completed || set.type === 'warmup') return setTotal
        return setTotal + (Number(set.weight) || 0) * (Number(set.reps) || 0)
      }, 0),
    0,
  )
}

function completedSetCount(workout) {
  return (workout?.exercises || []).reduce(
    (total, item) => total + (item.sets || []).filter((set) => set.completed).length,
    0,
  )
}

function createWorkoutSet(previous = null) {
  return {
    id: uid('set'),
    weight: previous?.weight ?? '',
    reps: previous?.reps ?? '',
    duration: previous?.duration ?? '',
    distance: previous?.distance ?? '',
    distanceKm: previous?.distanceKm ?? '',
    speed: previous?.speed ?? '',
    incline: previous?.incline ?? '',
    heartRate: previous?.heartRate ?? '',
    calories: previous?.calories ?? '',
    rpe: '',
    type: 'normal',
    completed: false,
  }
}

function compactNumber(value) {
  return new Intl.NumberFormat('en', {
    notation: value >= 10000 ? 'compact' : 'standard',
    maximumFractionDigits: value >= 10000 ? 1 : 0,
  }).format(value || 0)
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function getPreviousSet(workouts, exerciseId) {
  for (const workout of workouts) {
    const match = workout.exercises?.find((item) => item.exerciseId === exerciseId)
    const previous = match?.sets?.filter((set) => set.completed).at(-1)
    if (previous) return previous
  }
  return null
}

function sameExerciseOrder(left = [], right = []) {
  return left.length === right.length && left.every((id, index) => id === right[index])
}

function workoutExerciseIds(workout) {
  return Array.from(new Set((workout?.exercises || []).map((item) => item.exerciseId).filter(Boolean)))
}

function routineDataFromWorkout(workout, sourceRoutine = null) {
  const exerciseIds = workoutExerciseIds(workout)
  const prescriptions = Object.fromEntries(
    exerciseIds.flatMap((exerciseId) => {
      const item = workout.exercises.find((exercise) => exercise.exerciseId === exerciseId)
      const sourcePrescription = sourceRoutine?.prescriptions?.[exerciseId]
      const completedSets = (item?.sets || []).filter((set) => set.completed)
      const setCount = completedSets.length || item?.sets?.length || 0
      const prescription = sourcePrescription ? { ...sourcePrescription } : {}

      if (!sourcePrescription && setCount) prescription.sets = setCount
      if (item?.targetMinReps) prescription.minReps = item.targetMinReps
      if (item?.targetMaxReps) prescription.maxReps = item.targetMaxReps
      if (item?.restSeconds !== undefined) prescription.restSeconds = item.restSeconds

      return Object.keys(prescription).length ? [[exerciseId, prescription]] : []
    }),
  )

  return {
    name: workout?.name?.trim() || 'Workout routine',
    folder: sourceRoutine?.folder || 'Unfiled',
    description: sourceRoutine?.description || 'Saved from a completed workout.',
    exerciseIds,
    prescriptions,
  }
}

function getTrackingType(exercise) {
  if (exercise?.trackingType) return exercise.trackingType
  if (DURATION_EXERCISES.has(exercise?.id)) return 'duration'
  if (DISTANCE_EXERCISES.has(exercise?.id)) return 'distance'
  return 'weight-reps'
}

function previousSetLabel(set, trackingType) {
  if (!set) return '—'
  if (trackingType === 'duration') return set.duration ? set.duration + ' sec' : '—'
  if (trackingType === 'distance') {
    const load = set.weight === '' || set.weight == null ? '—' : set.weight
    return load + ' · ' + (set.distance || '—') + 'm'
  }
  return String(set.weight ?? '—') + ' × ' + String(set.reps ?? '—')
}

function completedSetLabel(set, trackingType, unit, distanceUnit = 'km') {
  if (trackingType === 'duration') return (set.duration || 0) + ' seconds'
  if (trackingType === 'distance') {
    return (set.weight || 0) + ' ' + unit + ' · ' + (set.distance || 0) + ' m'
  }
  if (trackingType === 'cardio') {
    return `${formatCardioDistance(cardioSetDistanceKm(set), distanceUnit)} ${distanceUnit} · ${formatCardioTime(set.duration)} · ${formatCardioPace(cardioSetPaceSecondsPerKm(set), distanceUnit)}`
  }
  return (set.weight || 'BW') + (set.weight ? ' ' + unit : '') + ' × ' + (set.reps || 0)
}

function playTimerSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext
    if (!AudioContext) return
    const context = new AudioContext()
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.frequency.setValueAtTime(660, context.currentTime)
    oscillator.frequency.exponentialRampToValueAtTime(880, context.currentTime + 0.16)
    gain.gain.setValueAtTime(0.0001, context.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.22)
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start()
    oscillator.stop(context.currentTime + 0.24)
    oscillator.addEventListener('ended', () => context.close(), { once: true })
  } catch {
    // Audio feedback is optional and may be blocked by the browser.
  }
}

function App() {
  const [appState, setAppState] = useState(() => normalizeState(loadAppState(createInitialState())))
  const [view, setView] = useState('train')
  const [sheet, setSheet] = useState(null)
  const [toast, setToast] = useState('')
  const [now, setNow] = useState(Date.now())
  const [restRemaining, setRestRemaining] = useState(null)
  const [installPrompt, setInstallPrompt] = useState(null)
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

  useEffect(() => {
    saveAppState(appState)
  }, [appState])

  useEffect(() => {
    const theme = getTheme(appState.settings.theme)
    document.documentElement.dataset.theme = theme.id
    document.documentElement.style.colorScheme = theme.id === 'midnight' ? 'dark' : 'light'
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.browserColor)
  }, [appState.settings.theme])

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

  useEffect(() => {
    if (restRemaining === null || restRemaining <= 0) return undefined
    const timer = window.setInterval(() => {
      setRestRemaining((value) => {
        if (value === null || value <= 1) {
          window.navigator?.vibrate?.([80, 50, 80])
          if (appState.settings.timerSound) playTimerSound()
          return null
        }
        return value - 1
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [restRemaining, appState.settings.timerSound])

  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(() => setToast(''), 2600)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    document.body.classList.toggle('sheet-open', Boolean(sheet))
    return () => document.body.classList.remove('sheet-open')
  }, [sheet])

  const notify = (message) => {
    setToast('')
    window.setTimeout(() => setToast(message), 10)
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
      exercises: chosen.map((exerciseId) => {
        const previous = getPreviousSet(appState.workouts, exerciseId)
        const prescription = template?.prescriptions?.[exerciseId]
        const cardio = isCardioExercise(exerciseMap.get(exerciseId))
        return {
          id: uid('we'),
          exerciseId,
          notes: '',
          restSeconds: prescription?.restSeconds,
          targetMinReps: prescription?.minReps,
          targetMaxReps: prescription?.maxReps,
          sets: Array.from({ length: prescription?.sets || (cardio ? 1 : 3) }, () => createWorkoutSet(previous)),
        }
      }),
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
      const previous = getPreviousSet(appState.workouts, exerciseId)
      return {
        ...workout,
        exercises: [
          ...workout.exercises,
          {
            id: uid('we'),
            exerciseId,
            notes: '',
            sets: [createWorkoutSet(previous)],
          },
        ],
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
        setRestRemaining(item?.restSeconds || appState.settings.restSeconds)
      }
      window.navigator?.vibrate?.(35)
      const weight = Number(targetSet?.weight) || 0
      const reps = Number(targetSet?.reps) || 0
      if (weight > 0 && reps > 0) {
        const estimate = weight * (1 + reps / 30)
        const previousBest = getPersonalRecords(appState.workouts)
          .find((record) => record.exerciseId === item?.exerciseId)?.estimate || 0
        if (estimate > previousBest) {
          notify('New personal record · ' + Math.round(estimate * 10) / 10 + ' ' + appState.settings.unit + ' e1RM')
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
    updateActiveWorkout((workout) => ({
      ...workout,
      exercises: workout.exercises.map((exercise) =>
        exercise.id === workoutExerciseId
          ? { ...exercise, sets: exercise.sets.filter((set) => set.id !== setId) }
          : exercise,
      ),
    }))
  }

  const removeExercise = (workoutExerciseId) => {
    updateActiveWorkout((workout) => ({
      ...workout,
      exercises: workout.exercises.filter((exercise) => exercise.id !== workoutExerciseId),
    }))
    setSheet(null)
    notify('Exercise removed')
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

  const finishWorkout = (routineAction = 'none') => {
    if (!activeWorkout) return
    const newRoutineId = routineAction === 'create' ? uid('routine') : null
    const cardio = getCardioSummary(activeWorkout, exerciseMap)
    const recordedDuration = Math.max(elapsedSeconds, cardio.totalDurationSeconds || 0)
    const finished = {
      ...activeWorkout,
      sourceRoutineId: newRoutineId || activeWorkout.sourceRoutineId || null,
      completedAt: new Date().toISOString(),
      durationSeconds: recordedDuration,
    }
    setAppState((state) => {
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
        hasStarterData: false,
        workouts: [finished, ...state.workouts.filter((workout) => !workout.isSample)],
        measurements: state.hasStarterData ? [] : state.measurements,
      }
    })
    setRestRemaining(null)
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
    setAppState((state) => ({ ...state, activeWorkout: null }))
    setRestRemaining(null)
    setSheet(null)
    notify('Workout discarded')
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
    setAppState((state) => ({
      ...state,
      routines: state.routines.filter((routine) => routine.id !== id),
    }))
    notify('Routine deleted')
  }

  const addMeasurement = (entry) => {
    setAppState((state) => ({
      ...state,
      measurements: [{ ...entry, id: uid('measure') }, ...state.measurements],
    }))
    notify('Measurement saved')
  }

  const deleteMeasurement = (id) => {
    setAppState((state) => ({
      ...state,
      measurements: state.measurements.filter((entry) => entry.id !== id),
    }))
    notify('Measurement removed')
  }

  const addProgressPhoto = (photo) => {
    const nextPhotos = [{ ...photo, id: photo.id || uid('photo') }, ...appState.progressPhotos].slice(0, 12)
    const candidate = { ...appState, progressPhotos: nextPhotos }
    if (JSON.stringify(candidate).length > 4_500_000) {
      notify('Photo storage is full—export a backup, then remove an older photo')
      return
    }
    setAppState(candidate)
    notify('Progress photo saved locally')
  }

  const deleteProgressPhoto = (id) => {
    setAppState((state) => ({
      ...state,
      progressPhotos: state.progressPhotos.filter((photo) => photo.id !== id),
    }))
    notify('Progress photo removed')
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
      workouts: state.workouts.map((workout) => (workout.id === id ? { ...workout, ...changes } : workout)),
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
    setAppState((state) => ({
      ...state,
      workouts: state.workouts.filter((workout) => workout.id !== id),
    }))
    setSheet(null)
    notify('Workout deleted')
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
    const factor = nextUnit === 'lb' ? 2.2046226218 : 1 / 2.2046226218
    const lengthFactor = nextUnit === 'lb' ? 1 / 2.54 : 2.54
    const convertWorkout = (workout) =>
      workout
        ? {
            ...workout,
            exercises: workout.exercises.map((exercise) => ({
              ...exercise,
              sets: exercise.sets.map((set) => ({
                ...set,
                weight: set.weight === '' ? '' : Math.round(Number(set.weight) * factor * 2) / 2,
              })),
            })),
          }
        : null

    setAppState((state) => ({
      ...state,
      settings: { ...state.settings, unit: nextUnit },
      workouts: state.workouts.map(convertWorkout),
      activeWorkout: convertWorkout(state.activeWorkout),
      measurements: state.measurements.map((measurement) => ({
        ...measurement,
        weight: measurement.weight === '' || measurement.weight == null
          ? measurement.weight
          : Math.round(Number(measurement.weight) * factor * 10) / 10,
        waist: measurement.waist === '' || measurement.waist == null
          ? measurement.waist
          : Math.round(Number(measurement.waist) * lengthFactor * 10) / 10,
        chest: measurement.chest === '' || measurement.chest == null
          ? measurement.chest
          : Math.round(Number(measurement.chest) * lengthFactor * 10) / 10,
        arm: measurement.arm === '' || measurement.arm == null
          ? measurement.arm
          : Math.round(Number(measurement.arm) * lengthFactor * 10) / 10,
        thigh: measurement.thigh === '' || measurement.thigh == null
          ? measurement.thigh
          : Math.round(Number(measurement.thigh) * lengthFactor * 10) / 10,
      })),
    }))
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
    setAppState(createInitialState())
    setSheet(null)
    notify('Local data reset')
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
      measurements: [],
    }))
    notify('Starter data cleared')
  }

  return (
    <div className="app-shell">
      <Sidebar
        view={view}
        navigate={navigate}
        activeWorkout={activeWorkout}
        openSettings={() => setSheet({ type: 'settings' })}
      />

      <div className="app-pane">
        <MobileTopBar openSettings={() => setSheet({ type: 'settings' })} activeWorkout={activeWorkout} />
        <main className="app-main">
          <Suspense fallback={<FeatureLoader />}>
            <AnimatePresence mode="wait">
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
                    toggleSet={toggleSet}
                    addSet={addSet}
                    removeSet={removeSet}
                    openExercisePicker={() => setSheet({ type: 'picker' })}
                    openExercise={(exerciseId) => setSheet({ type: 'exercise', exerciseId })}
                    openExerciseMenu={(workoutExerciseId) => setSheet({ type: 'exercise-menu', workoutExerciseId })}
                    openSetOptions={(workoutExerciseId, setId) => setSheet({ type: 'set-options', workoutExerciseId, setId })}
                    openTools={() => setSheet({ type: 'tools' })}
                    openFinish={() => setSheet({ type: 'finish' })}
                    openDiscard={() => setSheet({ type: 'discard' })}
                    toggleWorkoutTimer={toggleWorkoutTimer}
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
              {view === 'progress' && (
                <ProgressView
                  workouts={appState.workouts}
                  unit={appState.settings.unit}
                  exerciseMap={exerciseMap}
                  measurements={appState.measurements}
                  photos={appState.progressPhotos}
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
            </AnimatePresence>
          </Suspense>
        </main>
      </div>

      <MobileNav view={view} navigate={navigate} activeWorkout={activeWorkout} />

      <AnimatePresence>
        {restRemaining !== null && (
          <RestTimer
            remaining={restRemaining}
            setRemaining={setRestRemaining}
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
                exportData={() => {
                  const ok = exportAppState(appState)
                  notify(ok ? 'Backup downloaded' : 'Could not create backup')
                }}
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
                onDelete={() => {
                  removeSet(sheet.workoutExerciseId, sheet.setId)
                  setSheet(null)
                }}
                onClose={() => setSheet(null)}
              />
            )}
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
                moveExercise={moveExercise}
                toggleSuperset={toggleSuperset}
                setExerciseRest={setExerciseRest}
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
            className="toast"
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8 }}
            role="status"
          >
            <Check size={16} strokeWidth={2.5} />
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Brand({ compact = false }) {
  return (
    <div className={'brand ' + (compact ? 'brand--compact' : '')}>
      <span className="brand-mark"><span /></span>
      <span className="brand-copy">
        <strong>OPEN</strong>
        <b>WORKOUT</b>
      </span>
    </div>
  )
}

function Sidebar({ view, navigate, activeWorkout, openSettings }) {
  return (
    <aside className="sidebar">
      <Brand />
      <nav className="side-nav" aria-label="Primary navigation">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const selected = view === item.id
          return (
            <button
              key={item.id}
              className={'side-nav-item ' + (selected ? 'is-active' : '')}
              onClick={() => navigate(item.id)}
            >
              <Icon size={19} strokeWidth={selected ? 2.4 : 1.8} />
              <span>{item.label}</span>
              {item.id === 'train' && activeWorkout && <i className="live-dot" />}
            </button>
          )
        })}
      </nav>
      <div className="sidebar-bottom">
        <div className="privacy-note">
          <ShieldCheck size={17} />
          <div>
            <strong>Private by design</strong>
            <span>Saved on this device</span>
          </div>
        </div>
        <button className="side-nav-item" onClick={openSettings}>
          <Settings size={19} strokeWidth={1.8} />
          <span>Settings & data</span>
        </button>
        <div className="sidebar-signature">SATYAM.LOL · LOCAL FIRST</div>
      </div>
    </aside>
  )
}

function MobileTopBar({ openSettings, activeWorkout }) {
  return (
    <header className="mobile-topbar">
      <Brand compact />
      <div className="mobile-topbar-actions">
        {activeWorkout && (
          <span className="mobile-live"><i /> LIVE</span>
        )}
        <button className="icon-button" onClick={openSettings} aria-label="Open settings">
          <Settings size={20} />
        </button>
      </div>
    </header>
  )
}

function MobileNav({ view, navigate, activeWorkout }) {
  return (
    <nav className="mobile-nav" aria-label="Primary navigation">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon
        const selected = view === item.id
        return (
          <button
            key={item.id}
            className={selected ? 'is-active' : ''}
            onClick={() => navigate(item.id)}
          >
            <span className="mobile-nav-icon">
              <Icon size={20} strokeWidth={selected ? 2.5 : 1.9} />
              {item.id === 'train' && activeWorkout && <i className="nav-live-dot" />}
            </span>
            <span>{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

function ViewHeader({ eyebrow, title, subtitle, action }) {
  return (
    <header className="view-header">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </header>
  )
}

function TrainView({ workouts, routines, unit, distanceUnit, exerciseMap, hasStarterData, clearStarterData, startWorkout, openWorkout }) {
  const latestWorkout = workouts[0]
  const getStoredRoutine = (template) => routines.find(
    (routine) => routine.id === template.id || routine.id === 'routine-' + template.id,
  ) || template
  const weekCutoff = Date.now() - 7 * 86400000
  const weekWorkouts = workouts.filter((workout) => new Date(workout.startedAt).getTime() >= weekCutoff)
  const weekSets = weekWorkouts.reduce((total, workout) => total + completedSetCount(workout), 0)
  const weekVolume = weekWorkouts.reduce((total, workout) => total + workoutVolume(workout), 0)
  const weekCardio = weekWorkouts.reduce((summary, workout) => {
    const cardio = getCardioSummary(workout, exerciseMap)
    return {
      distanceKm: summary.distanceKm + cardio.distanceKm,
    }
  }, { distanceKm: 0 })
  const latestCardio = latestWorkout ? getCardioSummary(latestWorkout, exerciseMap) : null

  return (
    <div className="train-view content-width">
      <ViewHeader
        eyebrow={formatDate(new Date(), { weekday: 'long', day: 'numeric', month: 'long' })}
        title={getGreeting() + '.'}
        subtitle="Your next session is ready. Adjust anything as you go."
        action={
          <button className="button button--dark desktop-action" onClick={() => startWorkout(null)}>
            <Plus size={17} /> Empty workout
          </button>
        }
      />

      {hasStarterData && (
        <div className="starter-banner">
          <Sparkles size={16} />
          <p><strong>Preview data is on.</strong> Explore the app, or clear it before your first session.</p>
          <button onClick={clearStarterData}>Clear preview</button>
        </div>
      )}

      <div className="train-layout">
        <div className="train-primary">
          <motion.section
            className="session-hero"
            whileHover={{ y: -2 }}
            transition={{ duration: 0.22 }}
          >
            <div className="session-hero-image" aria-hidden="true" />
            <div className="session-hero-shade" />
            <div className="session-hero-content">
              <div className="hero-label"><Zap size={14} fill="currentColor" /> NEXT WORKOUT</div>
              <h2>Upper<br />strength</h2>
              <div className="hero-meta">
                <span>4 exercises</span>
                <span>~55 min</span>
              </div>
              <button className="button button--accent button--large" onClick={() => startWorkout(getStoredRoutine(TEMPLATES[0]))}>
                <Play size={18} fill="currentColor" />
                Start workout
              </button>
            </div>
          </motion.section>

          <section className="section-block">
            <div className="section-heading">
              <div>
                <span className="section-kicker">ROUTINES</span>
                <h2>Quick start</h2>
              </div>
              <button className="text-button mobile-empty" onClick={() => startWorkout(null)}>
                Empty workout <Plus size={16} />
              </button>
            </div>
            <div className="template-list">
              {TEMPLATES.slice(1).map((template, index) => (
                <button
                  key={template.id}
                  className="template-row"
                  onClick={() => startWorkout(getStoredRoutine(template))}
                >
                  <span className="template-index">0{index + 1}</span>
                  <span className="template-main">
                    <strong>{template.name}</strong>
                    <small>{template.description}</small>
                  </span>
                  <span className="template-type">{template.eyebrow}</span>
                  <ChevronRight size={19} />
                </button>
              ))}
            </div>
          </section>
        </div>

        <aside className="train-aside">
          <section className="week-panel">
            <div className="section-kicker">LAST 7 DAYS</div>
            <div className="week-metrics">
              <div>
                <strong>{weekWorkouts.length}</strong>
                <span>sessions</span>
              </div>
              <div>
                <strong>{weekSets}</strong>
                <span>{weekCardio.distanceKm > 0 ? 'sets / splits' : 'working sets'}</span>
              </div>
              <div>
                <strong>{weekCardio.distanceKm > 0
                  ? formatCardioDistance(weekCardio.distanceKm, distanceUnit)
                  : compactNumber(weekVolume)}</strong>
                <span>{weekCardio.distanceKm > 0 ? `${distanceUnit} running` : `${unit} volume`}</span>
              </div>
            </div>
            <div className="week-bars" aria-label={weekWorkouts.length + ' workouts this week'}>
              {Array.from({ length: 7 }, (_, index) => {
                const date = new Date()
                date.setDate(date.getDate() - (6 - index))
                const trained = weekWorkouts.some(
                  (workout) => new Date(workout.startedAt).toDateString() === date.toDateString(),
                )
                return (
                  <div key={index} className={trained ? 'trained' : ''}>
                    <i />
                    <span>{formatDate(date, { weekday: 'narrow' })}</span>
                  </div>
                )
              })}
            </div>
          </section>

          <section className="recent-panel">
            <div className="section-heading section-heading--small">
              <div>
                <span className="section-kicker">RECENT</span>
                <h2>Last workout</h2>
              </div>
            </div>
            {latestWorkout ? (
              <button className="recent-workout" onClick={() => openWorkout(latestWorkout)}>
                <div className="date-tile">
                  <span>{formatDate(latestWorkout.startedAt, { month: 'short' })}</span>
                  <strong>{formatDate(latestWorkout.startedAt, { day: '2-digit' })}</strong>
                </div>
                <div>
                  <strong>{latestWorkout.name}</strong>
                  <span>{latestCardio?.distanceKm > 0
                    ? `${formatCardioDistance(latestCardio.distanceKm, distanceUnit)} ${distanceUnit} · ${formatCardioPace(latestCardio.paceSecondsPerKm, distanceUnit)}`
                    : `${latestWorkout.exercises.length} exercises · ${Math.round(latestWorkout.durationSeconds / 60)} min`}</span>
                </div>
                <ChevronRight size={18} />
              </button>
            ) : (
              <p className="muted-copy">Your first completed workout will appear here.</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  )
}

function LiveWorkout({
  workout,
  elapsedSeconds,
  unit,
  distanceUnit,
  exerciseMap,
  previousWorkouts,
  updateActiveWorkout,
  updateSet,
  toggleSet,
  addSet,
  removeSet,
  openExercisePicker,
  openExercise,
  openExerciseMenu,
  openSetOptions,
  openTools,
  openFinish,
  openDiscard,
  toggleWorkoutTimer,
}) {
  const cardioSummary = getCardioSummary(workout, exerciseMap, { completedOnly: false })
  const completedCardio = getCardioSummary(workout, exerciseMap)
  const cardioOnly = workoutIsCardioOnly(workout, exerciseMap)
  const completedWork = completedSetCount(workout)
  const completedStrengthWork = Math.max(0, completedWork - completedCardio.segmentCount)
  const hybrid = completedCardio.segmentCount > 0 && completedStrengthWork > 0
  const completedWorkLabel = cardioOnly
    ? completedWork === 1 ? 'split' : 'splits'
    : completedWork === 1 ? 'set' : 'sets'
  return (
    <div className="live-workout content-width content-width--narrow">
      <div className="live-header">
        <div className="live-status">
          <span><i /> WORKOUT IN PROGRESS</span>
          <button className="live-timer-button" onClick={toggleWorkoutTimer}>
            {workout.pausedAt ? <Play size={14} fill="currentColor" /> : <Pause size={14} fill="currentColor" />}
            <strong>{formatDuration(elapsedSeconds)}</strong>
            <span>{workout.pausedAt ? 'RESUME' : 'PAUSE'}</span>
          </button>
        </div>
        <div className="live-title-row">
          <input
            className="workout-title-input"
            value={workout.name}
            onChange={(event) => updateActiveWorkout({ ...workout, name: event.target.value })}
            aria-label="Workout name"
          />
          <div className="live-title-actions">
            <button className="icon-button icon-button--light" onClick={openTools} aria-label="Open workout tools">
              <Wrench size={19} />
            </button>
            <button className="icon-button icon-button--light" onClick={openDiscard} aria-label="Workout options">
              <MoreVertical size={21} />
            </button>
          </div>
        </div>
        <div className="live-summary">
          {cardioSummary.distanceKm > 0 && (
            <span>{formatCardioDistance(cardioSummary.distanceKm, distanceUnit)} {distanceUnit}</span>
          )}
          {cardioSummary.paceSecondsPerKm > 0 && (
            <span>{formatCardioPace(cardioSummary.paceSecondsPerKm, distanceUnit)} pace</span>
          )}
          {!cardioOnly && <span>{workout.exercises.length} exercises</span>}
          {hybrid ? (
            <>
              <span>{completedCardio.segmentCount} {completedCardio.segmentCount === 1 ? 'split' : 'splits'} logged</span>
              <span>{completedStrengthWork} {completedStrengthWork === 1 ? 'set' : 'sets'} complete</span>
            </>
          ) : (
            <span>{completedWork} {completedWorkLabel} complete</span>
          )}
          {!cardioOnly && <span>{compactNumber(workoutVolume(workout))} {unit}</span>}
        </div>
      </div>

      <div className="exercise-stack">
        {workout.exercises.map((item, itemIndex) => {
          const exercise = exerciseMap.get(item.exerciseId)
          const trackingType = getTrackingType(exercise)
          const previous = previousWorkouts
            .map((past) => past.exercises?.find((entry) => entry.exerciseId === item.exerciseId))
            .find(Boolean)
          return (
            <motion.section
              layout
              className={'log-exercise ' + (item.supersetId ? 'is-superset' : '')}
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="log-exercise-head">
                {item.supersetId && <span className="superset-mark"><Link2 size={12} /> SUPERSET</span>}
                <button className="exercise-title-button" onClick={() => openExercise(item.exerciseId)}>
                  <span className="exercise-number">{String(itemIndex + 1).padStart(2, '0')}</span>
                  <span>
                    <strong>{exercise?.name || 'Exercise'}</strong>
                    <small>
                      {exercise?.primaryMuscle} · {exercise?.equipment}
                      {item.targetMinReps ? ' · target ' + item.targetMinReps + (item.targetMaxReps && item.targetMaxReps !== item.targetMinReps ? '–' + item.targetMaxReps : '') + ' reps' : ''}
                    </small>
                  </span>
                  <CircleHelp size={17} />
                </button>
                <button
                  className="icon-button icon-button--quiet"
                  aria-label={'Options for ' + (exercise?.name || 'exercise')}
                  onClick={() => openExerciseMenu(item.id)}
                >
                  <Ellipsis size={21} />
                </button>
              </div>

              {trackingType === 'cardio' ? (
                <CardioTracker
                  item={item}
                  exercise={exercise}
                  previous={previous}
                  distanceUnit={distanceUnit}
                  updateSet={updateSet}
                  toggleSet={toggleSet}
                  addSet={addSet}
                  removeSet={removeSet}
                />
              ) : (
                <>
              <div className="set-grid set-grid--header" aria-hidden="true">
                <span>SET</span>
                <span>PREVIOUS</span>
                <span>{trackingType === 'duration' ? 'SECONDS' : unit.toUpperCase()}</span>
                <span>{trackingType === 'distance' ? 'METERS' : trackingType === 'duration' ? '—' : 'REPS'}</span>
                <span>RPE</span>
                <span />
              </div>

              <div className="set-list">
                {item.sets.map((set, setIndex) => {
                  const previousSet = previous?.sets?.[setIndex]
                  return (
                    <div
                      className={'set-grid set-row ' + (set.completed ? 'is-complete' : '')}
                      key={set.id}
                      data-set-id={set.id}
                    >
                      <button
                        className={'set-number set-number--' + (set.type || 'normal')}
                        onClick={() => openSetOptions(item.id, set.id)}
                        title="Set type and options"
                        aria-label={'Options for set ' + (setIndex + 1) + ', ' + (set.type || 'normal')}
                      >
                        {set.type === 'warmup' ? 'W' : set.type === 'drop' ? 'D' : set.type === 'failure' ? 'F' : setIndex + 1}
                      </button>
                      <span className="previous-value">
                        {previousSetLabel(previousSet, trackingType)}
                      </span>
                      {trackingType === 'duration' ? (
                        <input
                          inputMode="numeric"
                          type="number"
                          min="0"
                          value={set.duration ?? ''}
                          placeholder="—"
                          aria-label={'Set ' + (setIndex + 1) + ' duration in seconds'}
                          onChange={(event) => updateSet(item.id, set.id, 'duration', event.target.value)}
                        />
                      ) : (
                        <input
                          inputMode="decimal"
                          type="number"
                          min="0"
                          step="0.5"
                          value={set.weight}
                          placeholder="—"
                          aria-label={'Set ' + (setIndex + 1) + ' weight in ' + unit}
                          onChange={(event) => updateSet(item.id, set.id, 'weight', event.target.value)}
                        />
                      )}
                      {trackingType === 'duration' ? (
                        <span className="set-static-value">TIME</span>
                      ) : trackingType === 'distance' ? (
                        <input
                          inputMode="decimal"
                          type="number"
                          min="0"
                          step="1"
                          value={set.distance ?? ''}
                          placeholder="—"
                          aria-label={'Set ' + (setIndex + 1) + ' distance in meters'}
                          onChange={(event) => updateSet(item.id, set.id, 'distance', event.target.value)}
                        />
                      ) : (
                        <input
                          inputMode="numeric"
                          type="number"
                          min="0"
                          value={set.reps}
                          placeholder="—"
                          aria-label={'Set ' + (setIndex + 1) + ' repetitions'}
                          onChange={(event) => updateSet(item.id, set.id, 'reps', event.target.value)}
                        />
                      )}
                      <input
                        inputMode="decimal"
                        type="number"
                        min="1"
                        max="10"
                        step="0.5"
                        value={set.rpe}
                        placeholder="—"
                        aria-label={'Set ' + (setIndex + 1) + ' RPE'}
                        onChange={(event) => updateSet(item.id, set.id, 'rpe', event.target.value)}
                      />
                      <button
                        className="complete-set"
                        onClick={() => toggleSet(item.id, set.id)}
                        aria-label={set.completed ? 'Mark set incomplete' : 'Complete set'}
                      >
                        <Check size={18} strokeWidth={3} />
                      </button>
                    </div>
                  )
                })}
              </div>

              <button className="add-set-button" onClick={() => addSet(item.id)}>
                <Plus size={15} /> Add set
              </button>
                </>
              )}

              <textarea
                className="exercise-notes"
                placeholder="Add a note for this exercise…"
                value={item.notes}
                rows={1}
                onChange={(event) =>
                  updateActiveWorkout({
                    ...workout,
                    exercises: workout.exercises.map((exercise) =>
                      exercise.id === item.id ? { ...exercise, notes: event.target.value } : exercise,
                    ),
                  })
                }
                aria-label={'Notes for ' + (exercise?.name || 'exercise')}
              />
            </motion.section>
          )
        })}
      </div>

      {workout.exercises.length === 0 && (
        <div className="empty-workout">
          <span className="empty-icon"><Dumbbell size={28} /></span>
          <h2>Add your first exercise</h2>
          <p>Choose from {exerciseMap.size} movements with setup instructions and coaching cues.</p>
        </div>
      )}

      <label className="session-notes">
        <span>SESSION NOTES</span>
        <textarea
          rows={2}
          value={workout.notes || ''}
          onChange={(event) => updateActiveWorkout({ ...workout, notes: event.target.value })}
          placeholder="How did the session feel? Add context for next time…"
        />
      </label>

      <div className="live-actions">
        <button className="button button--outline button--wide" onClick={openExercisePicker}>
          <ListPlus size={18} /> Add exercise
        </button>
        <button
          className="button button--accent button--wide"
          onClick={openFinish}
          disabled={completedSetCount(workout) === 0}
        >
          <Check size={18} /> Finish workout
        </button>
      </div>
    </div>
  )
}

function HistoryView({ workouts, unit, distanceUnit, exerciseMap, openWorkout, startWorkout }) {
  const grouped = useMemo(() => {
    const groups = new Map()
    workouts.forEach((workout) => {
      const key = formatDate(workout.startedAt, { month: 'long', year: 'numeric' })
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(workout)
    })
    return [...groups.entries()]
  }, [workouts])

  return (
    <div className="content-width">
      <ViewHeader
        eyebrow="TRAINING LOG"
        title="Workout history"
        subtitle={workouts.length + ' sessions saved on this device.'}
        action={
          <button className="button button--dark desktop-action" onClick={() => startWorkout(null)}>
            <Plus size={17} /> New workout
          </button>
        }
      />

      {grouped.length ? (
        <div className="history-groups">
          {grouped.map(([month, entries]) => (
            <section className="history-group" key={month}>
              <div className="history-month">
                <h2>{month}</h2>
                <span>{entries.length} {entries.length === 1 ? 'session' : 'sessions'}</span>
              </div>
              <div className="history-list">
                {entries.map((workout) => {
                  const cardio = getCardioSummary(workout, exerciseMap)
                  const cardioOnly = workoutIsCardioOnly(workout, exerciseMap)
                  const strengthSetCount = Math.max(0, completedSetCount(workout) - cardio.segmentCount)
                  return (
                  <button className="history-row" key={workout.id} onClick={() => openWorkout(workout)}>
                    <div className="history-date">
                      <strong>{formatDate(workout.startedAt, { day: '2-digit' })}</strong>
                      <span>{formatDate(workout.startedAt, { weekday: 'short' })}</span>
                    </div>
                    <div className="history-main">
                      <strong>{workout.name} {workout.isSample && <em className="sample-tag">SAMPLE</em>}</strong>
                      <span>
                        {cardio.distanceKm > 0
                          ? `${formatCardioDistance(cardio.distanceKm, distanceUnit)} ${distanceUnit} · ${formatCardioPace(cardio.paceSecondsPerKm, distanceUnit)}${!cardioOnly && strengthSetCount ? ` · ${strengthSetCount} lifting ${strengthSetCount === 1 ? 'set' : 'sets'}` : ''}`
                          : workout.exercises.slice(0, 3).map((item) => exerciseMap.get(item.exerciseId)?.name).filter(Boolean).join(' · ')}
                        {!cardio.distanceKm && workout.exercises.length > 3 ? ' +' + (workout.exercises.length - 3) : ''}
                      </span>
                    </div>
                    <div className="history-stats">
                      <span><Clock3 size={14} /> {Math.round((cardioOnly && cardio.totalDurationSeconds ? cardio.totalDurationSeconds : workout.durationSeconds) / 60)} min</span>
                      {cardio.distanceKm > 0 ? (
                        <span><Activity size={14} /> {formatCardioDistance(cardio.distanceKm, distanceUnit)} {distanceUnit} · {formatCardioPace(cardio.paceSecondsPerKm, distanceUnit)}</span>
                      ) : (
                        <span><Dumbbell size={14} /> {compactNumber(workoutVolume(workout))} {unit}</span>
                      )}
                      {cardio.distanceKm > 0 && workoutVolume(workout) > 0 && (
                        <span><Dumbbell size={14} /> {compactNumber(workoutVolume(workout))} {unit}</span>
                      )}
                    </div>
                    <ChevronRight size={19} />
                  </button>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={History}
          title="No workouts yet"
          body="Finish your first session and it will be kept here on this device."
          actionLabel="Start a workout"
          onAction={() => startWorkout(null)}
        />
      )}
    </div>
  )
}

function LibraryView({ allExercises, openExercise, openCreate }) {
  const [search, setSearch] = useState('')
  const [muscle, setMuscle] = useState('All')
  const [equipment, setEquipment] = useState('All')

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return allExercises.filter((exercise) => {
      const matchesQuery =
        !query ||
        exercise.name.toLowerCase().includes(query) ||
        exercise.primaryMuscle.toLowerCase().includes(query) ||
        exercise.equipment.toLowerCase().includes(query) ||
        exercise.pattern.toLowerCase().includes(query)
      return (
        matchesQuery &&
        (muscle === 'All' || exercise.primaryMuscle === muscle) &&
        (equipment === 'All' || exercise.equipment === equipment)
      )
    })
  }, [allExercises, search, muscle, equipment])

  return (
    <div className="content-width">
      <ViewHeader
        eyebrow={allExercises.length + ' GUIDED MOVEMENTS'}
        title="Exercise library"
        subtitle="Clear setup, movement steps, and coaching cues for every exercise."
        action={
          <button className="button button--dark library-create" onClick={openCreate}>
            <Plus size={17} /> Custom exercise
          </button>
        }
      />

      <div className="library-tools">
        <label className="search-box">
          <Search size={19} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search exercise, muscle, or equipment"
            aria-label="Search exercises"
          />
          {search && (
            <button onClick={() => setSearch('')} aria-label="Clear search">
              <X size={16} />
            </button>
          )}
        </label>

        <div className="filter-scroller" aria-label="Filter by muscle group">
          {['All', ...muscleGroups].map((group) => (
            <button
              key={group}
              className={'filter-chip ' + (muscle === group ? 'is-active' : '')}
              onClick={() => setMuscle(group)}
            >
              {group}
            </button>
          ))}
        </div>

        <div className="equipment-filter">
          <label htmlFor="equipment-filter">Equipment</label>
          <select id="equipment-filter" value={equipment} onChange={(event) => setEquipment(event.target.value)}>
            {['All', ...equipmentOptions].map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
          <span>{filtered.length} results</span>
        </div>
      </div>

      {filtered.length ? (
        <div className="exercise-directory">
          {filtered.map((exercise, index) => (
            <motion.button
              className="directory-row"
              key={exercise.id}
              onClick={() => openExercise(exercise.id)}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index * 0.012, 0.2) }}
              layout
            >
              <span className="directory-monogram">{exercise.name.split(' ').slice(0, 2).map((word) => word[0]).join('')}</span>
              <span className="directory-main">
                <strong>{exercise.name}</strong>
                <small>{exercise.custom ? 'Custom · ' : ''}{exercise.pattern} · {exercise.equipment}</small>
              </span>
              <span className="muscle-label">{exercise.primaryMuscle}</span>
              <span className={'difficulty difficulty--' + exercise.difficulty.toLowerCase()}>{exercise.difficulty}</span>
              <ChevronRight size={19} />
            </motion.button>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Search}
          title="No matching exercises"
          body="Try a different name, muscle group, or equipment filter."
          actionLabel="Clear filters"
          onAction={() => {
            setSearch('')
            setMuscle('All')
            setEquipment('All')
          }}
        />
      )}
    </div>
  )
}

function ProgressView({
  workouts,
  unit,
  exerciseMap,
  measurements,
  addMeasurement,
  deleteMeasurement,
  photos,
  addProgressPhoto,
  deleteProgressPhoto,
  openWorkout,
}) {
  const [section, setSection] = useState('overview')
  const last30 = workouts.filter(
    (workout) => new Date(workout.startedAt).getTime() >= Date.now() - 30 * 86400000,
  )
  const totalVolume = last30.reduce((total, workout) => total + workoutVolume(workout), 0)
  const totalSets = last30.reduce((total, workout) => total + completedSetCount(workout), 0)
  const averageMinutes = last30.length
    ? Math.round(last30.reduce((total, workout) => total + workout.durationSeconds, 0) / last30.length / 60)
    : 0
  const prs = getPersonalRecords(workouts)
  const weekly = getWeeklyVolume(workouts)

  return (
    <div className="content-width">
      <ViewHeader
        eyebrow="TRAINING INTELLIGENCE"
        title="Training progress"
        subtitle="Consistency, muscle balance, strength records, and body metrics—kept private."
      />

      <div className="progress-tabs" role="tablist" aria-label="Progress views">
        {[
          ['overview', 'Overview'],
          ['calendar', 'Calendar'],
          ['body', 'Body'],
        ].map(([id, label]) => (
          <button
            key={id}
            className={section === id ? 'is-active' : ''}
            onClick={() => setSection(id)}
            role="tab"
            aria-selected={section === id}
          >
            {label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {section === 'overview' && (
          <motion.div key="overview" {...MOTION}>
            <section className="metric-band">
              <div>
                <span>SESSIONS · 30D</span>
                <strong>{last30.length}</strong>
                <small>{last30.length >= 8 ? 'Strong consistency' : 'Keep building rhythm'}</small>
              </div>
              <div>
                <span>WORKING SETS</span>
                <strong>{totalSets}</strong>
                <small>Completed sets</small>
              </div>
              <div>
                <span>VOLUME</span>
                <strong>{compactNumber(totalVolume)}</strong>
                <small>{unit} moved</small>
              </div>
              <div>
                <span>AVG. SESSION</span>
                <strong>{averageMinutes}</strong>
                <small>minutes</small>
              </div>
            </section>

            <div className="progress-layout">
              <section className="chart-section">
                <div className="section-heading">
                  <div>
                    <span className="section-kicker">TRAINING LOAD</span>
                    <h2>Weekly volume</h2>
                  </div>
                  <span className="chart-unit">{unit}</span>
                </div>
                <VolumeChart data={weekly} />
              </section>

              <section className="records-section">
                <div className="section-heading">
                  <div>
                    <span className="section-kicker">BEST SETS</span>
                    <h2>Personal records</h2>
                  </div>
                </div>
                <div className="record-list">
                  {prs.slice(0, 5).map((record, index) => (
                    <div className="record-row" key={record.exerciseId}>
                      <span className="record-rank">{String(index + 1).padStart(2, '0')}</span>
                      <span className="record-main">
                        <strong>{exerciseMap.get(record.exerciseId)?.name || 'Exercise'}</strong>
                        <small>Estimated 1RM</small>
                      </span>
                      <span className="record-value">
                        <strong>{record.estimate}</strong>
                        <small>{unit}</small>
                      </span>
                    </div>
                  ))}
                  {!prs.length && <p className="muted-copy">Complete weighted sets to see records here.</p>}
                </div>
              </section>
            </div>
            <Suspense fallback={<FeatureLoader compact />}>
              <MuscleBreakdown workouts={workouts} exerciseMap={exerciseMap} />
            </Suspense>
          </motion.div>
        )}
        {section === 'calendar' && (
          <motion.div key="calendar" {...MOTION}>
            <Suspense fallback={<FeatureLoader compact />}>
              <TrainingCalendar workouts={workouts} onSelectWorkout={openWorkout} />
            </Suspense>
          </motion.div>
        )}
        {section === 'body' && (
          <motion.div key="body" {...MOTION}>
            <Suspense fallback={<FeatureLoader compact />}>
              <MeasurementsPanel
                measurements={measurements}
                onAdd={addMeasurement}
                onDelete={deleteMeasurement}
                unit={unit}
              />
              <ProgressPhotos
                photos={photos}
                onAdd={addProgressPhoto}
                onDelete={deleteProgressPhoto}
              />
            </Suspense>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function getWeeklyVolume(workouts) {
  return Array.from({ length: 6 }, (_, reverseIndex) => {
    const weeksAgo = 5 - reverseIndex
    const end = new Date()
    end.setHours(23, 59, 59, 999)
    end.setDate(end.getDate() - weeksAgo * 7)
    const start = new Date(end)
    start.setDate(start.getDate() - 6)
    start.setHours(0, 0, 0, 0)
    const value = workouts
      .filter((workout) => {
        const date = new Date(workout.startedAt)
        return date >= start && date <= end
      })
      .reduce((total, workout) => total + workoutVolume(workout), 0)
    return {
      label: formatDate(end, { month: 'short', day: 'numeric' }),
      value,
    }
  })
}

function getPersonalRecords(workouts) {
  const records = new Map()
  workouts.forEach((workout) => {
    workout.exercises?.forEach((exercise) => {
      exercise.sets?.forEach((set) => {
        if (!set.completed || !Number(set.weight) || !Number(set.reps)) return
        const estimate = Math.round(Number(set.weight) * (1 + Number(set.reps) / 30) * 10) / 10
        if (!records.has(exercise.exerciseId) || estimate > records.get(exercise.exerciseId).estimate) {
          records.set(exercise.exerciseId, {
            exerciseId: exercise.exerciseId,
            estimate,
            weight: Number(set.weight),
            reps: Number(set.reps),
          })
        }
      })
    })
  })
  return [...records.values()].sort((a, b) => b.estimate - a.estimate)
}

function VolumeChart({ data }) {
  const max = Math.max(...data.map((item) => item.value), 1)
  const points = data.map((item, index) => ({
    x: 18 + index * (364 / Math.max(data.length - 1, 1)),
    y: 154 - (item.value / max) * 116,
    ...item,
  }))
  const line = points.map((point, index) => (index === 0 ? 'M ' : 'L ') + point.x + ' ' + point.y).join(' ')
  const area = line + ' L ' + points.at(-1).x + ' 168 L ' + points[0].x + ' 168 Z'

  return (
    <div className="chart-wrap">
      <svg viewBox="0 0 400 200" role="img" aria-label="Weekly workout volume">
        {[38, 78, 118, 158].map((y) => (
          <line key={y} x1="18" y1={y} x2="382" y2={y} className="chart-gridline" />
        ))}
        <motion.path
          d={area}
          className="chart-area"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        />
        <motion.path
          d={line}
          className="chart-line"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        />
        {points.map((point) => (
          <g key={point.label}>
            <circle cx={point.x} cy={point.y} r="4.5" className="chart-dot" />
            <text x={point.x} y="192" textAnchor="middle" className="chart-label">{point.label}</text>
          </g>
        ))}
      </svg>
    </div>
  )
}

function Sheet({ children, onClose, kind = '', wide = false, share = false, hideClose = false }) {
  const backdropRef = useRef(null)

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  useEffect(() => {
    if (kind !== 'picker') return undefined

    const viewport = window.visualViewport
    const syncVisualViewport = () => {
      const backdrop = backdropRef.current
      if (!backdrop) return
      backdrop.style.setProperty('--visual-viewport-height', `${viewport?.height || window.innerHeight}px`)
      backdrop.style.setProperty('--visual-viewport-top', `${viewport?.offsetTop || 0}px`)
    }

    syncVisualViewport()
    viewport?.addEventListener('resize', syncVisualViewport)
    viewport?.addEventListener('scroll', syncVisualViewport)
    window.addEventListener('resize', syncVisualViewport)
    return () => {
      viewport?.removeEventListener('resize', syncVisualViewport)
      viewport?.removeEventListener('scroll', syncVisualViewport)
      window.removeEventListener('resize', syncVisualViewport)
    }
  }, [kind])

  return (
    <motion.div
      ref={backdropRef}
      className={'sheet-backdrop ' + (kind === 'picker' ? 'sheet-backdrop--picker' : '')}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <motion.div
        className={'sheet ' + (wide ? 'sheet--wide ' : '') + (share ? 'sheet--share ' : '') + (kind === 'picker' ? 'sheet--picker' : '')}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 32, stiffness: 350 }}
        role="dialog"
        aria-modal="true"
      >
        <div className="sheet-handle" />
        {!hideClose && (
          <button className="sheet-close icon-button" onClick={onClose} aria-label="Close dialog">
            <X size={20} />
          </button>
        )}
        {children}
      </motion.div>
    </motion.div>
  )
}

function SheetHeading({ eyebrow, title, body, back }) {
  return (
    <div className="sheet-heading">
      {back && (
        <button className="sheet-back" onClick={back}>
          <ArrowLeft size={17} /> Back
        </button>
      )}
      <span className="section-kicker">{eyebrow}</span>
      <h2>{title}</h2>
      {body && <p>{body}</p>}
    </div>
  )
}

function ExercisePicker({ allExercises, currentIds, addExercise, openDetails }) {
  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState('All')
  const results = allExercises.filter((exercise) => {
    const search = query.toLowerCase()
    return (
      (!query ||
        exercise.name.toLowerCase().includes(search) ||
        exercise.primaryMuscle.toLowerCase().includes(search)) &&
      (muscle === 'All' || exercise.primaryMuscle === muscle)
    )
  })

  return (
    <div className="sheet-content picker-content">
      <SheetHeading
        eyebrow="EXERCISE LIBRARY"
        title="Add an exercise"
        body={'Search all ' + allExercises.length + ' guided movements.'}
      />
      <label className="search-box search-box--sheet">
        <Search size={19} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search exercises" autoFocus />
      </label>
      <div className="filter-scroller picker-filters">
        {['All', ...muscleGroups].map((group) => (
          <button
            className={'filter-chip ' + (muscle === group ? 'is-active' : '')}
            key={group}
            onClick={() => setMuscle(group)}
          >
            {group}
          </button>
        ))}
      </div>
      <div className="picker-list">
        {results.map((exercise) => {
          const added = currentIds.includes(exercise.id)
          return (
            <div className="picker-row" key={exercise.id}>
              <button className="picker-details" onClick={() => openDetails(exercise.id)}>
                <span className="directory-monogram">{exercise.name.split(' ').slice(0, 2).map((word) => word[0]).join('')}</span>
                <span>
                  <strong>{exercise.name}</strong>
                  <small>{exercise.primaryMuscle} · {exercise.equipment}</small>
                </span>
              </button>
              <button
                className={'picker-add ' + (added ? 'is-added' : '')}
                onClick={() => !added && addExercise(exercise.id)}
                disabled={added}
                aria-label={added ? exercise.name + ' already added' : 'Add ' + exercise.name}
              >
                {added ? <Check size={17} /> : <Plus size={18} />}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ExerciseDetail({
  exercise,
  workouts,
  unit,
  distanceUnit,
  canAdd,
  addExercise,
  goBack,
  editCustom,
  deleteCustom,
}) {
  if (!exercise) return null
  return (
    <div className="sheet-content exercise-detail">
      <SheetHeading
        eyebrow={exercise.primaryMuscle + ' · ' + exercise.equipment}
        title={exercise.name}
        body={exercise.pattern + ' · ' + exercise.difficulty}
        back={goBack}
      />

      {exercise.id === 'barbell-back-squat' && (
        <div className="instruction-image">
          <img src="./training-hero.jpg" alt="Athlete preparing for a barbell back squat" />
          <span>BARBELL BACK SQUAT · SETUP</span>
        </div>
      )}

      <ExerciseMuscleMap exercise={exercise} />

      <div className="instruction-layout">
        <section>
          <div className="instruction-title">
            <span>HOW TO</span>
            <small>{exercise.instructions.length} STEPS</small>
          </div>
          <ol className="instruction-steps">
            {exercise.instructions.map((instruction, index) => (
              <li key={instruction}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <p>{instruction}</p>
              </li>
            ))}
          </ol>
        </section>

        <aside className="cue-panel">
          <div className="instruction-title">
            <span>COACHING CUES</span>
          </div>
          <ul>
            {exercise.cues.map((cue) => (
              <li key={cue}><Zap size={14} fill="currentColor" /> {cue}</li>
            ))}
          </ul>
          <div className="safety-note">
            <Info size={17} />
            <p>Use a load you can control. Stop if you feel sharp pain, dizziness, or unusual discomfort.</p>
          </div>
        </aside>
      </div>

      <ExercisePerformance exercise={exercise} workouts={workouts} unit={unit} distanceUnit={distanceUnit} />

      {exercise.custom && (
        <div className="custom-detail-actions">
          <button onClick={editCustom}><Settings size={16} /> Edit custom exercise</button>
          <button onClick={deleteCustom}><Trash2 size={16} /> Delete</button>
        </div>
      )}

      {canAdd && (
        <div className="sheet-sticky-action">
          <button className="button button--accent button--wide" onClick={() => addExercise(exercise.id)}>
            <Plus size={18} /> Add to workout
          </button>
        </div>
      )}
    </div>
  )
}

function WorkoutDaySheet({ workouts, unit, distanceUnit, exerciseMap, openWorkout }) {
  const date = workouts[0]?.startedAt || workouts[0]?.completedAt
  return (
    <div className="sheet-content workout-day-sheet">
      <SheetHeading
        eyebrow="TRAINING DAY"
        title={formatDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}
        body={workouts.length + ' sessions were completed on this day.'}
      />
      <div className="workout-day-list">
        {workouts.map((workout) => {
          const cardio = getCardioSummary(workout, exerciseMap)
          const cardioOnly = workoutIsCardioOnly(workout, exerciseMap)
          return (
          <button key={workout.id} onClick={() => openWorkout(workout)}>
            <span>
              <strong>{workout.name}</strong>
              <small>
                {workout.exercises.slice(0, 3)
                  .map((item) => exerciseMap.get(item.exerciseId)?.name)
                  .filter(Boolean)
                  .join(' · ')}
              </small>
            </span>
            <span>
              <strong>{Math.round((cardioOnly && cardio.totalDurationSeconds ? cardio.totalDurationSeconds : workout.durationSeconds) / 60)} min</strong>
              <small>{cardio.distanceKm > 0
                ? `${formatCardioDistance(cardio.distanceKm, distanceUnit)} ${distanceUnit} · ${formatCardioPace(cardio.paceSecondsPerKm, distanceUnit)}`
                : `${compactNumber(workoutVolume(workout))} ${unit}`}</small>
            </span>
            <ChevronRight size={18} />
          </button>
          )
        })}
      </div>
    </div>
  )
}

function WorkoutDetail({
  workout,
  unit,
  distanceUnit,
  exerciseMap,
  updateWorkout,
  deleteWorkout,
  repeatWorkout,
  openShare,
  saveWorkoutAsRoutine,
}) {
  const [editing, setEditing] = useState(false)
  const [deleteArmed, setDeleteArmed] = useState(false)
  const [name, setName] = useState(workout?.name || '')
  const [date, setDate] = useState(workout?.startedAt ? new Date(workout.startedAt).toISOString().slice(0, 10) : '')
  if (!workout) return null
  const cardio = getCardioSummary(workout, exerciseMap)
  const cardioOnly = workoutIsCardioOnly(workout, exerciseMap)
  const strengthSetCount = Math.max(0, completedSetCount(workout) - cardio.segmentCount)
  const hybrid = cardio.distanceKm > 0 && strengthSetCount > 0
  const summaryBody = hybrid
    ? `${formatCardioDistance(cardio.distanceKm, distanceUnit)} ${distanceUnit} · ${formatCardioPace(cardio.paceSecondsPerKm, distanceUnit)} · ${strengthSetCount} lifting ${strengthSetCount === 1 ? 'set' : 'sets'} · ${compactNumber(workoutVolume(workout))} ${unit}`
    : cardioOnly && cardio.distanceKm > 0
    ? `${formatCardioTime(cardio.totalDurationSeconds)} · ${formatCardioDistance(cardio.distanceKm, distanceUnit)} ${distanceUnit} · ${formatCardioPace(cardio.paceSecondsPerKm, distanceUnit)}`
    : Math.round(workout.durationSeconds / 60) + ' min · ' + completedSetCount(workout) + ' sets · ' + compactNumber(workoutVolume(workout)) + ' ' + unit
  const saveDetails = () => {
    const nextDate = new Date(workout.startedAt)
    const [year, month, day] = date.split('-').map(Number)
    nextDate.setFullYear(year, month - 1, day)
    updateWorkout(workout.id, { name: name.trim() || 'Workout', startedAt: nextDate.toISOString() })
    setEditing(false)
  }
  return (
    <div className="sheet-content workout-detail">
      <SheetHeading
        eyebrow={formatDate(workout.startedAt, { weekday: 'long', day: 'numeric', month: 'long' })}
        title={workout.name}
        body={summaryBody}
      />
      <div className="workout-detail-actions">
        <button onClick={() => setEditing((value) => !value)}><Settings size={16} /> Edit</button>
        <button onClick={() => repeatWorkout(workout)}><Copy size={16} /> Repeat</button>
        <button onClick={() => openShare(workout)}><Share2 size={16} /> Share</button>
        <button className="save-routine-action" onClick={() => saveWorkoutAsRoutine(workout)}>
          <ListPlus size={16} /> Save as routine
        </button>
      </div>
      {editing && (
        <div className="workout-edit-form">
          <label>
            <span>WORKOUT NAME</span>
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label>
            <span>DATE</span>
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
          <button className="button button--dark button--wide" onClick={saveDetails}>Save changes</button>
        </div>
      )}
      {cardio.distanceKm > 0 && (
        <div className="workout-cardio-summary">
          <div><span>DISTANCE</span><strong>{formatCardioDistance(cardio.distanceKm, distanceUnit)} <small>{distanceUnit}</small></strong></div>
          <div><span>PACE</span><strong>{formatCardioPace(cardio.paceSecondsPerKm, distanceUnit)}</strong></div>
          <div><span>AVG SPEED</span><strong>{formatCardioSpeed(cardio.averageSpeedKph, distanceUnit)}</strong></div>
        </div>
      )}
      <div className="workout-detail-list">
        {workout.exercises.map((item, index) => {
          const exercise = exerciseMap.get(item.exerciseId)
          const trackingType = getTrackingType(exercise)
          const completedCount = item.sets.filter((set) => set.completed).length
          const workLabel = trackingType === 'cardio'
            ? completedCount === 1 ? 'split' : 'splits'
            : completedCount === 1 ? 'set' : 'sets'
          return (
            <section key={item.id}>
              <div className="workout-detail-exercise">
                <span>{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <strong>{exercise?.name || 'Exercise'}</strong>
                  <small>{exercise?.primaryMuscle} · {completedCount} {workLabel}</small>
                </div>
              </div>
              <div className="readonly-sets">
                {item.sets.filter((set) => set.completed).map((set, setIndex) => (
                  <div key={set.id}>
                    <span>{trackingType === 'cardio' ? 'SPLIT' : 'SET'} {setIndex + 1}</span>
                    <strong>{completedSetLabel(set, trackingType, unit, distanceUnit)}</strong>
                    <small>{set.rpe ? 'RPE ' + set.rpe : '—'}</small>
                  </div>
                ))}
              </div>
              {item.notes && <p className="detail-note">{item.notes}</p>}
            </section>
          )
        })}
      </div>
      {workout.notes && (
        <div className="session-note-detail">
          <span>SESSION NOTES</span>
          <p>{workout.notes}</p>
        </div>
      )}
      <div className="local-badge"><LockKeyhole size={15} /> Stored locally on this device</div>
      {!deleteArmed ? (
        <button className="delete-history-button" onClick={() => setDeleteArmed(true)}>
          <Trash2 size={15} /> Delete workout
        </button>
      ) : (
        <div className="delete-history-confirm">
          <span>Delete this workout permanently?</span>
          <button onClick={() => setDeleteArmed(false)}>Cancel</button>
          <button onClick={() => deleteWorkout(workout.id)}>Delete</button>
        </div>
      )}
    </div>
  )
}

function FinishWorkoutSheet({ workout, elapsedSeconds, unit, distanceUnit, exerciseMap, sourceRoutine, finishWorkout, cancel }) {
  const currentExerciseIds = workoutExerciseIds(workout)
  const cardio = getCardioSummary(workout, exerciseMap)
  const cardioOnly = workoutIsCardioOnly(workout, exerciseMap)
  const strengthSetCount = Math.max(0, completedSetCount(workout) - cardio.segmentCount)
  const hybrid = cardio.distanceKm > 0 && strengthSetCount > 0
  const routineChanged = sourceRoutine && !sameExerciseOrder(
    currentExerciseIds,
    sourceRoutine.exerciseIds || [],
  )
  const canCreateRoutine = currentExerciseIds.length > 0

  return (
    <div className="sheet-content compact-sheet">
      <span className="confirm-icon confirm-icon--success"><Check size={25} /></span>
      <SheetHeading
        eyebrow={hybrid ? 'HYBRID COMPLETE' : cardioOnly ? 'RUN COMPLETE' : 'SESSION COMPLETE'}
        title="Finish workout?"
        body={routineChanged
          ? 'You changed the exercise lineup. Choose what should happen to your routine.'
          : 'Review the session summary before saving it to your local history.'}
      />
      <div className="finish-summary">
        {hybrid ? (
          <>
            <div><span>DISTANCE</span><strong>{formatCardioDistance(cardio.distanceKm, distanceUnit)} <small>{distanceUnit}</small></strong></div>
            <div><span>PACE</span><strong>{formatCardioPace(cardio.paceSecondsPerKm, distanceUnit)}</strong></div>
            <div><span>LIFT VOLUME</span><strong>{compactNumber(workoutVolume(workout))} <small>{unit}</small></strong></div>
          </>
        ) : cardioOnly ? (
          <>
            <div><span>TIME</span><strong>{formatDuration(cardio.totalDurationSeconds || elapsedSeconds)}</strong></div>
            <div><span>DISTANCE</span><strong>{formatCardioDistance(cardio.distanceKm, distanceUnit)} <small>{distanceUnit}</small></strong></div>
            <div><span>PACE</span><strong>{formatCardioPace(cardio.paceSecondsPerKm, distanceUnit)}</strong></div>
          </>
        ) : (
          <>
            <div><span>TIME</span><strong>{formatDuration(elapsedSeconds)}</strong></div>
            <div><span>SETS</span><strong>{completedSetCount(workout)}</strong></div>
            <div><span>VOLUME</span><strong>{compactNumber(workoutVolume(workout))} <small>{unit}</small></strong></div>
          </>
        )}
      </div>
      {routineChanged ? (
        <div className="finish-routine-actions">
          <span>ROUTINE CHANGES</span>
          <button className="button button--accent button--wide" onClick={() => finishWorkout('update')}>
            <Check size={18} /> Update {sourceRoutine.name}
          </button>
          <button className="button button--outline button--wide" onClick={() => finishWorkout('create')}>
            <ListPlus size={18} /> Save as new routine
          </button>
          <button className="button button--ghost button--wide" onClick={() => finishWorkout('none')}>
            Save workout only
          </button>
        </div>
      ) : sourceRoutine ? (
        <button className="button button--accent button--wide" onClick={() => finishWorkout('none')}>
          <Check size={18} /> Save workout
        </button>
      ) : (
        <div className="finish-routine-actions">
          <span>SAVE THIS SESSION</span>
          <button
            className="button button--accent button--wide"
            onClick={() => finishWorkout('create')}
            disabled={!canCreateRoutine}
          >
            <ListPlus size={18} /> Save workout + new routine
          </button>
          <button className="button button--ghost button--wide" onClick={() => finishWorkout('none')}>
            Save workout only
          </button>
        </div>
      )}
      <button className="button button--ghost button--wide" onClick={cancel}>Keep training</button>
    </div>
  )
}

function ConfirmSheet({ icon: Icon, title, body, confirmLabel, onConfirm, onCancel, danger }) {
  return (
    <div className="sheet-content compact-sheet">
      <span className={'confirm-icon ' + (danger ? 'confirm-icon--danger' : '')}><Icon size={24} /></span>
      <SheetHeading eyebrow="PLEASE CONFIRM" title={title} body={body} />
      <button className={'button button--wide ' + (danger ? 'button--danger' : 'button--dark')} onClick={onConfirm}>
        {confirmLabel}
      </button>
      <button className="button button--ghost button--wide" onClick={onCancel}>Cancel</button>
    </div>
  )
}

function ExerciseActionsSheet({
  workout,
  workoutExerciseId,
  moveExercise,
  toggleSuperset,
  setExerciseRest,
  removeExercise,
  close,
}) {
  const index = workout?.exercises.findIndex((exercise) => exercise.id === workoutExerciseId) ?? -1
  const item = workout?.exercises[index]
  return (
    <div className="sheet-content compact-menu-sheet">
      <SheetHeading
        eyebrow="EXERCISE OPTIONS"
        title="Adjust exercise"
        body="Reorder the session, create a superset, or remove this movement."
      />
      <div className="exercise-action-list">
        <button onClick={() => moveExercise(workoutExerciseId, -1)} disabled={index <= 0}>
          <span>↑</span><div><strong>Move up</strong><small>Earlier in this workout</small></div><ChevronRight size={18} />
        </button>
        <button onClick={() => moveExercise(workoutExerciseId, 1)} disabled={index < 0 || index >= workout.exercises.length - 1}>
          <span>↓</span><div><strong>Move down</strong><small>Later in this workout</small></div><ChevronRight size={18} />
        </button>
        <button onClick={() => toggleSuperset(workoutExerciseId)} disabled={workout?.exercises.length < 2}>
          <span><Link2 size={17} /></span>
          <div>
            <strong>{item?.supersetId ? 'Remove superset' : 'Pair as superset'}</strong>
            <small>{item?.supersetId ? 'Unlink the grouped exercises' : 'Link with the adjacent exercise'}</small>
          </div>
          <ChevronRight size={18} />
        </button>
        <div className="exercise-rest-option">
          <div>
            <span><TimerReset size={17} /></span>
            <div><strong>Rest after sets</strong><small>Override the default for this exercise</small></div>
          </div>
          <div>
            {[60, 90, 120, 180].map((seconds) => (
              <button
                key={seconds}
                className={item?.restSeconds === seconds ? 'is-active' : ''}
                onClick={() => setExerciseRest(workoutExerciseId, seconds)}
              >
                {seconds < 120 ? seconds + 's' : seconds / 60 + 'm'}
              </button>
            ))}
          </div>
        </div>
        <button className="is-danger" onClick={() => removeExercise(workoutExerciseId)}>
          <span><Trash2 size={17} /></span><div><strong>Remove exercise</strong><small>Delete its sets from this session</small></div><ChevronRight size={18} />
        </button>
      </div>
      <button className="button button--ghost button--wide" onClick={close}>Cancel</button>
    </div>
  )
}

function CustomExerciseSheet({ initial, onSave }) {
  const [form, setForm] = useState(() => ({
    name: initial?.name || '',
    primaryMuscle: initial?.primaryMuscle || 'Chest',
    equipment: initial?.equipment || 'Dumbbell',
    difficulty: initial?.difficulty || 'Beginner',
    trackingType: initial?.trackingType || 'weight-reps',
    pattern: initial?.pattern || '',
    instructions: initial?.instructions?.join('\n') || '',
    cues: initial?.cues?.join('\n') || '',
  }))
  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }))
  const save = () => {
    if (!form.name.trim()) return
    onSave({
      ...form,
      instructions: form.instructions.split('\n').map((value) => value.trim()).filter(Boolean),
      cues: form.cues.split('\n').map((value) => value.trim()).filter(Boolean),
    })
  }
  return (
    <div className="sheet-content custom-exercise-sheet">
      <SheetHeading
        eyebrow="CUSTOM MOVEMENT"
        title={initial ? 'Edit exercise' : 'Create exercise'}
        body="Add a movement that is not in the built-in library. It stays on this device."
      />
      <div className="custom-form-grid">
        <label className="custom-form-wide">
          <span>EXERCISE NAME</span>
          <input value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="e.g. Cable Bayesian Curl" autoFocus />
        </label>
        <label>
          <span>PRIMARY MUSCLE</span>
          <select value={form.primaryMuscle} onChange={(event) => update('primaryMuscle', event.target.value)}>
            {muscleGroups.map((group) => <option key={group}>{group}</option>)}
          </select>
        </label>
        <label>
          <span>EQUIPMENT</span>
          <select value={form.equipment} onChange={(event) => update('equipment', event.target.value)}>
            {equipmentOptions.map((option) => <option key={option}>{option}</option>)}
          </select>
        </label>
        <label>
          <span>DIFFICULTY</span>
          <select value={form.difficulty} onChange={(event) => update('difficulty', event.target.value)}>
            {['Beginner', 'Intermediate', 'Advanced'].map((option) => <option key={option}>{option}</option>)}
          </select>
        </label>
        <label>
          <span>TRACKING STYLE</span>
          <select value={form.trackingType} onChange={(event) => update('trackingType', event.target.value)}>
            <option value="weight-reps">Weight + reps</option>
            <option value="duration">Duration</option>
            <option value="distance">Weight + distance</option>
            <option value="cardio">Run / cardio metrics</option>
          </select>
        </label>
        <label className="custom-form-wide">
          <span>MOVEMENT PATTERN</span>
          <input value={form.pattern} onChange={(event) => update('pattern', event.target.value)} placeholder="e.g. Elbow flexion" />
        </label>
        <label className="custom-form-wide">
          <span>INSTRUCTIONS · ONE STEP PER LINE</span>
          <textarea rows={4} value={form.instructions} onChange={(event) => update('instructions', event.target.value)} placeholder={'Set up the cable just above floor height.\nKeep the upper arm behind your torso.\nCurl without moving the shoulder.'} />
        </label>
        <label className="custom-form-wide">
          <span>COACHING CUES · ONE PER LINE</span>
          <textarea rows={3} value={form.cues} onChange={(event) => update('cues', event.target.value)} placeholder={'Keep the elbow still.\nControl the return.'} />
        </label>
      </div>
      <button className="button button--accent button--wide" onClick={save} disabled={!form.name.trim()}>
        {initial ? <Check size={18} /> : <Plus size={18} />} {initial ? 'Save changes' : 'Save custom exercise'}
      </button>
    </div>
  )
}

function SettingsSheet({
  settings,
  workoutCount,
  changeUnit,
  changeDistanceUnit,
  changeTheme,
  changeRest,
  changeKeepAwake,
  changeTimerSound,
  canInstall,
  installApp,
  exportData,
  exportCsv,
  triggerImport,
  resetData,
}) {
  const [resetArmed, setResetArmed] = useState(false)
  return (
    <div className="sheet-content settings-sheet">
      <SheetHeading
        eyebrow="PREFERENCES"
        title="Settings & data"
        body="Everything stays in this browser unless you export it."
      />

      <section className="setting-section theme-setting">
        <div className="setting-label">
          <div><Palette size={18} /><span>App theme</span></div>
          <small>Applied everywhere and saved on this device.</small>
        </div>
        <div className="theme-picker" role="radiogroup" aria-label="App theme">
          {THEMES.map((theme) => {
            const selected = normalizeTheme(settings.theme) === theme.id
            return (
              <button
                key={theme.id}
                type="button"
                className={'theme-option ' + (selected ? 'is-active' : '')}
                onClick={() => changeTheme(theme.id)}
                role="radio"
                aria-checked={selected}
              >
                <span className="theme-option-preview" aria-hidden="true">
                  {theme.swatches.map((swatch, index) => (
                    <i key={swatch} style={{ background: swatch, '--swatch-index': index }} />
                  ))}
                </span>
                <span className="theme-option-copy">
                  <strong>{theme.name}</strong>
                  <small>{theme.description}</small>
                </span>
                <span className="theme-option-check" aria-hidden="true">
                  {selected && <Check size={13} strokeWidth={3} />}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <section className="setting-section">
        <div className="setting-label">
          <div><Dumbbell size={18} /><span>Weight unit</span></div>
          <small>Existing logs are converted automatically.</small>
        </div>
        <div className="segmented-control">
          {['kg', 'lb'].map((unit) => (
            <button
              key={unit}
              className={settings.unit === unit ? 'is-active' : ''}
              onClick={() => changeUnit(unit)}
            >
              {unit.toUpperCase()}
            </button>
          ))}
        </div>
      </section>

      <section className="setting-section">
        <div className="setting-label">
          <div><Activity size={18} /><span>Running distance</span></div>
          <small>Run data stays precise when you switch display units.</small>
        </div>
        <div className="segmented-control">
          {['km', 'mi'].map((distanceUnit) => (
            <button
              key={distanceUnit}
              className={(settings.distanceUnit || 'km') === distanceUnit ? 'is-active' : ''}
              onClick={() => changeDistanceUnit(distanceUnit)}
            >
              {distanceUnit.toUpperCase()}
            </button>
          ))}
        </div>
      </section>

      <section className="setting-section setting-toggle-row">
        <div className="setting-label">
          <div><Zap size={18} /><span>Keep screen awake</span></div>
          <small>Useful while a workout is running.</small>
        </div>
        <button
          className={'toggle-switch ' + (settings.keepAwake ? 'is-active' : '')}
          onClick={() => changeKeepAwake(!settings.keepAwake)}
          role="switch"
          aria-checked={Boolean(settings.keepAwake)}
        >
          <span />
        </button>
      </section>

      <section className="setting-section">
        <div className="setting-label">
          <div><TimerReset size={18} /><span>Rest timer</span></div>
          <small>Starts after you complete a set.</small>
        </div>
        <div className="rest-options">
          {[60, 90, 120, 180].map((seconds) => (
            <button
              key={seconds}
              className={settings.restSeconds === seconds ? 'is-active' : ''}
              onClick={() => changeRest(seconds)}
            >
              {seconds < 120 ? seconds + 's' : seconds / 60 + 'm'}
            </button>
          ))}
        </div>
      </section>

      <section className="setting-section setting-toggle-row">
        <div className="setting-label">
          <div><Activity size={18} /><span>Timer sound</span></div>
          <small>Play a short cue when rest ends.</small>
        </div>
        <button
          className={'toggle-switch ' + (settings.timerSound ? 'is-active' : '')}
          onClick={() => changeTimerSound(!settings.timerSound)}
          role="switch"
          aria-checked={Boolean(settings.timerSound)}
        >
          <span />
        </button>
      </section>

      {canInstall && (
        <section className="data-section">
          <div className="setting-label">
            <div><Download size={18} /><span>Install OpenWorkout</span></div>
            <small>Use it full-screen like a phone app.</small>
          </div>
          <button className="button button--dark button--wide install-button" onClick={installApp}>
            <Download size={17} /> Add to this device
          </button>
        </section>
      )}

      <section className="data-section">
        <div className="setting-label">
          <div><Database size={18} /><span>Local data</span></div>
          <small>{workoutCount} workouts stored on this device.</small>
        </div>
        <div className="data-actions">
          <button onClick={exportData}>
            <span><Download size={18} /></span>
            <div><strong>Export backup</strong><small>Download readable JSON</small></div>
            <ChevronRight size={18} />
          </button>
          <button onClick={exportCsv}>
            <span><FileJson size={18} /></span>
            <div><strong>Export workout CSV</strong><small>Open in Sheets or Excel</small></div>
            <ChevronRight size={18} />
          </button>
          <button onClick={triggerImport}>
            <span><Upload size={18} /></span>
            <div><strong>Import backup</strong><small>Restore from a JSON file</small></div>
            <ChevronRight size={18} />
          </button>
        </div>
      </section>

      <div className="privacy-callout">
        <ShieldCheck size={20} />
        <div>
          <strong>No account. No cloud. No tracking.</strong>
          <p>Your workout data never leaves this device unless you choose to export it.</p>
        </div>
      </div>

      {!resetArmed ? (
        <button className="reset-link" onClick={() => setResetArmed(true)}>
          <Trash2 size={16} /> Reset local data
        </button>
      ) : (
        <div className="reset-confirm">
          <p>Reset all workouts and restore the starter data?</p>
          <div>
            <button onClick={() => setResetArmed(false)}>Cancel</button>
            <button onClick={resetData}>Yes, reset</button>
          </div>
        </div>
      )}
    </div>
  )
}

function RestTimer({ remaining, setRemaining }) {
  const progress = Math.max(0, Math.min(1, remaining / 180))
  return (
    <motion.div
      className="rest-timer"
      initial={{ opacity: 0, y: 28, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 18, scale: 0.96 }}
    >
      <div
        className="rest-progress"
        style={{ '--rest-progress': String(progress * 360) + 'deg' }}
      >
        <TimerReset size={17} />
      </div>
      <div className="rest-copy">
        <span>REST TIMER</span>
        <strong>{formatDuration(remaining)}</strong>
      </div>
      <button onClick={() => setRemaining(Math.max(0, remaining - 15))} aria-label="Subtract 15 seconds">
        <Minus size={17} />
      </button>
      <button onClick={() => setRemaining(remaining + 15)} aria-label="Add 15 seconds">
        <Plus size={17} />
      </button>
      <button className="skip-rest" onClick={() => setRemaining(null)}>Skip</button>
    </motion.div>
  )
}

function EmptyState({ icon: Icon, title, body, actionLabel, onAction }) {
  return (
    <div className="empty-state">
      <span><Icon size={27} /></span>
      <h2>{title}</h2>
      <p>{body}</p>
      <button className="button button--dark" onClick={onAction}>{actionLabel}</button>
    </div>
  )
}

function FeatureLoader({ compact = false }) {
  return (
    <div className={'feature-loader ' + (compact ? 'feature-loader--compact' : '')} role="status">
      <span />
      <p>Loading your training space…</p>
    </div>
  )
}

export default App
