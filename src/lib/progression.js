/**
 * Next-session load suggestions, by double progression: work within a rep
 * range at one weight, and once every working set reaches the top of the
 * range, add the smallest practical jump and start again at the bottom.
 *
 * Only an increase is ever suggested, and only from a clear signal — every
 * working set at the top weight hitting the top of the range. Anything less
 * (a missed rep, a mixed session, no weight at all) leaves last time's numbers
 * alone, which is what the log already pre-fills.
 */

// Without a routine target, the common hypertrophy range: it only fires after
// twelve or more on every set, so it can't push anyone working heavier sets.
const DEFAULT_RANGE = Object.freeze({ min: 8, max: 12 })

const INCREMENTS = Object.freeze({
  kg: { Dumbbell: 2, Kettlebell: 4, default: 2.5 },
  lb: { Kettlebell: 10, default: 5 },
})

/**
 * The smallest load jump that's practical for the equipment.
 *
 * @param {string | undefined} equipment
 * @param {'kg' | 'lb'} unit
 */
export function loadIncrement(equipment, unit) {
  const table = INCREMENTS[unit === 'lb' ? 'lb' : 'kg']
  return table[equipment] ?? table.default
}

/**
 * @param {object} options
 * @param {Array<{ weight?: number | '', reps?: number | '', completed?: boolean, type?: string }>} options.previousSets
 *   every set logged for the exercise in its most recent session
 * @param {number} [options.minReps]
 * @param {number} [options.maxReps]
 * @param {string} [options.equipment]
 * @param {'kg' | 'lb'} options.unit
 * @returns {{ weight: number, reps: number, fromWeight: number, increment: number, topReps: number } | null}
 */
export function suggestNextLoad({ previousSets = [], minReps, maxReps, equipment, unit }) {
  const working = previousSets.filter(
    (set) => set?.completed && set.type !== 'warmup' && Number(set.weight) > 0 && Number(set.reps) > 0,
  )
  if (!working.length) return null

  const top = Number(maxReps) > 0 ? Number(maxReps) : DEFAULT_RANGE.max
  const bottom = Number(minReps) > 0 && Number(minReps) <= top
    ? Number(minReps)
    : Number(maxReps) > 0 ? top : DEFAULT_RANGE.min

  const fromWeight = Math.max(...working.map((set) => Number(set.weight)))
  const atTop = working.filter((set) => Number(set.weight) === fromWeight)
  if (!atTop.every((set) => Number(set.reps) >= top)) return null

  const increment = loadIncrement(equipment, unit)
  return {
    weight: Math.round((fromWeight + increment) * 100) / 100,
    reps: bottom,
    fromWeight,
    increment,
    topReps: top,
  }
}
