import { describe, expect, it } from 'vitest'
import { focusOrder, fraction, nextFocusSlot, slotAfter, workVersusLast } from '../focus.js'

const set = (id, completed = false, extra = {}) => ({ id, weight: 50, reps: 10, completed, type: 'normal', ...extra })
const item = (id, sets, extra = {}) => ({ id, exerciseId: id, notes: '', sets, ...extra })

describe('focusOrder', () => {
  it('walks normal exercises straight through', () => {
    const workout = { exercises: [item('a', [set('a1'), set('a2')]), item('b', [set('b1')])] }
    expect(focusOrder(workout).map((slot) => slot.setId)).toEqual(['a1', 'a2', 'b1'])
  })

  it('alternates round by round through a superset', () => {
    const workout = {
      exercises: [
        item('a', [set('a1'), set('a2'), set('a3')], { supersetId: 's' }),
        item('b', [set('b1'), set('b2')], { supersetId: 's' }),
        item('c', [set('c1')]),
      ],
    }
    expect(focusOrder(workout).map((slot) => slot.setId)).toEqual(['a1', 'b1', 'a2', 'b2', 'a3', 'c1'])
  })

  it('keeps separate supersets apart', () => {
    const workout = {
      exercises: [
        item('a', [set('a1')], { supersetId: 's1' }),
        item('b', [set('b1')], { supersetId: 's2' }),
      ],
    }
    expect(focusOrder(workout).map((slot) => slot.itemId)).toEqual(['a', 'b'])
  })
})

describe('nextFocusSlot', () => {
  it('lands on the first set not yet done', () => {
    const workout = { exercises: [item('a', [set('a1', true), set('a2')]), item('b', [set('b1')])] }
    expect(nextFocusSlot(workout)).toMatchObject({ itemId: 'a', setId: 'a2', exerciseIndex: 0, setIndex: 1 })
  })

  it('is null once every set is done', () => {
    expect(nextFocusSlot({ exercises: [item('a', [set('a1', true)])] })).toBeNull()
    expect(nextFocusSlot({ exercises: [] })).toBeNull()
  })
})

describe('slotAfter', () => {
  it('skips sets already done', () => {
    const workout = { exercises: [item('a', [set('a1'), set('a2', true), set('a3')])] }
    expect(slotAfter(workout, 'a1')?.setId).toBe('a3')
    expect(slotAfter(workout, 'a3')).toBeNull()
  })
})

describe('workVersusLast', () => {
  it('compares completed working volume', () => {
    const today = [set('1', true), set('2', false), set('w', true, { type: 'warmup' })]
    const last = [set('1', true), set('2', true)]
    expect(workVersusLast(today, last, 'weight-reps')).toEqual({ ratio: 0.5, current: 500, baseline: 1000 })
  })

  it('falls back to reps for unloaded bodyweight work', () => {
    const today = [set('1', true, { weight: '', reps: 12 })]
    const last = [set('1', true, { weight: '', reps: 8 })]
    expect(workVersusLast(today, last, 'weight-reps')?.ratio).toBe(1.5)
  })

  it('uses seconds for timed holds', () => {
    const today = [set('1', true, { duration: 30 })]
    const last = [set('1', true, { duration: 60 })]
    expect(workVersusLast(today, last, 'duration')?.ratio).toBe(0.5)
  })

  it('is null with nothing to compare against', () => {
    expect(workVersusLast([set('1', true)], undefined, 'weight-reps')).toBeNull()
  })
})

describe('fraction', () => {
  it('clamps and guards against an empty total', () => {
    expect(fraction(3, 4)).toBe(0.75)
    expect(fraction(5, 4)).toBe(1)
    expect(fraction(1, 0)).toBe(0)
  })
})
