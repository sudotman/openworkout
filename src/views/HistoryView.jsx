import {
  Activity,
  ChevronRight,
  Clock3,
  Dumbbell,
  History,
  Plus,
} from 'lucide-react'
import { useMemo } from 'react'
import { EmptyState, ViewHeader } from '../components/AppChrome.jsx'
import { formatCardioDistance, formatCardioPace, getCardioSummary, workoutIsCardioOnly } from '../lib/cardio.js'
import { compactNumber, formatDate } from '../lib/format.js'
import { completedSetCount, workoutVolume } from '../lib/workout.js'

export function HistoryView({ workouts, unit, distanceUnit, exerciseMap, openWorkout, startWorkout }) {
  const grouped = useMemo(() => {
    const groups = new Map()
    workouts.forEach((workout) => {
      const key = formatDate(workout.startedAt, { month: 'long', year: 'numeric' })
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(workout)
    })
    return [...groups.entries()]
  }, [workouts])

  return (
    <div className="content-width">
      <ViewHeader
        title="Workout history"
        subtitle={workouts.length + (workouts.length === 1 ? ' completed session.' : ' completed sessions.')}
        action={
          <button className="button button--dark desktop-action" onClick={() => startWorkout(null)}>
            <Plus size={17} /> New workout
          </button>
        }
      />

      {grouped.length ? (
        <div className="history-groups">
          {grouped.map(([month, entries]) => (
            <section className="history-group" key={month}>
              <div className="history-month">
                <h2>{month}</h2>
                <span>{entries.length} {entries.length === 1 ? 'session' : 'sessions'}</span>
              </div>
              <div className="history-list">
                {entries.map((workout) => {
                  const cardio = getCardioSummary(workout, exerciseMap)
                  const cardioOnly = workoutIsCardioOnly(workout, exerciseMap)
                  const strengthSetCount = Math.max(0, completedSetCount(workout) - cardio.segmentCount)
                  return (
                  <button className="history-row" key={workout.id} onClick={() => openWorkout(workout)}>
                    <div className="history-date">
                      <strong>{formatDate(workout.startedAt, { day: '2-digit' })}</strong>
                      <span>{formatDate(workout.startedAt, { weekday: 'short' })}</span>
                    </div>
                    <div className="history-main">
                      <strong>{workout.name} {workout.isSample && <em className="sample-tag">SAMPLE</em>}</strong>
                      <span>
                        {cardio.distanceKm > 0
                          ? `${formatCardioDistance(cardio.distanceKm, distanceUnit)} ${distanceUnit} · ${formatCardioPace(cardio.paceSecondsPerKm, distanceUnit)}${!cardioOnly && strengthSetCount ? ` · ${strengthSetCount} lifting ${strengthSetCount === 1 ? 'set' : 'sets'}` : ''}`
                          : workout.exercises.slice(0, 3).map((item) => exerciseMap.get(item.exerciseId)?.name).filter(Boolean).join(' · ')}
                        {!cardio.distanceKm && workout.exercises.length > 3 ? ' +' + (workout.exercises.length - 3) : ''}
                      </span>
                    </div>
                    <div className="history-stats">
                      <span><Clock3 size={14} /> {Math.round((cardioOnly && cardio.totalDurationSeconds ? cardio.totalDurationSeconds : workout.durationSeconds) / 60)} min</span>
                      {cardio.distanceKm > 0 ? (
                        <span><Activity size={14} /> {formatCardioDistance(cardio.distanceKm, distanceUnit)} {distanceUnit} · {formatCardioPace(cardio.paceSecondsPerKm, distanceUnit)}</span>
                      ) : (
                        <span><Dumbbell size={14} /> {compactNumber(workoutVolume(workout))} {unit}</span>
                      )}
                      {cardio.distanceKm > 0 && workoutVolume(workout) > 0 && (
                        <span><Dumbbell size={14} /> {compactNumber(workoutVolume(workout))} {unit}</span>
                      )}
                    </div>
                    <ChevronRight size={19} />
                  </button>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={History}
          title="No workouts yet"
          body="Finish your first session and it will be kept here on this device."
          actionLabel="Start a workout"
          onAction={() => startWorkout(null)}
        />
      )}
    </div>
  )
}
