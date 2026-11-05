import {
  Check,
  ChevronRight,
  Copy,
  ListPlus,
  NotebookPen,
  Share2,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'
import { formatLoad, normalizeBaseWeight } from '../../lib/base-weight.js'
import {
  formatCardioDistance,
  formatCardioPace,
  formatCardioSpeed,
  formatCardioTime,
  getCardioSummary,
  workoutIsCardioOnly,
} from '../../lib/cardio.js'
import { compactNumber, completedSetLabel, formatDate, formatDuration } from '../../lib/format.js'
import {
  completedSetCount,
  getTrackingType,
  sameExerciseOrder,
  workoutExerciseIds,
  workoutVolume,
} from '../../lib/workout.js'
import { SheetHeading } from './Sheet.jsx'

export function WorkoutDaySheet({ workouts, unit, distanceUnit, exerciseMap, openWorkout }) {
  const date = workouts[0]?.startedAt || workouts[0]?.completedAt
  return (
    <div className="sheet-content workout-day-sheet">
      <SheetHeading
        title={formatDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}
        body={workouts.length + ' sessions completed.'}
      />
      <div className="workout-day-list">
        {workouts.map((workout) => {
          const cardio = getCardioSummary(workout, exerciseMap)
          const cardioOnly = workoutIsCardioOnly(workout, exerciseMap)
          return (
          <button key={workout.id} onClick={() => openWorkout(workout)}>
            <span>
              <strong>{workout.name}</strong>
              <small>
                {workout.exercises.slice(0, 3)
                  .map((item) => exerciseMap.get(item.exerciseId)?.name)
                  .filter(Boolean)
                  .join(' · ')}
              </small>
            </span>
            <span>
              <strong>{Math.round((cardioOnly && cardio.totalDurationSeconds ? cardio.totalDurationSeconds : workout.durationSeconds) / 60)} min</strong>
              <small>{cardio.distanceKm > 0
                ? `${formatCardioDistance(cardio.distanceKm, distanceUnit)} ${distanceUnit} · ${formatCardioPace(cardio.paceSecondsPerKm, distanceUnit)}`
                : `${compactNumber(workoutVolume(workout))} ${unit}`}</small>
            </span>
            <ChevronRight size={18} />
          </button>
          )
        })}
      </div>
    </div>
  )
}

export function WorkoutDetail({
  workout,
  unit,
  distanceUnit,
  exerciseMap,
  updateWorkout,
  deleteWorkout,
  repeatWorkout,
  openShare,
  saveWorkoutAsRoutine,
}) {
  const [editing, setEditing] = useState(false)
  const [deleteArmed, setDeleteArmed] = useState(false)
  const [name, setName] = useState(workout?.name || '')
  const [date, setDate] = useState(workout?.startedAt ? new Date(workout.startedAt).toISOString().slice(0, 10) : '')
  // Sets are edited on a copy, so a half-typed correction never touches
  // records or volume until Save.
  const [draft, setDraft] = useState(null)
  if (!workout) return null
  const cardio = getCardioSummary(workout, exerciseMap)
  const cardioOnly = workoutIsCardioOnly(workout, exerciseMap)
  const strengthSetCount = Math.max(0, completedSetCount(workout) - cardio.segmentCount)
  const hybrid = cardio.distanceKm > 0 && strengthSetCount > 0
  const summaryBody = hybrid
    ? `${formatCardioDistance(cardio.distanceKm, distanceUnit)} ${distanceUnit} · ${formatCardioPace(cardio.paceSecondsPerKm, distanceUnit)} · ${strengthSetCount} lifting ${strengthSetCount === 1 ? 'set' : 'sets'} · ${compactNumber(workoutVolume(workout))} ${unit}`
    : cardioOnly && cardio.distanceKm > 0
    ? `${formatCardioTime(cardio.totalDurationSeconds)} · ${formatCardioDistance(cardio.distanceKm, distanceUnit)} ${distanceUnit} · ${formatCardioPace(cardio.paceSecondsPerKm, distanceUnit)}`
    : Math.round(workout.durationSeconds / 60) + ' min · ' + completedSetCount(workout) + ' sets · ' + compactNumber(workoutVolume(workout)) + ' ' + unit
  const startEditing = () => {
    setName(workout.name || '')
    setDate(new Date(workout.startedAt).toISOString().slice(0, 10))
    setDraft(workout.exercises.map((item) => ({ ...item, sets: item.sets.map((set) => ({ ...set })) })))
    setEditing(true)
  }
  const stopEditing = () => {
    setEditing(false)
    setDraft(null)
  }
  const editSet = (itemId, setId, field, value) => {
    const parsed = value === '' ? '' : Math.max(0, Number(value))
    if (parsed !== '' && !Number.isFinite(parsed)) return
    setDraft((current) =>
      current.map((item) =>
        item.id === itemId
          ? { ...item, sets: item.sets.map((set) => (set.id === setId ? { ...set, [field]: parsed } : set)) }
          : item,
      ),
    )
  }
  const removeDraftSet = (itemId, setId) => {
    setDraft((current) =>
      current.map((item) =>
        item.id === itemId ? { ...item, sets: item.sets.filter((set) => set.id !== setId) } : item,
      ),
    )
  }
  const saveDetails = () => {
    const nextDate = new Date(workout.startedAt)
    const [year, month, day] = date.split('-').map(Number)
    if (year && month && day) nextDate.setFullYear(year, month - 1, day)
    updateWorkout(workout.id, {
      name: name.trim() || 'Workout',
      startedAt: nextDate.toISOString(),
      exercises: (draft || workout.exercises).filter((item) => item.sets.length),
    })
    stopEditing()
  }
  const exercisesShown = editing && draft ? draft : workout.exercises
  return (
    <div className="sheet-content workout-detail">
      <SheetHeading
        eyebrow={formatDate(workout.startedAt, { weekday: 'long', day: 'numeric', month: 'long' })}
        title={workout.name}
        body={summaryBody}
      />
      <div className="workout-detail-actions">
        <button onClick={editing ? stopEditing : startEditing} aria-pressed={editing}>
          <NotebookPen size={16} /> {editing ? 'Editing' : 'Edit'}
        </button>
        <button onClick={() => repeatWorkout(workout)}><Copy size={16} /> Repeat</button>
        <button onClick={() => openShare(workout)}><Share2 size={16} /> Share</button>
        <button className="save-routine-action" onClick={() => saveWorkoutAsRoutine(workout)}>
          <ListPlus size={16} /> Save as routine
        </button>
      </div>
      {editing && (
        <div className="workout-edit-form">
          <label>
            <span>WORKOUT NAME</span>
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label>
            <span>DATE</span>
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
          <p>Correct any logged set below. Records and volume update when you save.</p>
        </div>
      )}
      {cardio.distanceKm > 0 && (
        <div className="workout-cardio-summary">
          <div><span>DISTANCE</span><strong>{formatCardioDistance(cardio.distanceKm, distanceUnit)} <small>{distanceUnit}</small></strong></div>
          <div><span>PACE</span><strong>{formatCardioPace(cardio.paceSecondsPerKm, distanceUnit)}</strong></div>
          <div><span>AVG SPEED</span><strong>{formatCardioSpeed(cardio.averageSpeedKph, distanceUnit)}</strong></div>
        </div>
      )}
      <div className="workout-detail-list">
        {exercisesShown.map((item, index) => {
          const exercise = exerciseMap.get(item.exerciseId)
          const trackingType = getTrackingType(exercise)
          const completedCount = item.sets.filter((set) => set.completed).length
          const workLabel = trackingType === 'cardio'
            ? completedCount === 1 ? 'split' : 'splits'
            : completedCount === 1 ? 'set' : 'sets'
          return (
            <section key={item.id}>
              <div className="workout-detail-exercise">
                <span>{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <strong>{exercise?.name || 'Exercise'}</strong>
                  <small>
                    {exercise?.primaryMuscle} · {completedCount} {workLabel}
                    {normalizeBaseWeight(item.baseWeight)
                      ? ' · from ' + formatLoad(item.baseWeight) + ' ' + unit
                      : ''}
                  </small>
                </div>
              </div>
              {editing && trackingType !== 'cardio' ? (
                <div className="editable-sets">
                  {item.sets.filter((set) => set.completed).map((set, setIndex) => (
                    <div key={set.id}>
                      <span>SET {setIndex + 1}</span>
                      {trackingType === 'duration' ? (
                        <label>
                          <input
                            type="number"
                            inputMode="numeric"
                            min="0"
                            value={set.duration ?? ''}
                            onChange={(event) => editSet(item.id, set.id, 'duration', event.target.value)}
                            aria-label={'Set ' + (setIndex + 1) + ' seconds'}
                          />
                          <small>sec</small>
                        </label>
                      ) : (
                        <>
                          <label>
                            <input
                              type="number"
                              inputMode="decimal"
                              min="0"
                              step="any"
                              value={set.weight ?? ''}
                              onChange={(event) => editSet(item.id, set.id, 'weight', event.target.value)}
                              aria-label={'Set ' + (setIndex + 1) + ' total weight in ' + unit}
                            />
                            <small>{unit}</small>
                          </label>
                          <label>
                            <input
                              type="number"
                              inputMode="numeric"
                              min="0"
                              value={(trackingType === 'distance' ? set.distance : set.reps) ?? ''}
                              onChange={(event) =>
                                editSet(item.id, set.id, trackingType === 'distance' ? 'distance' : 'reps', event.target.value)
                              }
                              aria-label={'Set ' + (setIndex + 1) + (trackingType === 'distance' ? ' metres' : ' reps')}
                            />
                            <small>{trackingType === 'distance' ? 'm' : 'reps'}</small>
                          </label>
                        </>
                      )}
                      <button onClick={() => removeDraftSet(item.id, set.id)} aria-label={'Remove set ' + (setIndex + 1)}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="readonly-sets">
                  {item.sets.filter((set) => set.completed).map((set, setIndex) => (
                    <div key={set.id}>
                      <span>{trackingType === 'cardio' ? 'SPLIT' : 'SET'} {setIndex + 1}</span>
                      <strong>{completedSetLabel(set, trackingType, unit, distanceUnit)}</strong>
                      <small>{set.rpe ? 'RPE ' + set.rpe : '—'}</small>
                    </div>
                  ))}
                </div>
              )}
              {item.notes && <p className="detail-note">{item.notes}</p>}
            </section>
          )
        })}
      </div>
      {workout.notes && (
        <div className="session-note-detail">
          <span>SESSION NOTES</span>
          <p>{workout.notes}</p>
        </div>
      )}
      {editing && (
        <div className="workout-edit-bar">
          <button className="button button--ghost" onClick={stopEditing}>Cancel</button>
          <button className="button button--dark" onClick={saveDetails}>Save changes</button>
        </div>
      )}
      {!editing && !deleteArmed ? (
        <button className="delete-history-button" onClick={() => setDeleteArmed(true)}>
          <Trash2 size={15} /> Delete workout
        </button>
      ) : !editing && (
        <div className="delete-history-confirm">
          <span>Delete this workout permanently?</span>
          <button onClick={() => setDeleteArmed(false)}>Cancel</button>
          <button onClick={() => deleteWorkout(workout.id)}>Delete</button>
        </div>
      )}
    </div>
  )
}

export function FinishWorkoutSheet({ workout, elapsedSeconds, unit, distanceUnit, exerciseMap, sourceRoutine, finishWorkout, cancel }) {
  const currentExerciseIds = workoutExerciseIds(workout)
  const cardio = getCardioSummary(workout, exerciseMap)
  const cardioOnly = workoutIsCardioOnly(workout, exerciseMap)
  const strengthSetCount = Math.max(0, completedSetCount(workout) - cardio.segmentCount)
  const hybrid = cardio.distanceKm > 0 && strengthSetCount > 0
  const routineChanged = sourceRoutine && !sameExerciseOrder(
    currentExerciseIds,
    sourceRoutine.exerciseIds || [],
  )
  const canCreateRoutine = currentExerciseIds.length > 0

  return (
    <div className="sheet-content compact-sheet">
      <span className="confirm-icon confirm-icon--success"><Check size={25} /></span>
      <SheetHeading
        title="Finish workout?"
        body={routineChanged
          ? 'You changed the exercise lineup. Choose what should happen to the routine.'
          : 'Review the summary before you save.'}
      />
      <div className="finish-summary">
        {hybrid ? (
          <>
            <div><span>DISTANCE</span><strong>{formatCardioDistance(cardio.distanceKm, distanceUnit)} <small>{distanceUnit}</small></strong></div>
            <div><span>PACE</span><strong>{formatCardioPace(cardio.paceSecondsPerKm, distanceUnit)}</strong></div>
            <div><span>LIFT VOLUME</span><strong>{compactNumber(workoutVolume(workout))} <small>{unit}</small></strong></div>
          </>
        ) : cardioOnly ? (
          <>
            <div><span>TIME</span><strong>{formatDuration(cardio.totalDurationSeconds || elapsedSeconds)}</strong></div>
            <div><span>DISTANCE</span><strong>{formatCardioDistance(cardio.distanceKm, distanceUnit)} <small>{distanceUnit}</small></strong></div>
            <div><span>PACE</span><strong>{formatCardioPace(cardio.paceSecondsPerKm, distanceUnit)}</strong></div>
          </>
        ) : (
          <>
            <div><span>TIME</span><strong>{formatDuration(elapsedSeconds)}</strong></div>
            <div><span>SETS</span><strong>{completedSetCount(workout)}</strong></div>
            <div><span>VOLUME</span><strong>{compactNumber(workoutVolume(workout))} <small>{unit}</small></strong></div>
          </>
        )}
      </div>
      {routineChanged ? (
        <div className="finish-routine-actions">
          <span>ROUTINE CHANGES</span>
          <button className="button button--accent button--wide" onClick={() => finishWorkout('update')}>
            <Check size={18} /> Update {sourceRoutine.name}
          </button>
          <button className="button button--outline button--wide" onClick={() => finishWorkout('create')}>
            <ListPlus size={18} /> Save as new routine
          </button>
          <button className="button button--ghost button--wide" onClick={() => finishWorkout('none')}>
            Save workout only
          </button>
        </div>
      ) : sourceRoutine ? (
        <button className="button button--accent button--wide" onClick={() => finishWorkout('none')}>
          <Check size={18} /> Save workout
        </button>
      ) : (
        <div className="finish-routine-actions">
          <span>SAVE THIS SESSION</span>
          <button
            className="button button--accent button--wide"
            onClick={() => finishWorkout('create')}
            disabled={!canCreateRoutine}
          >
            <ListPlus size={18} /> Save workout + new routine
          </button>
          <button className="button button--ghost button--wide" onClick={() => finishWorkout('none')}>
            Save workout only
          </button>
        </div>
      )}
      <button className="button button--ghost button--wide" onClick={cancel}>Keep training</button>
    </div>
  )
}
