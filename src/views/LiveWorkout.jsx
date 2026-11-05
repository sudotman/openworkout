import {
  Anchor,
  Check,
  Dumbbell,
  Ellipsis,
  Link2,
  ListPlus,
  Minus,
  NotebookPen,
  Pause,
  Play,
  Plus,
  TimerReset,
  TrendingUp,
  Wrench,
} from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { CardioTracker } from '../features.js'
import { addedWeight, formatLoad, normalizeBaseWeight } from '../lib/base-weight.js'
import { formatCardioDistance, formatCardioPace, getCardioSummary, workoutIsCardioOnly } from '../lib/cardio.js'
import { compactNumber, formatDuration, previousSetLabel } from '../lib/format.js'
import { completedSetCount, getTrackingType, workoutVolume } from '../lib/workout.js'

export function SessionBar({
  workout,
  elapsedSeconds,
  completed,
  planned,
  openTools,
  openDiscard,
  openFinish,
  toggleWorkoutTimer,
}) {
  const progress = planned > 0 ? Math.min(1, completed / planned) : 0
  return (
    <header className="session-bar">
      <button
        className={'session-timer ' + (workout.pausedAt ? 'is-paused' : '')}
        onClick={toggleWorkoutTimer}
        aria-label={workout.pausedAt ? 'Resume workout timer' : 'Pause workout timer'}
      >
        {workout.pausedAt ? <Play size={14} fill="currentColor" /> : <Pause size={14} fill="currentColor" />}
        <strong>{formatDuration(elapsedSeconds)}</strong>
      </button>

      <div className="session-progress">
        <span>
          <b>{completed}</b>/{planned} {planned === 1 ? 'set' : 'sets'}
        </span>
        <i style={{ '--session-progress': progress }} aria-hidden="true" />
      </div>

      <div className="session-bar-actions">
        <button className="icon-button icon-button--bare" onClick={openTools} aria-label="Open workout tools">
          <Wrench size={19} />
        </button>
        <button className="icon-button icon-button--bare" onClick={openDiscard} aria-label="Workout options">
          <Ellipsis size={21} />
        </button>
        <button
          className="session-finish"
          onClick={openFinish}
          disabled={completed === 0}
        >
          Finish
        </button>
      </div>
    </header>
  )
}

