import { motion } from 'motion/react'
import { Suspense, useState } from 'react'
import { FeatureLoader, ViewHeader } from '../components/AppChrome.jsx'
import { MeasurementsPanel, MuscleBreakdown, ProgressPhotos, TrainingCalendar } from '../features.js'
import { compactNumber } from '../lib/format.js'
import { MOTION } from '../lib/motion.js'
import { completedSetCount, getPersonalRecords, getWeeklyVolume, workoutVolume } from '../lib/workout.js'

export function ProgressView({
  workouts,
  unit,
  exerciseMap,
  measurements,
  addMeasurement,
  deleteMeasurement,
  photos,
  addProgressPhoto,
  deleteProgressPhoto,
  openWorkout,
}) {
  const [section, setSection] = useState('overview')
  const last30 = workouts.filter(
    (workout) => new Date(workout.startedAt).getTime() >= Date.now() - 30 * 86400000,
  )
  const totalVolume = last30.reduce((total, workout) => total + workoutVolume(workout), 0)
  const totalSets = last30.reduce((total, workout) => total + completedSetCount(workout), 0)
  const averageMinutes = last30.length
    ? Math.round(last30.reduce((total, workout) => total + workout.durationSeconds, 0) / last30.length / 60)
    : 0
  const prs = getPersonalRecords(workouts)
  const weekly = getWeeklyVolume(workouts)

  return (
    <div className="content-width">
      <ViewHeader
        title="Training progress"
        subtitle="Consistency, muscle balance, strength records, and body metrics."
      />

      <div className="progress-tabs" role="tablist" aria-label="Progress views">
        {[
          ['overview', 'Overview'],
          ['calendar', 'Calendar'],
          ['body', 'Body'],
        ].map(([id, label]) => (
          <button
            key={id}
            className={section === id ? 'is-active' : ''}
            onClick={() => setSection(id)}
            role="tab"
            aria-selected={section === id}
          >
            {label}
          </button>
        ))}
      </div>

      <>
        {section === 'overview' && (
          <motion.div key="overview" {...MOTION}>
            <section className="metric-band">
              <div>
                <span>SESSIONS</span>
                <strong>{last30.length}</strong>
                <small>last 30 days</small>
              </div>
              <div>
                <span>WORKING SETS</span>
                <strong>{totalSets}</strong>
                <small>last 30 days</small>
              </div>
              <div>
                <span>VOLUME</span>
                <strong>{compactNumber(totalVolume)}</strong>
                <small>{unit} moved</small>
              </div>
              <div>
                <span>AVG. SESSION</span>
                <strong>{averageMinutes}</strong>
                <small>minutes</small>
              </div>
            </section>

            <div className="progress-layout">
              <section className="chart-section">
                <div className="section-heading">
                  <div>
                    <h2>Weekly volume</h2>
                  </div>
                  <span className="chart-unit">{unit}</span>
                </div>
                <VolumeChart data={weekly} />
              </section>

              <section className="records-section">
                <div className="section-heading">
                  <div>
                    <h2>Personal records</h2>
                  </div>
                </div>
                <div className="record-list">
                  {prs.slice(0, 5).map((record, index) => (
                    <div className="record-row" key={record.exerciseId}>
                      <span className="record-rank">{String(index + 1).padStart(2, '0')}</span>
                      <span className="record-main">
                        <strong>{exerciseMap.get(record.exerciseId)?.name || 'Exercise'}</strong>
                        <small>Estimated 1RM</small>
                      </span>
                      <span className="record-value">
                        <strong>{record.estimate}</strong>
                        <small>{unit}</small>
                      </span>
                    </div>
                  ))}
                  {!prs.length && <p className="muted-copy">Complete weighted sets to see records here.</p>}
                </div>
              </section>
            </div>
            <Suspense fallback={<FeatureLoader compact />}>
              <MuscleBreakdown workouts={workouts} exerciseMap={exerciseMap} />
            </Suspense>
          </motion.div>
        )}
        {section === 'calendar' && (
          <motion.div key="calendar" {...MOTION}>
            <Suspense fallback={<FeatureLoader compact />}>
              <TrainingCalendar workouts={workouts} onSelectWorkout={openWorkout} />
            </Suspense>
          </motion.div>
        )}
        {section === 'body' && (
          <motion.div key="body" {...MOTION}>
            <Suspense fallback={<FeatureLoader compact />}>
              <MeasurementsPanel
                measurements={measurements}
                onAdd={addMeasurement}
                onDelete={deleteMeasurement}
                unit={unit}
              />
              <ProgressPhotos
                photos={photos}
                onAdd={addProgressPhoto}
                onDelete={deleteProgressPhoto}
              />
            </Suspense>
          </motion.div>
        )}
      </>
    </div>
  )
}

export function VolumeChart({ data }) {
  const max = Math.max(...data.map((item) => item.value), 1)
  const points = data.map((item, index) => ({
    x: 18 + index * (364 / Math.max(data.length - 1, 1)),
    y: 154 - (item.value / max) * 116,
    ...item,
  }))
  const line = points.map((point, index) => (index === 0 ? 'M ' : 'L ') + point.x + ' ' + point.y).join(' ')
  const area = line + ' L ' + points.at(-1).x + ' 168 L ' + points[0].x + ' 168 Z'

  return (
    <div className="chart-wrap">
      <svg viewBox="0 0 400 200" role="img" aria-label="Weekly workout volume">
        {[38, 78, 118, 158].map((y) => (
          <line key={y} x1="18" y1={y} x2="382" y2={y} className="chart-gridline" />
        ))}
        <motion.path
          d={area}
          className="chart-area"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        />
        <motion.path
          d={line}
          className="chart-line"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        />
        {points.map((point) => (
          <g key={point.label}>
            <circle cx={point.x} cy={point.y} r="4.5" className="chart-dot" />
            <text x={point.x} y="192" textAnchor="middle" className="chart-label">{point.label}</text>
          </g>
        ))}
      </svg>
    </div>
  )
}
