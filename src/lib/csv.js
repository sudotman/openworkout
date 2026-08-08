function escapeCell(value) {
  const stringValue = value === null || value === undefined ? '' : String(value)
  return '"' + stringValue.replaceAll('"', '""') + '"'
}

export function exportWorkoutsCsv(state, exerciseMap) {
  try {
    const rows = [
      ['Workout ID', 'Workout', 'Started At', 'Duration Seconds', 'Exercise', 'Primary Muscle', 'Set', 'Set Type', 'Weight', 'Unit', 'Reps', 'RPE', 'Completed', 'Exercise Notes'],
    ]

    for (const workout of state.workouts || []) {
      for (const item of workout.exercises || []) {
        const exercise = exerciseMap.get(item.exerciseId)
        for (let index = 0; index < (item.sets || []).length; index += 1) {
          const set = item.sets[index]
          rows.push([
            workout.id,
            workout.name,
            workout.startedAt,
            workout.durationSeconds,
            exercise?.name || item.exerciseId,
            exercise?.primaryMuscle || '',
            index + 1,
            set.type || 'normal',
            set.weight,
            state.settings?.unit || 'kg',
            set.reps,
            set.rpe,
            Boolean(set.completed),
            item.notes || '',
          ])
        }
      }
    }

    const csv = rows.map((row) => row.map(escapeCell).join(',')).join('\n') + '\n'
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'openworkout-workouts-' + new Date().toISOString().slice(0, 10) + '.csv'
    link.style.display = 'none'
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    return true
  } catch {
    return false
  }
}
