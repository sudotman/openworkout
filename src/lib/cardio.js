const KM_PER_MILE = 1.609344

export function normalizeDistanceUnit(unit) {
  return unit === 'mi' ? 'mi' : 'km'
}

export function distanceToKilometers(value, unit = 'km') {
  const distance = Number(value) || 0
  return normalizeDistanceUnit(unit) === 'mi' ? distance * KM_PER_MILE : distance
}

export function distanceFromKilometers(value, unit = 'km') {
  const distance = Number(value) || 0
  return normalizeDistanceUnit(unit) === 'mi' ? distance / KM_PER_MILE : distance
}

export function isCardioExercise(exercise) {
  return exercise?.trackingType === 'cardio'
}

export function cardioSetDistanceKm(set) {
  const recordedDistance = Number(set?.distanceKm) || 0
  if (recordedDistance > 0) return recordedDistance

  const durationHours = (Number(set?.duration) || 0) / 3600
  const speedKph = Number(set?.speed) || 0
  return durationHours > 0 && speedKph > 0 ? durationHours * speedKph : 0
}

export function cardioSetSpeedKph(set) {
  const durationHours = (Number(set?.duration) || 0) / 3600
  const distanceKm = Number(set?.distanceKm) || 0
  if (durationHours > 0 && distanceKm > 0) return distanceKm / durationHours
  return Number(set?.speed) || 0
}

export function cardioSetPaceSecondsPerKm(set) {
  const distanceKm = cardioSetDistanceKm(set)
  const durationSeconds = Number(set?.duration) || 0
  return distanceKm > 0 && durationSeconds > 0 ? durationSeconds / distanceKm : 0
}

export function getCardioSummary(workout, exerciseMap, options = {}) {
  const completedOnly = options.completedOnly !== false
  const entries = []

  for (const workoutExercise of workout?.exercises || []) {
    const exercise = exerciseMap?.get?.(workoutExercise.exerciseId)
    if (!isCardioExercise(exercise)) continue

    for (const set of workoutExercise.sets || []) {
      if (completedOnly && !set.completed) continue
      const durationSeconds = Number(set.duration) || 0
      const distanceKm = cardioSetDistanceKm(set)
      const hasData = durationSeconds > 0 || distanceKm > 0 || Number(set.speed) > 0
      if (!hasData) continue
      entries.push({ exercise, set, durationSeconds, distanceKm })
    }
  }

  const totalDurationSeconds = entries.reduce((total, entry) => total + entry.durationSeconds, 0)
  const distanceKm = entries.reduce((total, entry) => total + entry.distanceKm, 0)
  const durationWeight = Math.max(totalDurationSeconds, entries.length)
  const weightedAverage = (field) => entries.reduce((total, entry) => {
    const weight = entry.durationSeconds || 1
    return total + (Number(entry.set[field]) || 0) * weight
  }, 0) / durationWeight
  const calories = entries.reduce((total, entry) => total + (Number(entry.set.calories) || 0), 0)

  return {
    entries,
    segmentCount: entries.length,
    distanceKm,
    totalDurationSeconds,
    paceSecondsPerKm: distanceKm > 0 && totalDurationSeconds > 0
      ? totalDurationSeconds / distanceKm
      : 0,
    averageSpeedKph: totalDurationSeconds > 0
      ? distanceKm / (totalDurationSeconds / 3600)
      : 0,
    averageIncline: weightedAverage('incline'),
    averageHeartRate: weightedAverage('heartRate'),
    calories,
  }
}

export function workoutIsCardioOnly(workout, exerciseMap) {
  const workoutExercises = workout?.exercises || []
  return workoutExercises.length > 0 && workoutExercises.every(
    (item) => isCardioExercise(exerciseMap?.get?.(item.exerciseId)),
  )
}

export function formatCardioDistance(distanceKm, unit = 'km') {
  const converted = distanceFromKilometers(distanceKm, unit)
  const maximumFractionDigits = converted >= 100 ? 1 : 2
  return new Intl.NumberFormat('en', {
    minimumFractionDigits: converted > 0 && converted < 10 ? 2 : 0,
    maximumFractionDigits,
  }).format(converted)
}

export function formatCardioPace(secondsPerKm, unit = 'km') {
  const normalizedUnit = normalizeDistanceUnit(unit)
  const secondsPerUnit = normalizedUnit === 'mi'
    ? Number(secondsPerKm || 0) * KM_PER_MILE
    : Number(secondsPerKm || 0)
  if (!Number.isFinite(secondsPerUnit) || secondsPerUnit <= 0) return '—'
  const rounded = Math.round(secondsPerUnit)
  const minutes = Math.floor(rounded / 60)
  const seconds = rounded % 60
  return `${minutes}:${String(seconds).padStart(2, '0')} /${normalizedUnit}`
}

export function formatCardioSpeed(speedKph, unit = 'km') {
  const normalizedUnit = normalizeDistanceUnit(unit)
  const speed = normalizedUnit === 'mi' ? Number(speedKph || 0) / KM_PER_MILE : Number(speedKph || 0)
  if (!Number.isFinite(speed) || speed <= 0) return '—'
  return `${speed.toFixed(1)} ${normalizedUnit}/h`
}

export function formatCardioTime(seconds) {
  const value = Math.max(0, Math.round(Number(seconds) || 0))
  const hours = Math.floor(value / 3600)
  const minutes = Math.floor((value % 3600) / 60)
  const remainder = value % 60
  if (hours) return `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
  return `${minutes}:${String(remainder).padStart(2, '0')}`
}

export function parseCardioTime(value) {
  const text = String(value || '').trim()
  if (!text) return 0
  const parts = text.split(':').map((part) => Number(part))
  if (parts.some((part) => !Number.isFinite(part) || part < 0)) return null
  if (parts.length === 1) return Math.round(parts[0] * 60)
  if (parts.length === 2) return Math.round(parts[0] * 60 + parts[1])
  if (parts.length === 3) return Math.round(parts[0] * 3600 + parts[1] * 60 + parts[2])
  return null
}
