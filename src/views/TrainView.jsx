import {
  ChevronRight,
  Database,
  Download,
  Play,
  Plus,
} from 'lucide-react'
import { ViewHeader } from '../components/AppChrome.jsx'
import { formatCardioDistance, formatCardioPace, getCardioSummary } from '../lib/cardio.js'
import { compactNumber, formatDate, getGreeting } from '../lib/format.js'
import { completedSetCount, TEMPLATES, workoutVolume } from '../lib/workout.js'

export function TrainView({ workouts, routines, unit, distanceUnit, exerciseMap, hasStarterData, clearStarterData, startWorkout, openWorkout, backupReminder, exportBackup, snoozeBackupReminder }) {
  const latestWorkout = workouts[0]
  const getStoredRoutine = (template) => routines.find(
    (routine) => routine.id === template.id || routine.id === 'routine-' + template.id,
  ) || template
  const weekCutoff = Date.now() - 7 * 86400000
  const weekWorkouts = workouts.filter((workout) => new Date(workout.startedAt).getTime() >= weekCutoff)
  const weekSets = weekWorkouts.reduce((total, workout) => total + completedSetCount(workout), 0)
  const weekVolume = weekWorkouts.reduce((total, workout) => total + workoutVolume(workout), 0)
  const weekCardio = weekWorkouts.reduce((summary, workout) => {
    const cardio = getCardioSummary(workout, exerciseMap)
    return {
      distanceKm: summary.distanceKm + cardio.distanceKm,
    }
  }, { distanceKm: 0 })
  const latestCardio = latestWorkout ? getCardioSummary(latestWorkout, exerciseMap) : null
  const featuredRoutine = getStoredRoutine(TEMPLATES[0])
  const featuredCount = featuredRoutine.exerciseIds?.length || 0
  const featuredLast = workouts.find(
    (workout) => workout.sourceRoutineId === featuredRoutine.id || workout.name === featuredRoutine.name,
  )

  return (
    <div className="train-view content-width">
      <ViewHeader
        eyebrow={formatDate(new Date(), { weekday: 'long', day: 'numeric', month: 'long' })}
        title={getGreeting() + '.'}
        action={
          <button className="button button--dark desktop-action" onClick={() => startWorkout(null)}>
            <Plus size={17} /> Empty workout
          </button>
        }
      />

      {hasStarterData && (
        <div className="starter-banner">
          <Database size={16} />
          <p><strong>Sample data is loaded.</strong> Clear it before you log your first session.</p>
          <button onClick={clearStarterData}>Clear</button>
        </div>
      )}

      {backupReminder && (
        <div className="starter-banner">
          <Download size={16} />
          <p>
            <strong>{backupReminder}.</strong> Your log lives only in this browser.
          </p>
          <span className="starter-banner-actions">
            <button onClick={snoozeBackupReminder}>Later</button>
            <button onClick={exportBackup}>Back up</button>
          </span>
        </div>
      )}

      <div className="train-layout">
        <div className="train-primary">
          <section className="session-hero">
            <div className="session-hero-content">
              <h2>{featuredRoutine.name}</h2>
              <div className="hero-meta">
                <span>{featuredCount} {featuredCount === 1 ? 'exercise' : 'exercises'}</span>
                <span>
                  {featuredLast
                    ? 'Last trained ' + formatDate(featuredLast.startedAt, { day: 'numeric', month: 'short' })
                    : 'Not trained yet'}
                </span>
              </div>
              <button className="button button--accent button--large" onClick={() => startWorkout(featuredRoutine)}>
                <Play size={18} fill="currentColor" />
                Start workout
              </button>
            </div>
          </section>

          <section className="section-block">
            <div className="section-heading">
              <div>
                <span className="section-kicker">ROUTINES</span>
                <h2>Quick start</h2>
              </div>
              <button className="text-button mobile-empty" onClick={() => startWorkout(null)}>
                Empty workout <Plus size={16} />
              </button>
            </div>
            <div className="template-list">
              {TEMPLATES.slice(1).map((template, index) => (
                <button
                  key={template.id}
                  className="template-row"
                  onClick={() => startWorkout(getStoredRoutine(template))}
                >
                  <span className="template-index">0{index + 1}</span>
                  <span className="template-main">
                    <strong>{template.name}</strong>
                    <small>{template.description}</small>
                  </span>
                  <span className="template-type">{template.eyebrow}</span>
                  <ChevronRight size={19} />
                </button>
              ))}
            </div>
          </section>
        </div>

        <aside className="train-aside">
          <section className="week-panel">
            <div className="section-kicker">LAST 7 DAYS</div>
            <div className="week-metrics">
              <div>
                <strong>{weekWorkouts.length}</strong>
                <span>sessions</span>
              </div>
              <div>
                <strong>{weekSets}</strong>
                <span>{weekCardio.distanceKm > 0 ? 'sets / splits' : 'working sets'}</span>
              </div>
              <div>
                <strong>{weekCardio.distanceKm > 0
                  ? formatCardioDistance(weekCardio.distanceKm, distanceUnit)
                  : compactNumber(weekVolume)}</strong>
                <span>{weekCardio.distanceKm > 0 ? `${distanceUnit} running` : `${unit} volume`}</span>
              </div>
            </div>
            <div className="week-bars" aria-label={weekWorkouts.length + ' workouts this week'}>
              {Array.from({ length: 7 }, (_, index) => {
                const date = new Date()
                date.setDate(date.getDate() - (6 - index))
                const trained = weekWorkouts.some(
                  (workout) => new Date(workout.startedAt).toDateString() === date.toDateString(),
                )
                return (
                  <div key={index} className={trained ? 'trained' : ''}>
                    <i />
                    <span>{formatDate(date, { weekday: 'narrow' })}</span>
                  </div>
                )
              })}
            </div>
          </section>

          <section className="recent-panel">
            <div className="section-heading section-heading--small">
              <div>
                <h2>Last workout</h2>
              </div>
            </div>
            {latestWorkout ? (
              <button className="recent-workout" onClick={() => openWorkout(latestWorkout)}>
                <div className="date-tile">
                  <span>{formatDate(latestWorkout.startedAt, { month: 'short' })}</span>
                  <strong>{formatDate(latestWorkout.startedAt, { day: '2-digit' })}</strong>
                </div>
                <div>
                  <strong>{latestWorkout.name}</strong>
                  <span>{latestCardio?.distanceKm > 0
                    ? `${formatCardioDistance(latestCardio.distanceKm, distanceUnit)} ${distanceUnit} · ${formatCardioPace(latestCardio.paceSecondsPerKm, distanceUnit)}`
                    : `${latestWorkout.exercises.length} exercises · ${Math.round(latestWorkout.durationSeconds / 60)} min`}</span>
                </div>
                <ChevronRight size={18} />
              </button>
            ) : (
              <p className="muted-copy">Your first completed workout will appear here.</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  )
}
