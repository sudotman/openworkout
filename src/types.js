/**
 * @typedef {'Beginner' | 'Intermediate' | 'Advanced'} Difficulty
 * @typedef {'Barbell' | 'Dumbbell' | 'Cable' | 'Machine' | 'Bodyweight' | 'Kettlebell' | 'Bands'} Equipment
 *
 * @typedef {Object} Exercise
 * @property {string} id
 * @property {string} name
 * @property {string} primaryMuscle
 * @property {string[]} secondaryMuscles
 * @property {Equipment} equipment
 * @property {Difficulty} difficulty
 * @property {string} pattern
 * @property {string[]} instructions
 * @property {string[]} cues
 *
 * @typedef {Object} WorkoutSet
 * @property {string} id
 * @property {number | ''} weight
 * @property {number | ''} reps
 * @property {number | ''} rpe
 * @property {number | ''} [duration]
 * @property {number | ''} [distance]
 * @property {number | ''} [distanceKm]
 * @property {number | ''} [speed]
 * @property {number | ''} [incline]
 * @property {number | ''} [heartRate]
 * @property {number | ''} [calories]
 * @property {boolean} completed
 *
 * @typedef {Object} WorkoutExercise
 * @property {string} id
 * @property {string} exerciseId
 * @property {WorkoutSet[]} sets
 * @property {string} notes
 *
 * @typedef {Object} Workout
 * @property {string} id
 * @property {string} name
 * @property {string | null} sourceRoutineId
 * @property {string} startedAt
 * @property {string | null} completedAt
 * @property {number} durationSeconds
 * @property {WorkoutExercise[]} exercises
 */

export {}
