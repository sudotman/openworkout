/**
 * @typedef {'Beginner' | 'Intermediate' | 'Advanced'} Difficulty
 * @typedef {'Barbell' | 'Dumbbell' | 'Cable' | 'Machine' | 'Bodyweight' | 'Kettlebell' | 'Bands'} Equipment
 * @typedef {'weight-reps' | 'duration' | 'distance' | 'cardio'} TrackingType
 * @typedef {'normal' | 'warmup' | 'drop' | 'failure'} SetType
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
 * @property {TrackingType} [trackingType]
 * @property {boolean} [custom]
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
 * @property {SetType} type
 * @property {boolean} completed
 *
 * @typedef {Object} WorkoutExercise
 * @property {string} id
 * @property {string} exerciseId
 * @property {WorkoutSet[]} sets
 * @property {string} notes
 * @property {string} [supersetId]
 * @property {number} [restSeconds]
 * @property {number} [targetMinReps]
 * @property {number} [targetMaxReps]
 *
 * @typedef {Object} Workout
 * @property {string} id
 * @property {string} name
 * @property {string | null} sourceRoutineId
 * @property {string} startedAt
 * @property {string | null} completedAt
 * @property {number} durationSeconds
 * @property {WorkoutExercise[]} exercises
 * @property {string} [notes]
 * @property {string | null} [pausedAt]
 * @property {number} [pausedDurationSeconds]
 * @property {boolean} [isSample]
 */

export {}
