/**
 * Focus mode — the live workout one set at a time.
 *
 * Nothing here is stored. The set you're on is always the first one not yet
 * done, walked in the order you'd actually lift: straight through a normal
 * exercise, and round by round through a superset (A1, B1, A2, B2…). Ticking a
 * set off is therefore all it takes to move on, and switching between the list
 * and focus layouts can never leave the two disagreeing about where you are.
 *
 * @typedef {import('../types.js').Workout} Workout
 * @typedef {import('../types.js').WorkoutExercise} WorkoutExercise
 * @typedef {import('../types.js').WorkoutSet} WorkoutSet
 * @typedef {{ itemId: string, setId: string, exerciseIndex: number, setIndex: number }} FocusSlot
 */

/**
 * Exercises grouped the way they're performed: a run of consecutive exercises
 * sharing a superset id is one group, anything else stands alone.
 *
 * @param {WorkoutExercise[]} exercises
 * @returns {number[][]} exercise indexes per group
 */
function performanceGroups(exercises) {
  const groups = []
  exercises.forEach((item, index) => {
    const last = groups.at(-1)
    const previous = exercises[index - 1]
    if (last && item.supersetId && previous?.supersetId === item.supersetId) last.push(index)
    else groups.push([index])
  })
  return groups
}

/**
 * Every set in the workout, in the order it will be lifted.
 *
 * @param {Workout | null | undefined} workout
 * @returns {FocusSlot[]}
 */
export function focusOrder(workout) {
  const exercises = workout?.exercises || []
  return performanceGroups(exercises).flatMap((group) => {
    const rounds = Math.max(0, ...group.map((index) => exercises[index].sets?.length || 0))
    const slots = []
    for (let setIndex = 0; setIndex < rounds; setIndex += 1) {
      for (const exerciseIndex of group) {
        const set = exercises[exerciseIndex].sets?.[setIndex]
        if (set) slots.push({ itemId: exercises[exerciseIndex].id, setId: set.id, exerciseIndex, setIndex })
      }
    }
    return slots
  })
}

/**
 * The next set to lift, or null once every set is done.
 *
 * @param {Workout | null | undefined} workout
 * @returns {FocusSlot | null}
 */
export function nextFocusSlot(workout) {
  const exercises = workout?.exercises || []
  return (
    focusOrder(workout).find(
      (slot) => !exercises[slot.exerciseIndex].sets[slot.setIndex].completed,
    ) || null
  )
}

/**
 * The slot after the given set, skipping any already done.
 *
 * @param {Workout | null | undefined} workout
 * @param {string} setId
 * @returns {FocusSlot | null}
 */
export function slotAfter(workout, setId) {
  const exercises = workout?.exercises || []
  const order = focusOrder(workout)
  const start = order.findIndex((slot) => slot.setId === setId)
  return (
    order.slice(start + 1).find((slot) => !exercises[slot.exerciseIndex].sets[slot.setIndex].completed) || null
  )
}

/**
 * How much work a set of sets represents, in the unit that makes sense for how
 * the exercise is tracked. Loaded lifts count load × reps; a bodyweight lift
 * logged without load falls back to reps so it still has something to beat.
 *
 * @param {WorkoutSet[] | undefined} sets
 * @param {string} trackingType
 * @param {'volume' | 'reps'} [basis]
 */
function workDone(sets, trackingType, basis = 'volume') {
  const done = (sets || []).filter((set) => set?.completed && set.type !== 'warmup')
  const sum = (pick) => done.reduce((total, set) => total + (Number(pick(set)) || 0), 0)
  if (trackingType === 'duration' || trackingType === 'cardio') return sum((set) => set.duration)
  if (trackingType === 'distance') return sum((set) => set.distance)
  if (basis === 'reps') return sum((set) => set.reps)
  return sum((set) => (Number(set.weight) || 0) * (Number(set.reps) || 0))
}

/**
 * Today's work on an exercise as a share of the last time it was logged.
 * Null when there's no previous session to measure against.
 *
 * @param {WorkoutSet[] | undefined} sets today's sets
 * @param {WorkoutSet[] | undefined} previousSets the last session's sets
 * @param {string} trackingType
 * @returns {{ ratio: number, current: number, baseline: number } | null}
 */
export function workVersusLast(sets, previousSets, trackingType) {
  let basis = 'volume'
  let baseline = workDone(previousSets, trackingType, basis)
  if (!baseline && trackingType === 'weight-reps') {
    basis = 'reps'
    baseline = workDone(previousSets, trackingType, basis)
  }
  if (!baseline) return null
  const current = workDone(sets, trackingType, basis)
  return { ratio: current / baseline, current, baseline }
}

/**
 * @param {number} done
 * @param {number} total
 */
export function fraction(done, total) {
  return total > 0 ? Math.max(0, Math.min(1, done / total)) : 0
}
