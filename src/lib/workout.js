import { DEFAULT_THEME_ID, normalizeTheme } from '../data/themes.js'
import { convertBaseWeight, convertExerciseSettings, normalizeBaseWeight } from './base-weight.js'
import { formatDate } from './format.js'
import { createInitialNutritionState, normalizeNutritionState } from './nutrition.js'

export const DURATION_EXERCISES = new Set(['forearm-plank', 'side-plank'])

export const DISTANCE_EXERCISES = new Set([
  'farmers-carry',
  'suitcase-carry',
  'kettlebell-front-rack-carry',
  'sled-push',
])

export const TEMPLATES = [
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

export function uid(prefix = 'id') {
  const value = globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)
  return prefix + '-' + value
}

export function daysAgoIso(days, hour = 18, minute = 0) {
  const date = new Date()
  date.setHours(hour, minute, 0, 0)
  date.setDate(date.getDate() - days)
  return date.toISOString()
}

export function seedExercise(exerciseId, values, notes = '') {
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

export function createInitialState() {
  const upperStart = daysAgoIso(2, 18, 12)
  const lowerStart = daysAgoIso(5, 7, 8)
  const pullStart = daysAgoIso(9, 18, 32)
  const fullStart = daysAgoIso(13, 9, 15)

  return {
    version: 1,
    settings: {
      theme: DEFAULT_THEME_ID,
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
      { id: uid('measure'), isSample: true, date: daysAgoIso(14, 8, 0).slice(0, 10), weight: 76.4, bodyFat: 16.2, waist: 82, chest: 101, arm: 35, thigh: 57 },
      { id: uid('measure'), isSample: true, date: daysAgoIso(0, 8, 0).slice(0, 10), weight: 75.8, bodyFat: 15.8, waist: 81.5, chest: 101.5, arm: 35.3, thigh: 57.2 },
    ],
    progressPhotos: [],
    nutrition: createInitialNutritionState(),
    customExercises: [],
    exerciseSettings: {},
    hasStarterData: true,
    activeWorkout: null,
    restTimer: null,
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

export function normalizeExerciseSettings(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(
    Object.entries(value).flatMap(([exerciseId, entry]) => {
      const baseWeight = normalizeBaseWeight(entry?.baseWeight)
      return baseWeight ? [[exerciseId, { baseWeight }]] : []
    }),
  )
}

// Saves from before sample measurements were flagged: recognise the two seeded
// entries by their values so clearing samples leaves the user's own alone.
export function isLegacySampleMeasurement(entry) {
  return (
    (Number(entry?.weight) === 76.4 && Number(entry?.bodyFat) === 16.2 && Number(entry?.waist) === 82) ||
    (Number(entry?.weight) === 75.8 && Number(entry?.bodyFat) === 15.8 && Number(entry?.waist) === 81.5)
  )
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function validDate(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

/**
 * Coerces one logged workout into the shape every screen assumes, or returns
 * null when there's nothing usable. A backup is plain JSON that may have been
 * hand-edited or written by an older version, and a single bad record
 * (no date, sets that aren't a list) would otherwise take down whichever
 * screen first tries to draw it.
 */
export function normalizeWorkout(workout) {
  if (!isRecord(workout)) return null
  const startedAt = validDate(workout.startedAt)
    ? workout.startedAt
    : validDate(workout.completedAt) ? workout.completedAt : null
  if (!startedAt) return null
  const exercises = (Array.isArray(workout.exercises) ? workout.exercises : [])
    .filter((item) => isRecord(item) && typeof item.exerciseId === 'string' && item.exerciseId)
    .map((item) => ({
      ...item,
      id: typeof item.id === 'string' && item.id ? item.id : uid('we'),
      notes: typeof item.notes === 'string' ? item.notes : '',
      sets: (Array.isArray(item.sets) ? item.sets : [])
        .filter(isRecord)
        .map((set) => ({
          ...set,
          id: typeof set.id === 'string' && set.id ? set.id : uid('set'),
          type: typeof set.type === 'string' ? set.type : 'normal',
          completed: Boolean(set.completed),
        })),
    }))
  return {
    ...workout,
    id: typeof workout.id === 'string' && workout.id ? workout.id : uid('workout'),
    name: typeof workout.name === 'string' && workout.name.trim() ? workout.name : 'Workout',
    startedAt,
    durationSeconds: Number(workout.durationSeconds) >= 0 ? Number(workout.durationSeconds) : 0,
    exercises,
  }
}

/** Newest first — the order every "last time" lookup relies on. */
export function sortWorkouts(workouts) {
  return [...workouts].sort((left, right) => Date.parse(right.startedAt) - Date.parse(left.startedAt))
}

/** One record per id: a backup merged by hand can repeat one. */
function uniqueById(items) {
  const seen = new Set()
  return items.filter((item) => !seen.has(item.id) && seen.add(item.id))
}

export function normalizeState(state) {
  const fallback = createInitialState()
  if (!state || typeof state !== 'object') return fallback
  const measurements = Array.isArray(state.measurements)
    ? state.measurements.filter((entry) => isRecord(entry) && validDate(entry.date)).map((entry) =>
        state.hasStarterData && !entry?.isSample && isLegacySampleMeasurement(entry)
          ? { ...entry, isSample: true }
          : entry,
      )
    : fallback.measurements
  let nutrition = state.nutrition
    ? normalizeNutritionState(state.nutrition)
    : state.hasStarterData === false
      ? { ...fallback.nutrition, entries: [], recentFoodIds: [] }
      : fallback.nutrition

  if (!state.nutrition) {
    const latestMeasurement = measurements
      .filter((entry) => Number(entry.weight) > 0)
      .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime())[0]
    if (latestMeasurement) {
      const storedWeight = Number(latestMeasurement.weight)
      const weightKg = state.settings?.unit === 'lb' ? storedWeight / 2.2046226218 : storedWeight
      nutrition = {
        ...nutrition,
        profile: { ...nutrition.profile, weightKg: Math.round(weightKg * 10) / 10 },
      }
    }
  }

  return {
    ...fallback,
    ...state,
    version: 1,
    workouts: Array.isArray(state.workouts)
      ? sortWorkouts(uniqueById(state.workouts.map(normalizeWorkout).filter(Boolean)))
      : fallback.workouts,
    routines: Array.isArray(state.routines)
      ? state.routines
          .filter(isRecord)
          .map((routine) => ({
            ...routine,
            id: typeof routine.id === 'string' && routine.id ? routine.id : uid('routine'),
            name: typeof routine.name === 'string' && routine.name.trim() ? routine.name : 'Routine',
            exerciseIds: Array.isArray(routine.exerciseIds)
              ? routine.exerciseIds.filter((id) => typeof id === 'string')
              : [],
          }))
      : fallback.routines,
    measurements,
    progressPhotos: Array.isArray(state.progressPhotos)
      ? state.progressPhotos
          .filter((photo) => photo && typeof photo === 'object')
          .map((photo) => (photo.id ? photo : { ...photo, id: uid('photo') }))
      : [],
    nutrition,
    customExercises: Array.isArray(state.customExercises)
      ? state.customExercises.filter((exercise) => isRecord(exercise) && exercise.id && exercise.name)
      : [],
    exerciseSettings: normalizeExerciseSettings(state.exerciseSettings),
    hasStarterData: Boolean(state.hasStarterData),
    activeWorkout: normalizeWorkout(state.activeWorkout),
    restTimer:
      state.activeWorkout && Number.isFinite(state.restTimer?.endsAt) && Number(state.restTimer?.total) > 0
        ? { endsAt: state.restTimer.endsAt, total: Number(state.restTimer.total) }
        : null,
    settings: {
      ...fallback.settings,
      ...(state.settings || {}),
      theme: normalizeTheme(state.settings?.theme),
    },
  }
}

export function calculateElapsed(workout, nowValue = Date.now()) {
  if (!workout?.startedAt) return 0
  const endTime = workout.pausedAt ? new Date(workout.pausedAt).getTime() : nowValue
  const pausedMilliseconds = Number(workout.pausedDurationSeconds || 0) * 1000
  return Math.max(0, Math.floor((endTime - new Date(workout.startedAt).getTime() - pausedMilliseconds) / 1000))
}

export function workoutVolume(workout) {
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

export function completedSetCount(workout) {
  return (workout?.exercises || []).reduce(
    (total, item) => total + (item.sets || []).filter((set) => set.completed).length,
    0,
  )
}

export function createWorkoutSet(previous = null) {
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

/** The exercise as last logged with at least one completed set. */
export function getPreviousExercise(workouts, exerciseId) {
  for (const workout of workouts) {
    const match = workout.exercises?.find((item) => item.exerciseId === exerciseId)
    if (match?.sets?.some((set) => set.completed)) return match
  }
  return null
}

/** Puts an item back where it was, or at the end if the list has shrunk. */
export function insertAt(list, index, item) {
  const next = [...list]
  next.splice(Math.min(Math.max(index, 0), next.length), 0, item)
  return next
}

export function sameExerciseOrder(left = [], right = []) {
  return left.length === right.length && left.every((id, index) => id === right[index])
}

export function workoutExerciseIds(workout) {
  return Array.from(new Set((workout?.exercises || []).map((item) => item.exerciseId).filter(Boolean)))
}

export function routineDataFromWorkout(workout, sourceRoutine = null) {
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

export function getTrackingType(exercise) {
  if (exercise?.trackingType) return exercise.trackingType
  if (DURATION_EXERCISES.has(exercise?.id)) return 'duration'
  if (DISTANCE_EXERCISES.has(exercise?.id)) return 'distance'
  return 'weight-reps'
}

export function getWeeklyVolume(workouts) {
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

export function getPersonalRecords(workouts) {
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

const KG_TO_LB = 2.2046226218
const MEASUREMENT_LENGTHS = ['waist', 'chest', 'arm', 'thigh']

// `per` is steps per unit (2 for halves, 10 for tenths), so the result is
// divided by a whole number and doesn't pick up 35.300000000000004.
function convertValue(value, factor, per) {
  if (value === '' || value == null || !Number.isFinite(Number(value))) return value
  return Math.round(Number(value) * factor * per) / per
}

/**
 * Re-expresses every stored load and body measurement in the other unit
 * system. Set weights snap to the half-unit grid plates come in; body metrics
 * keep a decimal. Nutrition is stored in kilograms throughout and is untouched.
 *
 * @param {object} state
 * @param {'kg' | 'lb'} nextUnit
 */
export function convertStateUnits(state, nextUnit) {
  if (nextUnit === state.settings.unit) return state
  const factor = nextUnit === 'lb' ? KG_TO_LB : 1 / KG_TO_LB
  const lengthFactor = nextUnit === 'lb' ? 1 / 2.54 : 2.54
  const convertWorkout = (workout) =>
    workout && {
      ...workout,
      exercises: workout.exercises.map(({ progression: _stale, ...exercise }) => ({
        ...exercise,
        baseWeight: convertBaseWeight(exercise.baseWeight, factor),
        sets: exercise.sets.map((set) => ({ ...set, weight: convertValue(set.weight, factor, 2) })),
      })),
    }

  return {
    ...state,
    settings: { ...state.settings, unit: nextUnit },
    exerciseSettings: convertExerciseSettings(state.exerciseSettings, factor),
    workouts: state.workouts.map(convertWorkout),
    activeWorkout: convertWorkout(state.activeWorkout),
    measurements: state.measurements.map((measurement) => ({
      ...measurement,
      weight: convertValue(measurement.weight, factor, 10),
      ...Object.fromEntries(
        MEASUREMENT_LENGTHS.map((key) => [key, convertValue(measurement[key], lengthFactor, 10)]),
      ),
    })),
  }
}
