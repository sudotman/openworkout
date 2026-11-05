/**
 * Base weight — the load an exercise starts at before you add anything.
 *
 * A barbell bench press begins at the weight of the bar, a loaded machine at
 * the weight of the carriage. Logging that by hand means doing arithmetic
 * between sets, so each exercise can carry a base weight instead: you type the
 * weight you actually put on, and the app keeps the total.
 *
 * Sets always store the TOTAL load, so volume, personal records, history, and
 * every export stay comparable whether or not a base weight is in use. The base
 * weight is a lens over the input, not a second unit of truth. Changing it
 * never rewrites a weight you already logged — it only changes the number shown
 * in the input, so history is never silently restated.
 *
 * @typedef {import('../types.js').Exercise} Exercise
 */

const BAR_PRESETS = Object.freeze({
  kg: Object.freeze([
    { id: 'olympic', label: 'Olympic bar', weight: 20 },
    { id: 'womens', label: "Women's bar", weight: 15 },
    { id: 'ez', label: 'EZ curl bar', weight: 10 },
    { id: 'trap', label: 'Trap bar', weight: 25 },
    { id: 'smith', label: 'Smith machine', weight: 7 },
  ]),
  lb: Object.freeze([
    { id: 'olympic', label: 'Olympic bar', weight: 45 },
    { id: 'womens', label: "Women's bar", weight: 35 },
    { id: 'ez', label: 'EZ curl bar', weight: 20 },
    { id: 'trap', label: 'Trap bar', weight: 55 },
    { id: 'smith', label: 'Smith machine', weight: 15 },
  ]),
})

const BARBELL_PRESET_BY_PATTERN = Object.freeze([
  [/\bez\b|curl bar|preacher/i, 'ez'],
  [/trap bar|hex bar/i, 'trap'],
  [/smith/i, 'smith'],
])

function round(value) {
  return Math.round(value * 100) / 100
}

/**
 * The bar and carriage presets offered for the active weight unit.
 *
 * @param {'kg' | 'lb'} unit
 * @returns {ReadonlyArray<{ id: string, label: string, weight: number }>}
 */
export function barPresets(unit) {
  return BAR_PRESETS[unit === 'lb' ? 'lb' : 'kg']
}

/**
 * Coerces stored or typed input into a usable base weight. Anything unusable
 * means "no base weight", which is the default for every exercise.
 *
 * @param {unknown} value
 * @returns {number}
 */
export function normalizeBaseWeight(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return 0
  return round(parsed)
}

/**
 * The base weight we offer when the user first opens the control, chosen from
 * the exercise's own equipment. Only a suggestion — nothing is applied, and no
 * logged weight changes, until the user picks a value.
 *
 * @param {Exercise | undefined} exercise
 * @param {'kg' | 'lb'} unit
 * @returns {number}
 */
export function suggestedBaseWeight(exercise, unit) {
  if (!exercise || exercise.equipment !== 'Barbell') return 0
  const presets = barPresets(unit)
  const haystack = `${exercise.name || ''} ${exercise.pattern || ''}`
  const match = BARBELL_PRESET_BY_PATTERN.find(([pattern]) => pattern.test(haystack))
  const presetId = match ? match[1] : 'olympic'
  return presets.find((preset) => preset.id === presetId)?.weight || 0
}

/**
 * The number shown in the weight input: what the lifter adds on top of the
 * base. Clamped at zero so a set logged lighter than its base weight — an older
 * log, or a bar swapped after the fact — reads as an empty bar rather than a
 * negative load. The stored total is left untouched either way.
 *
 * @param {number | ''} totalWeight
 * @param {number} baseWeight
 * @returns {number | ''}
 */
export function addedWeight(totalWeight, baseWeight) {
  if (totalWeight === '' || totalWeight == null) return ''
  const total = Number(totalWeight)
  if (!Number.isFinite(total)) return ''
  if (!baseWeight) return round(total)
  return Math.max(0, round(total - baseWeight))
}

/**
 * The total to store for a weight the lifter typed into the input.
 *
 * @param {number | ''} added
 * @param {number} baseWeight
 * @returns {number | ''}
 */
export function totalWeight(added, baseWeight) {
  if (added === '' || added == null) return ''
  const value = Number(added)
  if (!Number.isFinite(value)) return ''
  return round(value + (baseWeight || 0))
}

/**
 * Trims a load to the shortest readable form: 20 rather than 20.0, 2.5 intact.
 *
 * @param {number | ''} value
 * @returns {string}
 */
export function formatLoad(value) {
  if (value === '' || value == null) return '—'
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return '—'
  return String(round(parsed))
}

/**
 * Converts a base weight between kg and lb, snapped to the same half-unit grid
 * as set weights so the two stay in step. A 20 kg bar lands on 44 lb rather
 * than the 45 lb bar a US gym would actually rack — the conversion is faithful
 * to what was logged, not to what is on the wall, and the presets are one tap
 * away for anyone who wants the other one.
 *
 * @param {unknown} value
 * @param {number} factor
 * @returns {number}
 */
export function convertBaseWeight(value, factor) {
  const converted = Number(value) * factor
  if (!Number.isFinite(converted) || converted <= 0) return 0
  return Math.round(converted * 2) / 2
}

/**
 * Converts every remembered base weight when the user switches unit.
 *
 * @param {Record<string, { baseWeight?: number }>} exerciseSettings
 * @param {number} factor
 * @returns {Record<string, { baseWeight: number }>}
 */
export function convertExerciseSettings(exerciseSettings, factor) {
  return Object.fromEntries(
    Object.entries(exerciseSettings || {}).flatMap(([exerciseId, entry]) => {
      const converted = convertBaseWeight(entry?.baseWeight, factor)
      return converted ? [[exerciseId, { ...entry, baseWeight: converted }]] : []
    }),
  )
}
