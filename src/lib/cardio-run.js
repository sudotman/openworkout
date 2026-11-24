/**
 * Live timing for cardio and timed holds.
 *
 * A running split carries the moment its current leg started and what had
 * built up before it. Elapsed time is always worked out from the clock rather
 * than counted in ticks, so a locked phone, a backgrounded tab or a reload
 * loses nothing: the run picks up exactly where the wall clock says it is.
 *
 * On a treadmill the distance comes from the speed you set. Each speed change
 * closes the leg at the old speed and opens a new one, so an interval session
 * at 8, then 14, then 8 km/h adds up the way the belt did.
 *
 * Only a running set holds the run* fields. Once it stops, the familiar
 * duration, distanceKm and incline fields hold the result, and nothing else in
 * the app needs to know a timer was ever involved.
 *
 * @typedef {import('../types.js').WorkoutSet & {
 *   runStartedAt?: number,
 *   runBaseElapsed?: number,
 *   runBaseDistanceKm?: number,
 *   runBaseInclineSeconds?: number,
 * }} RunSet
 * @typedef {{ autoDistance?: boolean }} RunOptions
 */

import { cardioSetDistanceKm } from './cardio.js'

const num = (value) => Number(value) || 0
const round = (value, places) => Math.round(value * 10 ** places) / 10 ** places

/** A treadmill (or any machine) knows its own speed, so distance can follow it. */
export function tracksDistanceFromSpeed(exercise) {
  return exercise?.trackingType === 'cardio' && exercise.equipment === 'Machine'
}

/** @param {RunSet | null | undefined} set */
export function isRunning(set) {
  return Number.isFinite(set?.runStartedAt)
}

/**
 * Where a set stands right now, running or not.
 *
 * @param {RunSet} set
 * @param {number} now epoch milliseconds
 * @param {RunOptions} [options]
 */
export function runSnapshot(set, now, { autoDistance = false } = {}) {
  if (!isRunning(set)) {
    return {
      running: false,
      elapsed: num(set?.duration),
      distanceKm: cardioSetDistanceKm(set),
      incline: num(set?.incline),
    }
  }
  const leg = Math.max(0, (now - set.runStartedAt) / 1000)
  const elapsed = num(set.runBaseElapsed) + leg
  const distanceKm = autoDistance
    ? num(set.runBaseDistanceKm) + (num(set.speed) * leg) / 3600
    : num(set.distanceKm)
  const inclineSeconds = num(set.runBaseInclineSeconds) + num(set.incline) * leg
  return {
    running: true,
    elapsed,
    distanceKm,
    incline: elapsed > 0 ? inclineSeconds / elapsed : num(set.incline),
  }
}

/**
 * Starts the clock, or resumes it from whatever the set already holds.
 *
 * New sets arrive pre-filled with last session's numbers, which are a fine
 * guess to log by hand and a wrong place to start a stopwatch. A `fresh` start
 * begins from zero; once a set has been timed it is marked, so pausing and
 * resuming carries on from where it stopped.
 *
 * @param {RunSet} set
 * @param {number} now
 * @param {{ fresh?: boolean }} [options]
 */
export function startRun(set, now, { fresh = false } = {}) {
  if (isRunning(set)) return set
  const elapsed = fresh ? 0 : num(set.duration)
  const distanceKm = fresh ? 0 : num(set.distanceKm)
  return {
    ...set,
    ...(fresh ? { duration: 0, distanceKm: '' } : {}),
    timed: true,
    runStartedAt: now,
    runBaseElapsed: elapsed,
    runBaseDistanceKm: distanceKm,
    runBaseInclineSeconds: num(set.incline) * elapsed,
  }
}

function results(snapshot, options) {
  return {
    duration: Math.round(snapshot.elapsed),
    ...(options?.autoDistance ? { distanceKm: round(snapshot.distanceKm, 3) } : {}),
  }
}

/**
 * Folds the current leg into the totals and keeps running. Used before a
 * speed or incline change, and whenever the rest of the app needs to see
 * up-to-date numbers without stopping the run.
 *
 * @param {RunSet} set
 * @param {number} now
 * @param {RunOptions} [options]
 */
export function checkpointRun(set, now, options) {
  if (!isRunning(set)) return set
  const snapshot = runSnapshot(set, now, options)
  return {
    ...set,
    ...results(snapshot, options),
    runStartedAt: now,
    runBaseElapsed: snapshot.elapsed,
    runBaseDistanceKm: options?.autoDistance ? snapshot.distanceKm : num(set.distanceKm),
    runBaseInclineSeconds: snapshot.incline * snapshot.elapsed,
  }
}

/**
 * Stops the clock and leaves the result in the set's ordinary fields. Incline
 * becomes the time-weighted average across the run.
 *
 * @param {RunSet} set
 * @param {number} now
 * @param {RunOptions} [options]
 */
export function stopRun(set, now, options) {
  if (!isRunning(set)) return set
  const snapshot = runSnapshot(set, now, options)
  const {
    runStartedAt: _startedAt,
    runBaseElapsed: _elapsed,
    runBaseDistanceKm: _distance,
    runBaseInclineSeconds: _incline,
    ...rest
  } = set
  return {
    ...rest,
    ...results(snapshot, options),
    incline: snapshot.incline > 0 ? round(snapshot.incline, 1) : set.incline,
  }
}

/**
 * Changes speed or incline mid-run without rewriting what came before.
 *
 * @param {RunSet} set
 * @param {'speed' | 'incline'} field
 * @param {number | ''} value
 * @param {number} now
 * @param {RunOptions} [options]
 */
export function setRunValue(set, field, value, now, options) {
  return { ...checkpointRun(set, now, options), [field]: value }
}

/**
 * Brings every running timer in a workout up to date. With `stop`, timers end
 * and anything with time or distance on it is marked done — what finishing a
 * workout mid-run should mean.
 *
 * @param {import('../types.js').Workout} workout
 * @param {number} now
 * @param {(item: import('../types.js').WorkoutExercise) => boolean} autoDistanceFor
 * @param {{ stop?: boolean }} [mode]
 */
export function settleWorkoutRuns(workout, now, autoDistanceFor, { stop = false } = {}) {
  if (!workout?.exercises?.some((item) => item.sets?.some(isRunning))) return workout
  return {
    ...workout,
    exercises: workout.exercises.map((item) => {
      if (!item.sets?.some(isRunning)) return item
      const options = { autoDistance: autoDistanceFor(item) }
      return {
        ...item,
        sets: item.sets.map((set) => {
          if (!isRunning(set)) return set
          if (!stop) return checkpointRun(set, now, options)
          const stopped = stopRun(set, now, options)
          const hasWork = num(stopped.duration) > 0 || num(stopped.distanceKm) > 0
          return { ...stopped, completed: stopped.completed || hasWork }
        }),
      }
    }),
  }
}