export function SetRow({
  item,
  set,
  setIndex,
  previousSet,
  trackingType,
  baseWeight,
  unit,
  updateSet,
  updateWeight,
  toggleSet,
  openSetOptions,
}) {
  const added = addedWeight(set.weight, baseWeight)
  const showTotal = baseWeight > 0 && set.weight !== '' && set.weight != null
  const selectOnFocus = (event) => event.target.select()

  return (
    <div
      className={'set-grid set-row ' + (set.completed ? 'is-complete' : '')}
      data-set-id={set.id}
    >
      <button
        className={'set-number set-number--' + (set.type || 'normal')}
        onClick={() => openSetOptions(item.id, set.id)}
        aria-label={'Options for set ' + (setIndex + 1) + ', ' + (set.type || 'normal')}
      >
        {set.type === 'warmup' ? 'W' : set.type === 'drop' ? 'D' : set.type === 'failure' ? 'F' : setIndex + 1}
      </button>

      <span className="previous-value">
        {previousSetLabel(previousSet, trackingType, baseWeight)}
      </span>

      {trackingType === 'duration' ? (
        <div className="set-field">
          <input
            inputMode="numeric"
            type="number"
            min="0"
            enterKeyHint="next"
            value={set.duration ?? ''}
            placeholder="—"
            aria-label={'Set ' + (setIndex + 1) + ' duration in seconds'}
            onFocus={selectOnFocus}
            onChange={(event) => updateSet(item.id, set.id, 'duration', event.target.value)}
          />
        </div>
      ) : (
        <div className="set-field">
          <input
            inputMode="decimal"
            type="number"
            min="0"
            step="0.5"
            enterKeyHint="next"
            value={added}
            placeholder="—"
            aria-label={
              baseWeight > 0
                ? 'Set ' + (setIndex + 1) + ' weight added to a ' + formatLoad(baseWeight) + ' ' + unit + ' base'
                : 'Set ' + (setIndex + 1) + ' weight in ' + unit
            }
            onFocus={selectOnFocus}
            onChange={(event) => updateWeight(item.id, set.id, event.target.value)}
          />
          {showTotal && (
            <span className="set-total" aria-hidden="true">{formatLoad(set.weight)}</span>
          )}
        </div>
      )}

      {trackingType === 'duration' ? (
        <span className="set-static-value" />
      ) : (
        <div className="set-field">
          <input
            inputMode={trackingType === 'distance' ? 'decimal' : 'numeric'}
            type="number"
            min="0"
            step={trackingType === 'distance' ? '1' : undefined}
            enterKeyHint="next"
            value={trackingType === 'distance' ? set.distance ?? '' : set.reps}
            placeholder="—"
            aria-label={
              'Set ' + (setIndex + 1) + (trackingType === 'distance' ? ' distance in meters' : ' repetitions')
            }
            onFocus={selectOnFocus}
            onChange={(event) =>
              updateSet(item.id, set.id, trackingType === 'distance' ? 'distance' : 'reps', event.target.value)
            }
          />
        </div>
      )}

      <button
        className={'set-rpe ' + (set.rpe === '' || set.rpe == null ? 'is-empty' : '')}
        onClick={() => openSetOptions(item.id, set.id)}
        aria-label={'Set ' + (setIndex + 1) + ' RPE' + (set.rpe ? ', currently ' + set.rpe : ', not set')}
      >
        {set.rpe === '' || set.rpe == null ? '–' : set.rpe}
      </button>

      <button
        className="complete-set"
        onClick={() => toggleSet(item.id, set.id)}
        aria-label={(set.completed ? 'Mark set ' + (setIndex + 1) + ' incomplete' : 'Complete set ' + (setIndex + 1))}
        aria-pressed={Boolean(set.completed)}
      >
        <Check size={19} strokeWidth={3} />
      </button>
    </div>
  )
}

