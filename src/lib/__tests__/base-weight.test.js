import { describe, expect, it } from 'vitest'
import {
  addedWeight,
  convertBaseWeight,
  convertExerciseSettings,
  formatLoad,
  normalizeBaseWeight,
  suggestedBaseWeight,
  totalWeight,
} from '../base-weight.js'

describe('base weight', () => {
  it('treats anything unusable as no base weight', () => {
    expect(normalizeBaseWeight('')).toBe(0)
    expect(normalizeBaseWeight(-5)).toBe(0)
    expect(normalizeBaseWeight('abc')).toBe(0)
    expect(normalizeBaseWeight('20')).toBe(20)
  })

  it('round-trips between the added and total weight', () => {
    expect(totalWeight(60, 20)).toBe(80)
    expect(addedWeight(80, 20)).toBe(60)
    expect(addedWeight(totalWeight(2.5, 7), 7)).toBe(2.5)
  })

  it('keeps empty input empty', () => {
    expect(totalWeight('', 20)).toBe('')
    expect(addedWeight('', 20)).toBe('')
  })

  it('reads a set lighter than its base as an empty bar', () => {
    expect(addedWeight(15, 20)).toBe(0)
  })

  it('suggests a bar only for barbell movements', () => {
    expect(suggestedBaseWeight({ equipment: 'Barbell', name: 'Barbell Bench Press' }, 'kg')).toBe(20)
    expect(suggestedBaseWeight({ equipment: 'Barbell', name: 'EZ Bar Curl', pattern: 'curl bar' }, 'lb')).toBe(20)
    expect(suggestedBaseWeight({ equipment: 'Dumbbell', name: 'Curl' }, 'kg')).toBe(0)
  })

  it('converts remembered base weights and drops empty ones', () => {
    expect(convertBaseWeight(20, 2.2046226218)).toBe(44)
    expect(convertExerciseSettings({ a: { baseWeight: 20 }, b: { baseWeight: 0 } }, 2.2046226218))
      .toEqual({ a: { baseWeight: 44 } })
  })

  it('formats loads without trailing zeros', () => {
    expect(formatLoad(20)).toBe('20')
    expect(formatLoad(2.5)).toBe('2.5')
    expect(formatLoad('')).toBe('—')
  })
})

describe('negative input', () => {
  it('stores an empty bar rather than less than the base', () => {
    expect(totalWeight(-5, 20)).toBe(20)
  })
})
