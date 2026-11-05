import { describe, expect, it } from 'vitest'
import {
  convertStateUnits,
  createInitialState,
  getPersonalRecords,
  getPreviousExercise,
  insertAt,
  normalizeState,
  normalizeWorkout,
  workoutVolume,
} from '../workout.js'

const set = (weight, reps, extra = {}) => ({ id: 's' + weight + reps, weight, reps, completed: true, type: 'normal', ...extra })

describe('normalizeWorkout', () => {
  it('drops records that cannot be placed on a timeline', () => {
    expect(normalizeWorkout(null)).toBeNull()
    expect(normalizeWorkout({ name: 'x', startedAt: 'not a date' })).toBeNull()
  })

  it('falls back to the completion date', () => {
    expect(normalizeWorkout({ completedAt: '2026-01-02T10:00:00.000Z' })?.startedAt).toBe('2026-01-02T10:00:00.000Z')
  })

  it('repairs exercises and sets instead of crashing on them', () => {
    const workout = normalizeWorkout({
      startedAt: '2026-01-02T10:00:00.000Z',
      exercises: [{ exerciseId: 'squat', sets: [{ weight: 100, reps: 5, completed: 1 }, 'junk'] }, { sets: [] }, 7],
    })
    expect(workout.exercises).toHaveLength(1)
    expect(workout.exercises[0].sets).toEqual([
      expect.objectContaining({ weight: 100, reps: 5, completed: true, type: 'normal', id: expect.any(String) }),
    ])
  })
})

describe('normalizeState', () => {
  it('sorts imported workouts newest first', () => {
    const state = normalizeState({
      version: 1,
      settings: {},
      workouts: [
        { id: 'old', startedAt: '2026-01-01T10:00:00.000Z', exercises: [] },
        { id: 'new', startedAt: '2026-03-01T10:00:00.000Z', exercises: [] },
      ],
    })
    expect(state.workouts.map((workout) => workout.id)).toEqual(['new', 'old'])
  })

  it('flags seeded measurements in old saves so clearing samples keeps the user’s own', () => {
    const seeded = createInitialState().measurements.map(({ isSample: _flag, ...entry }) => entry)
    const mine = { id: 'mine', date: '2026-02-01', weight: 80 }
    const state = normalizeState({ hasStarterData: true, settings: {}, measurements: [...seeded, mine] })
    expect(state.measurements.filter((entry) => !entry.isSample).map((entry) => entry.id)).toEqual(['mine'])
  })

  it('keeps one copy of a repeated workout', () => {
    const workout = { id: 'same', startedAt: '2026-01-01T10:00:00.000Z', exercises: [] }
    expect(normalizeState({ settings: {}, workouts: [workout, workout] }).workouts).toHaveLength(1)
  })

  it('keeps a rest timer only alongside an active workout', () => {
    expect(normalizeState({ settings: {}, restTimer: { endsAt: 1, total: 90 } }).restTimer).toBeNull()
  })
})

describe('convertStateUnits', () => {
  const base = normalizeState({
    hasStarterData: false,
    settings: { unit: 'kg' },
    measurements: [{ id: 'm', date: '2026-02-01', weight: 80, waist: 81.5 }],
    exerciseSettings: { bench: { baseWeight: 20 } },
    workouts: [{ id: 'w', startedAt: '2026-02-01T10:00:00.000Z', exercises: [{ exerciseId: 'bench', sets: [set(100, 5), set('', '')] }] }],
  })

  it('converts loads, body metrics and base weights', () => {
    const lb = convertStateUnits(base, 'lb')
    expect(lb.settings.unit).toBe('lb')
    expect(lb.workouts[0].exercises[0].sets[0].weight).toBe(220.5)
    expect(lb.workouts[0].exercises[0].sets[1].weight).toBe('')
    expect(lb.measurements[0]).toMatchObject({ weight: 176.4, waist: 32.1 })
    expect(lb.exerciseSettings.bench.baseWeight).toBe(44)
  })

  it('round-trips plate weights without drift', () => {
    const back = convertStateUnits(convertStateUnits(base, 'lb'), 'kg')
    expect(back.workouts[0].exercises[0].sets[0].weight).toBe(100)
    expect(back.measurements[0].weight).toBe(80)
  })

  it('is a no-op for the current unit', () => {
    expect(convertStateUnits(base, 'kg')).toBe(base)
  })
})

describe('history lookups', () => {
  const workouts = [
    { exercises: [{ exerciseId: 'bench', sets: [set(80, 5, { completed: false })] }] },
    { exercises: [{ exerciseId: 'bench', sets: [set(75, 5), set(75, 8)] }] },
  ]

  it('finds the last session with a completed set', () => {
    expect(getPreviousExercise(workouts, 'bench').sets[1].reps).toBe(8)
  })

  it('counts volume without warm-ups or unfinished sets', () => {
    expect(workoutVolume({ exercises: [{ sets: [set(100, 5), set(40, 10, { type: 'warmup' }), set(100, 5, { completed: false })] }] })).toBe(500)
  })

  it('ranks records by estimated one-rep max', () => {
    expect(getPersonalRecords(workouts)[0]).toMatchObject({ exerciseId: 'bench', weight: 75, reps: 8 })
  })

  it('puts an undone item back where it was', () => {
    expect(insertAt(['a', 'c'], 1, 'b')).toEqual(['a', 'b', 'c'])
    expect(insertAt(['a'], 9, 'b')).toEqual(['a', 'b'])
  })
})
