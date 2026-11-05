import { describe, expect, it } from 'vitest'
import { loadIncrement, suggestNextLoad } from '../progression.js'

const set = (weight, reps, extra = {}) => ({ weight, reps, completed: true, type: 'normal', ...extra })

describe('suggestNextLoad', () => {
  it('adds load once every set reaches the top of the range', () => {
    expect(
      suggestNextLoad({ previousSets: [set(60, 10), set(60, 10), set(60, 11)], minReps: 6, maxReps: 10, unit: 'kg' }),
    ).toMatchObject({ weight: 62.5, reps: 6, fromWeight: 60 })
  })

  it('holds the weight when any set fell short', () => {
    expect(suggestNextLoad({ previousSets: [set(60, 10), set(60, 9)], minReps: 6, maxReps: 10, unit: 'kg' })).toBeNull()
  })

  it('judges only the sets at the top weight', () => {
    expect(
      suggestNextLoad({ previousSets: [set(50, 6), set(60, 12), set(60, 12)], unit: 'kg' }),
    ).toMatchObject({ weight: 62.5, reps: 8 })
  })

  it('ignores warm-ups, incomplete sets and bodyweight work', () => {
    expect(suggestNextLoad({ previousSets: [set(40, 3, { type: 'warmup' })], unit: 'kg' })).toBeNull()
    expect(suggestNextLoad({ previousSets: [set(60, 12, { completed: false })], unit: 'kg' })).toBeNull()
    expect(suggestNextLoad({ previousSets: [set(0, 15)], unit: 'kg' })).toBeNull()
  })

  it('needs twelve on every set without a routine target', () => {
    expect(suggestNextLoad({ previousSets: [set(70, 8), set(70, 8)], unit: 'kg' })).toBeNull()
  })

  it('steps by what the equipment allows', () => {
    expect(loadIncrement('Dumbbell', 'kg')).toBe(2)
    expect(loadIncrement('Barbell', 'lb')).toBe(5)
    expect(
      suggestNextLoad({ previousSets: [set(20, 12)], equipment: 'Dumbbell', unit: 'kg' }),
    ).toMatchObject({ weight: 22 })
  })
})