export function LiveWorkout({
  workout,
  elapsedSeconds,
  unit,
  distanceUnit,
  exerciseMap,
  previousWorkouts,
  updateActiveWorkout,
  updateSet,
  updateWeight,
  toggleSet,
  addSet,
  removeSet,
  openExercisePicker,
  openExercise,
  openExerciseMenu,
  openSetOptions,
  openBaseWeight,
  openTools,
  openFinish,
  openDiscard,
  toggleWorkoutTimer,
  keepPreviousLoad,
}) {
  const [openNotes, setOpenNotes] = useState(() => new Set())
  const cardioSummary = getCardioSummary(workout, exerciseMap, { completedOnly: false })
  const completedCardio = getCardioSummary(workout, exerciseMap)
  const cardioOnly = workoutIsCardioOnly(workout, exerciseMap)
  const completedWork = completedSetCount(workout)
  const plannedWork = workout.exercises.reduce((total, item) => total + (item.sets?.length || 0), 0)

  const keepNoteOpen = (id) =>
    setOpenNotes((current) => (current.has(id) ? current : new Set(current).add(id)))

  const toggleNote = (id) =>
    setOpenNotes((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <div className="live-workout">
      <SessionBar
        workout={workout}
        elapsedSeconds={elapsedSeconds}
        completed={completedWork}
        planned={plannedWork}
        openTools={openTools}
        openDiscard={openDiscard}
        openFinish={openFinish}
        toggleWorkoutTimer={toggleWorkoutTimer}
      />

      <div className="live-body content-width content-width--narrow">
        <input
          className="workout-title-input"
          value={workout.name}
          onChange={(event) => {
            const name = event.target.value
            updateActiveWorkout((current) => ({ ...current, name }))
          }}
          aria-label="Workout name"
        />

        <div className="live-summary">
          {cardioSummary.distanceKm > 0 && (
            <span>{formatCardioDistance(cardioSummary.distanceKm, distanceUnit)} {distanceUnit}</span>
          )}
          {cardioSummary.paceSecondsPerKm > 0 && (
            <span>{formatCardioPace(cardioSummary.paceSecondsPerKm, distanceUnit)} pace</span>
          )}
          {!cardioOnly && <span>{workout.exercises.length} exercises</span>}
          {completedCardio.segmentCount > 0 && (
            <span>{completedCardio.segmentCount} {completedCardio.segmentCount === 1 ? 'split' : 'splits'}</span>
          )}
          {!cardioOnly && <span>{compactNumber(workoutVolume(workout))} {unit} volume</span>}
        </div>

        <div className="exercise-stack">
          {workout.exercises.map((item, itemIndex) => {
            const exercise = exerciseMap.get(item.exerciseId)
            const trackingType = getTrackingType(exercise)
            const previous = previousWorkouts
              .map((past) => past.exercises?.find((entry) => entry.exerciseId === item.exerciseId))
              .find(Boolean)
            const baseWeight = normalizeBaseWeight(item.baseWeight)
            const noteOpen = openNotes.has(item.id) || Boolean(item.notes)
            return (
              <motion.section
                layout
                className={'log-exercise ' + (item.supersetId ? 'is-superset' : '')}
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="log-exercise-head">
                  {item.supersetId && <span className="superset-mark"><Link2 size={12} /> SUPERSET</span>}
                  <button className="exercise-title-button" onClick={() => openExercise(item.exerciseId)}>
                    <span className="exercise-number">{String(itemIndex + 1).padStart(2, '0')}</span>
                    <span>
                      <strong>{exercise?.name || 'Exercise'}</strong>
                      <small>
                        {exercise?.primaryMuscle} · {exercise?.equipment}
                        {item.targetMinReps ? ' · target ' + item.targetMinReps + (item.targetMaxReps && item.targetMaxReps !== item.targetMinReps ? '–' + item.targetMaxReps : '') + ' reps' : ''}
                      </small>
                    </span>
                  </button>
                  <button
                    className="icon-button icon-button--quiet"
                    aria-label={'Options for ' + (exercise?.name || 'exercise')}
                    onClick={() => openExerciseMenu(item.id)}
                  >
                    <Ellipsis size={21} />
                  </button>
                </div>

                {trackingType === 'cardio' ? (
                  <CardioTracker
                    item={item}
                    exercise={exercise}
                    previous={previous}
                    distanceUnit={distanceUnit}
                    updateSet={updateSet}
                    toggleSet={toggleSet}
                    addSet={addSet}
                    removeSet={removeSet}
                  />
                ) : (
                  <>
                    {trackingType !== 'duration' && (
                      <button
                        className={'base-weight-chip ' + (baseWeight ? 'is-set' : '')}
                        onClick={() => openBaseWeight(item.id)}
                      >
                        <Anchor size={13} />
                        {baseWeight
                          ? 'Starts at ' + formatLoad(baseWeight) + ' ' + unit
                          : 'Set base weight'}
                      </button>
                    )}

                    {item.progression && (
                      <div className="progression-hint">
                        <TrendingUp size={15} />
                        <p>
                          <strong>+{formatLoad(item.progression.increment)} {unit} today.</strong>{' '}
                          You hit {item.progression.topReps}+ reps on every set last time.
                        </p>
                        <button onClick={() => keepPreviousLoad(item.id)}>
                          Keep {formatLoad(addedWeight(item.progression.fromWeight, baseWeight))}
                        </button>
                      </div>
                    )}

                    <div className="set-grid set-grid--header" aria-hidden="true">
                      <span>SET</span>
                      <span>PREV</span>
                      <span>
                        {trackingType === 'duration'
                          ? 'SECS'
                          : baseWeight
                            ? '+' + unit.toUpperCase()
                            : unit.toUpperCase()}
                      </span>
                      <span>{trackingType === 'distance' ? 'METRES' : trackingType === 'duration' ? '' : 'REPS'}</span>
                      <span>RPE</span>
                      <span />
                    </div>

                    <div className="set-list">
                      {item.sets.map((set, setIndex) => (
                        <SetRow
                          key={set.id}
                          item={item}
                          set={set}
                          setIndex={setIndex}
                          previousSet={previous?.sets?.[setIndex]}
                          trackingType={trackingType}
                          baseWeight={baseWeight}
                          unit={unit}
                          updateSet={updateSet}
                          updateWeight={updateWeight}
                          toggleSet={toggleSet}
                          openSetOptions={openSetOptions}
                        />
                      ))}
                    </div>

                    <div className="log-exercise-foot">
                      <button className="add-set-button" onClick={() => addSet(item.id)}>
                        <Plus size={15} /> Add set
                      </button>
                      {!noteOpen && (
                        <button className="note-toggle" onClick={() => toggleNote(item.id)}>
                          <NotebookPen size={15} /> Note
                        </button>
                      )}
                    </div>
                  </>
                )}

                {noteOpen && (
                  <textarea
                    className="exercise-notes"
                    placeholder="Add a note for this exercise…"
                    value={item.notes}
                    rows={1}
                    // Pinned open once touched, so clearing the last character
                    // doesn't pull the field (and the keyboard) out from under you.
                    onFocus={() => keepNoteOpen(item.id)}
                    onChange={(event) => {
                      const notes = event.target.value
                      updateActiveWorkout((current) => ({
                        ...current,
                        exercises: current.exercises.map((exercise) =>
                          exercise.id === item.id ? { ...exercise, notes } : exercise,
                        ),
                      }))
                    }}
                    aria-label={'Notes for ' + (exercise?.name || 'exercise')}
                  />
                )}
              </motion.section>
            )
          })}
        </div>

        {workout.exercises.length === 0 && (
          <div className="empty-workout">
            <span className="empty-icon"><Dumbbell size={28} /></span>
            <h2>Add your first exercise</h2>
            <p>Pick from {exerciseMap.size} exercises, or create your own.</p>
          </div>
        )}

        <button className="button button--outline button--wide" onClick={openExercisePicker}>
          <ListPlus size={18} /> Add exercise
        </button>

        <label className="session-notes">
          <span>SESSION NOTES</span>
          <textarea
            rows={2}
            value={workout.notes || ''}
            onChange={(event) => {
              const notes = event.target.value
              updateActiveWorkout((current) => ({ ...current, notes }))
            }}
            placeholder="How did it go?"
          />
        </label>
      </div>
    </div>
  )
}

export function RestTimer({ remaining, total, adjust, skip }) {
  const progress = Math.max(0, Math.min(1, remaining / Math.max(total, 1)))
  return (
    <motion.div
      className="rest-timer"
      initial={{ opacity: 0, y: 28, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 18, scale: 0.96 }}
    >
      <div
        className="rest-progress"
        style={{ '--rest-progress': String(progress * 360) + 'deg' }}
      >
        <TimerReset size={17} />
      </div>
      <div className="rest-copy">
        <span>REST TIMER</span>
        <strong>{formatDuration(remaining)}</strong>
      </div>
      <button onClick={() => adjust(-15)} aria-label="Subtract 15 seconds">
        <Minus size={17} />
      </button>
      <button onClick={() => adjust(15)} aria-label="Add 15 seconds">
        <Plus size={17} />
      </button>
      <button className="skip-rest" onClick={skip}>Skip</button>
    </motion.div>
  )
}
