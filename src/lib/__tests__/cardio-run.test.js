import { describe, expect, it } from 'vitest'
import {
  checkpointRun,
  isRunning,
  runSnapshot,
  setRunValue,
  settleWorkoutRuns,
  startRun,
  stopRun,
  tracksDistanceFromSpeed,
} from '../cardio-run.js'

const T0 = 1_700_000_000_000
const sec = (seconds) => T0 + seconds * 1000
const auto = { autoDistance: true }
const blank = { id: 's1', duration: '', distanceKm: '', speed: '', incline: '', completed: false, type: 'normal' }

describe('run timer', () => {
  it('counts elapsed time from the clock', () => {
    const running = startRun(blank, T0)
    expect(isRunning(running)).toBe(true)
    expect(runSnapshot(running, sec(95)).elapsed).toBe(95)
  })

  it('stops into the ordinary duration field and drops the run fields', () => {
    const stopped = stopRun(startRun(blank, T0), sec(61.4))
    expect(stopped.duration).toBe(61)
    expect(isRunning(stopped)).toBe(false)
    expect(Object.keys(stopped).some((key) => key.startsWith('run'))).toBe(false)
  })

  it('resumes from the duration already logged', () => {
    const paused = stopRun(startRun(blank, T0), sec(60))
    const resumed = startRun(paused, sec(500))
    expect(runSnapshot(resumed, sec(530)).elapsed).toBe(90)
  })

  it('builds treadmill distance from speed, leg by leg', () => {
    let set = startRun({ ...blank, speed: 10 }, T0)
    // 6 minutes at 10 km/h = 1 km, then 6 minutes at 15 km/h = 1.5 km
    set = setRunValue(set, 'speed', 15, sec(360), auto)
    const snapshot = runSnapshot(set, sec(720), auto)
    expect(snapshot.distanceKm).toBeCloseTo(2.5, 6)
    expect(stopRun(set, sec(720), auto).distanceKm).toBe(2.5)
  })

  it('starts a fresh timer from zero, ignoring last session pre-fills', () => {
    const prefilled = { ...blank, duration: 1500, distanceKm: 5, speed: 12 }
    const set = startRun(prefilled, T0, { fresh: true })
    expect(set.timed).toBe(true)
    expect(runSnapshot(set, sec(60), auto)).toMatchObject({ elapsed: 60, distanceKm: 0.2 })
    expect(runSnapshot(set, sec(60)).distanceKm).toBe(0)
  })

  it('leaves distance alone when it is entered by hand', () => {
    const set = startRun({ ...blank, speed: 10, distanceKm: 3 }, T0)
    expect(runSnapshot(set, sec(600)).distanceKm).toBe(3)
    expect(stopRun(set, sec(600)).distanceKm).toBe(3)
  })

  it('averages incline over time', () => {
    let set = startRun({ ...blank, incline: 2 }, T0)
    set = setRunValue(set, 'incline', 8, sec(300), auto)
    expect(stopRun(set, sec(600), auto).incline).toBe(5)
  })

  it('checkpoints without stopping', () => {
    const set = checkpointRun(startRun({ ...blank, speed: 12 }, T0), sec(300), auto)
    expect(isRunning(set)).toBe(true)
    expect(set.duration).toBe(300)
    expect(set.distanceKm).toBe(1)
  })
})

describe('settleWorkoutRuns', () => {
  const workout = (sets) => ({ exercises: [{ id: 'we', exerciseId: 'treadmill-run', sets }] })

  it('is a no-op without a running timer', () => {
    const plain = workout([blank])
    expect(settleWorkoutRuns(plain, T0, () => true)).toBe(plain)
  })

  it('stops and logs a running split when the workout finishes', () => {
    const settled = settleWorkoutRuns(workout([startRun({ ...blank, speed: 12 }, T0)]), sec(600), () => true, {
      stop: true,
    })
    expect(settled.exercises[0].sets[0]).toMatchObject({ duration: 600, distanceKm: 2, completed: true })
  })
})

describe('tracksDistanceFromSpeed', () => {
  it('is true for machine cardio only', () => {
    expect(tracksDistanceFromSpeed({ trackingType: 'cardio', equipment: 'Machine' })).toBe(true)
    expect(tracksDistanceFromSpeed({ trackingType: 'cardio', equipment: 'Bodyweight' })).toBe(false)
    expect(tracksDistanceFromSpeed({ trackingType: 'weight-reps', equipment: 'Machine' })).toBe(false)
  })
})
