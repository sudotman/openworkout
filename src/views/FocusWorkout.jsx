import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Ellipsis,
  Flag,
  Link2,
  ListPlus,
  Pause,
  Play,
  Plus,
  SkipForward,
  Square,
  Undo2,
} from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { FocusLegend, FocusRings, Stepper } from '../components/FocusParts.jsx'
import { CardioTracker } from '../features.js'
import { addedWeight, formatLoad, normalizeBaseWeight } from '../lib/base-weight.js'
import {
  cardioSetDistanceKm,
  distanceFromKilometers,
  distanceToKilometers,
  formatCardioDistance,
  formatCardioPace,
  formatCardioTime,
  normalizeDistanceUnit,
} from '../lib/cardio.js'
import {
  isRunning,
  runSnapshot,
  setRunValue,
  startRun,
  stopRun,
  tracksDistanceFromSpeed,
} from '../lib/cardio-run.js'
import { fraction, nextFocusSlot, slotAfter, workVersusLast } from '../lib/focus.js'
import { formatDuration, previousSetLabel } from '../lib/format.js'
import { loadIncrement } from '../lib/progression.js'
import { completedSetCount, createWorkoutSet, getTrackingType } from '../lib/workout.js'
import { SessionBar } from './LiveWorkout.jsx'
import '../focus.css'

const round = (value, places = 2) => Math.round(value * 10 ** places) / 10 ** places
const percent = (ratio) => Math.round(ratio * 100) + '%'
const sum = (sets, pick) => sets.reduce((total, set) => total + (Number(pick(set)) || 0), 0)

function setBadge(set, index) {
  if (set.type === 'warmup') return 'W'
  if (set.type === 'drop') return 'D'
  if (set.type === 'failure') return 'F'
  return String(index + 1)
}

/** The value for a time readout, sized down once it grows an hours column. */
function TimeValue({ seconds }) {
  const text = formatCardioTime(seconds)
  return <strong className={'focus-rings-value is-time' + (text.length > 5 ? ' is-long' : '')}>{text}</strong>
}

function DetailField({ label, suffix, value, onChange, step = '1', max }) {
  return (
    <label className="focus-detail">
      <span>{label}</span>
      <span>
        <input
          type="number"
          inputMode="decimal"
          min="0"
          max={max}
          step={step}
          value={value ?? ''}
          placeholder="—"
          onChange={(event) => onChange(event.target.value)}
        />
        {suffix && <small>{suffix}</small>}
      </span>
    </label>
  )
}

export function FocusWorkout({
  workout,
  now,
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
  openTools,
  openFinish,
  openDiscard,
  toggleWorkoutTimer,
  keepPreviousLoad,
  toggleLayout,
  rest,
  adjustRest,
  skipRest,
  sheetOpen,
}) {
  // Where you've chosen to be, when it isn't simply the next set. Moved on
  // whenever a set is ticked off, so the cursor follows the workout.
  const [pinned, setPinned] = useState(null)
  const [manualFor, setManualFor] = useState(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const exercises = workout.exercises
  const completed = completedSetCount(workout)
  const planned = exercises.reduce((total, entry) => total + (entry.sets?.length || 0), 0)
  const cursor = nextFocusSlot(workout)

  const pinnedItem = pinned && exercises.find((entry) => entry.id === pinned.itemId)
  const item = pinnedItem || (cursor ? exercises[cursor.exerciseIndex] : exercises.at(-1))
  const itemIndex = item ? exercises.indexOf(item) : -1
  const set =
    (pinnedItem && pinned.setId && item.sets.find((entry) => entry.id === pinned.setId)) ||
    item?.sets.find((entry) => !entry.completed) ||
    null
  const setIndex = set ? item.sets.indexOf(set) : -1

  const exercise = item ? exerciseMap.get(item.exerciseId) : null
  const trackingType = getTrackingType(exercise)
  const mode = trackingType === 'cardio' ? 'cardio' : trackingType === 'duration' ? 'hold' : 'lift'
  const runOptions = { autoDistance: tracksDistanceFromSpeed(exercise) }
  const running = isRunning(set)
  // Cardio doesn't start a rest, and a rest left over from the last lift
  // shouldn't sit on top of a run.
  const resting = mode !== 'cardio' && set && !set.completed && rest && rest.remaining > 0 ? rest : null

  // Slide in from the side you're heading toward. Tracked as state adjusted
  // during render, so the new card knows its direction on its first frame.
  const [travel, setTravel] = useState({ index: itemIndex, direction: 1 })
  if (travel.index !== itemIndex) {
    setTravel({ index: itemIndex, direction: itemIndex > travel.index ? 1 : -1 })
  }
  const direction = travel.index !== itemIndex ? (itemIndex > travel.index ? 1 : -1) : travel.direction

  const goTo = (index) => {
    const target = exercises[Math.max(0, Math.min(exercises.length - 1, index))]
    if (target && target.id !== item?.id) setPinned({ itemId: target.id })
  }

  const editSet = (setId, change) =>
    updateActiveWorkout((current) => ({
      ...current,
      exercises: current.exercises.map((entry) =>
        entry.id === item.id
          ? { ...entry, sets: entry.sets.map((candidate) => (candidate.id === setId ? change(candidate) : candidate)) }
          : entry,
      ),
    }))

  const moveOn = () => {
    const after = slotAfter(workout, set.id)
    setPinned(after ? { itemId: after.itemId, setId: after.setId } : null)
  }

  const completeSet = () => {
    if (!item || !set) return
    if (set.completed) {
      toggleSet(item.id, set.id)
      setPinned({ itemId: item.id, setId: set.id })
      return
    }
    toggleSet(item.id, set.id)
    moveOn()
  }

  const startTimer = () => {
    if (!set || set.completed) return
    if (rest) skipRest()
    editSet(set.id, (current) => startRun(current, Date.now(), { fresh: !current.timed }))
  }

  const pauseTimer = () => editSet(set.id, (current) => stopRun(current, Date.now(), runOptions))

  // A hold ends by logging it; the rest that follows is toggleSet's to start.
  const stopHold = () => {
    editSet(set.id, (current) => stopRun(current, Date.now(), runOptions))
    toggleSet(item.id, set.id)
    moveOn()
  }

  const finishRun = () => {
    editSet(set.id, (current) => ({ ...stopRun(current, Date.now(), runOptions), completed: true }))
    window.navigator?.vibrate?.(35)
    moveOn()
  }

  // Closes this split and starts the next one on the same clock tick, so not
  // a second is lost between intervals. A split already planned after this one
  // is used before a new one is added. The belt doesn't change when you press
  // lap, so speed and incline carry over.
  const lap = () => {
    const at = Date.now()
    const upcoming = item.sets.slice(setIndex + 1).find((entry) => !entry.completed)
    const belt = { speed: set.speed, incline: set.incline }
    const next = startRun({ ...(upcoming || createWorkoutSet()), ...belt }, at, { fresh: true })
    updateActiveWorkout((current) => ({
      ...current,
      exercises: current.exercises.map((entry) => {
        if (entry.id !== item.id) return entry
        const sets = entry.sets.map((candidate) => {
          if (candidate.id === set.id) return { ...stopRun(candidate, at, runOptions), completed: true }
          if (candidate.id === next.id) return next
          return candidate
        })
        return { ...entry, sets: upcoming ? sets : [...sets, next] }
      }),
    }))
    window.navigator?.vibrate?.([30, 40, 30])
    setPinned({ itemId: item.id, setId: next.id })
  }

  // The one thing the big button does right now, so Space can do it too.
  const mainAction = () => {
    if (!set) return null
    if (set.completed) return completeSet
    if (resting) return skipRest
    if (mode === 'lift') return completeSet
    if (mode === 'hold') return running ? stopHold : startTimer
    return running ? finishRun : startTimer
  }

  // Space runs the main button and the arrow keys move between exercises, for
  // a phone propped up with a keyboard, or a laptop on the bench.
  const keys = useRef({})
  useEffect(() => {
    keys.current = { action: mainAction(), goTo, itemIndex }
  })
  useEffect(() => {
    const onKey = (event) => {
      if (sheetOpen || event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target
      if (target instanceof HTMLElement && target.closest('input, textarea, select, [contenteditable]')) return
      if (event.key === 'ArrowRight') keys.current.goTo(keys.current.itemIndex + 1)
      else if (event.key === 'ArrowLeft') keys.current.goTo(keys.current.itemIndex - 1)
      else if (event.key === ' ' && !(target instanceof HTMLButtonElement)) keys.current.action?.()
      else return
      event.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sheetOpen])

  const sessionBar = (
    <SessionBar
      workout={workout}
      elapsedSeconds={elapsedSeconds}
      completed={completed}
      planned={planned}
      openTools={openTools}
      openDiscard={openDiscard}
      openFinish={openFinish}
      toggleWorkoutTimer={toggleWorkoutTimer}
      layout="focus"
      toggleLayout={toggleLayout}
    />
  )

  if (!item) {
    return (
      <div className="live-workout focus-workout">
        {sessionBar}
        <div className="focus-empty content-width content-width--narrow">
          <span className="empty-icon"><Dumbbell size={28} /></span>
          <h2>Add your first exercise</h2>
          <p>Pick from {exerciseMap.size} exercises, or create your own.</p>
          <button className="button button--primary button--wide" onClick={openExercisePicker}>
            <ListPlus size={18} /> Add exercise
          </button>
        </div>
      </div>
    )
  }

  const previous = previousWorkouts
    .map((past) => past.exercises?.find((entry) => entry.exerciseId === item.exerciseId))
    .find(Boolean)
  const baseWeight = normalizeBaseWeight(item.baseWeight)
  const itemDone = item.sets.filter((entry) => entry.completed).length
  const versus = workVersusLast(item.sets, previous?.sets, trackingType)
  const workoutDone = !cursor && !set
  const prevItem = exercises[itemIndex - 1]
  const nextItem = exercises[itemIndex + 1]
  const nextUp = set && !set.completed ? null : cursor && exercises[cursor.exerciseIndex]
  const target = item.targetMinReps
    ? item.targetMinReps +
      (item.targetMaxReps && item.targetMaxReps !== item.targetMinReps ? '–' + item.targetMaxReps : '')
    : ''
  const du = normalizeDistanceUnit(distanceUnit)
  const snapshot = set && mode !== 'lift' ? runSnapshot(set, now, runOptions) : null
  const elapsed = snapshot?.elapsed || 0

  // ---- What the rings, centre and legend show, by kind of exercise ---------

  let rings
  let legend
  let center

  if (mode === 'cardio') {
    const previousSplits = previous?.sets?.filter((entry) => entry.completed) || []
    const prior = set ? previousSplits[setIndex] || previousSplits[0] : null
    // With every split done, compare the whole session against the last one.
    const doneSplits = item.sets.filter((entry) => entry.completed)
    // A split nobody has started still carries last session's numbers as a
    // logging guess; the readout starts it from zero like the timer will.
    const untouched = set && !set.completed && !set.timed
    const time = !set ? sum(doneSplits, (entry) => entry.duration) : untouched ? 0 : elapsed
    const distance = !set ? sum(doneSplits, cardioSetDistanceKm) : untouched ? 0 : snapshot.distanceKm
    const priorTime = prior ? Number(prior.duration) || 0 : sum(previousSplits, (entry) => entry.duration)
    const priorDistance = prior ? cardioSetDistanceKm(prior) : sum(previousSplits, cardioSetDistanceKm)
    const pace = distance > 0 && time > 0 ? time / distance : 0
    rings = [
      { tone: 'session', value: fraction(completed, planned) },
      { tone: 'exercise', value: priorTime ? Math.min(1, time / priorTime) : 0 },
      { tone: 'versus', value: priorDistance ? Math.min(1, distance / priorDistance) : 0 },
    ]
    legend = [
      { label: 'Time', value: formatCardioTime(time), tone: 'exercise' },
      { label: du, value: formatCardioDistance(distance, du), tone: 'versus' },
      { label: 'Pace', value: pace ? formatCardioPace(pace, du).split(' ')[0] : '—' },
    ]
    const state = !set
      ? 'DONE'
      : set.completed
        ? 'LOGGED'
        : running
          ? 'RUNNING'
          : set.timed && elapsed > 0
            ? 'PAUSED'
            : 'READY'
    center = (
      <>
        <span className={'focus-rings-label' + (running ? ' is-live' : '')}>
          {state}{set && item.sets.length > 1 ? ' · SPLIT ' + (setIndex + 1) : ''}
        </span>
        <TimeValue seconds={time} />
        <span className="focus-rings-sub">
          {distance > 0
            ? formatCardioDistance(distance, du) + ' ' + du
            : priorTime
              ? 'last ' + formatCardioTime(priorTime)
              : ''}
        </span>
      </>
    )
  } else {
    const priorHold = mode === 'hold' && set ? Number(previous?.sets?.[setIndex]?.duration) || 0 : 0
    const liveHold = mode === 'hold' && running && priorHold > 0
    rings = [
      { tone: 'session', value: fraction(completed, planned) },
      { tone: 'exercise', value: fraction(itemDone, item.sets.length) },
      { tone: 'versus', value: liveHold ? Math.min(1, elapsed / priorHold) : versus ? Math.min(1, versus.ratio) : 0 },
    ]
    legend = [
      { label: 'Session', value: completed + '/' + planned, tone: 'session' },
      { label: 'Exercise', value: itemDone + '/' + item.sets.length, tone: 'exercise' },
      {
        label: 'Vs last',
        value: liveHold ? percent(elapsed / priorHold) : versus ? percent(versus.ratio) : 'New',
        tone: 'versus',
      },
    ]
    center = resting ? (
      <>
        <span className="focus-rings-label">REST</span>
        <strong className="focus-rings-value">{formatDuration(resting.remaining)}</strong>
      </>
    ) : running ? (
      <>
        <span className="focus-rings-label is-live">HOLD · SET {setIndex + 1}</span>
        <TimeValue seconds={elapsed} />
      </>
    ) : set ? (
      <>
        <span className="focus-rings-label">{set.completed ? 'LOGGED' : 'SET'}</span>
        <strong className="focus-rings-value">
          {setIndex + 1}<small>/{item.sets.length}</small>
        </strong>
      </>
    ) : (
      <>
        <Check size={34} strokeWidth={2.6} className="focus-rings-check" />
        <span className="focus-rings-label">{workoutDone ? 'ALL DONE' : 'DONE'}</span>
      </>
    )
  }

  // ---- The working area under the rings -----------------------------------

  const restBar = resting && (
    <button
      className="focus-cta is-rest"
      style={{ '--rest-done': 1 - fraction(resting.remaining, resting.total) }}
      onClick={skipRest}
    >
      <SkipForward size={19} /> Skip rest
    </button>
  )

  const undoButton = set?.completed && (
    <button className="focus-cta is-quiet" onClick={completeSet}>
      <Undo2 size={20} /> Undo {mode === 'cardio' ? 'split' : 'set'} {setIndex + 1}
    </button>
  )

  let work = null

  if (set && mode === 'lift') {
    work = (
      <>
        <div className="focus-reference">
          {resting && <b>UP NEXT · SET {setIndex + 1} · </b>}
          {previous?.sets?.[setIndex]
            ? 'LAST TIME ' + previousSetLabel(previous.sets[setIndex], trackingType, baseWeight).replace('×', ' × ')
            : 'NOTHING LOGGED LAST TIME'}
          {item.progression && !set.completed && (
            <button onClick={() => keepPreviousLoad(item.id)} title="Keep last time's load instead">
              +{formatLoad(item.progression.increment)} today
            </button>
          )}
        </div>
        <div className="focus-steppers">
          <Stepper
            label={(baseWeight ? '+' : '') + unit.toUpperCase()}
            ariaLabel={
              baseWeight ? 'Weight added to a ' + formatLoad(baseWeight) + ' ' + unit + ' base' : 'Weight in ' + unit
            }
            value={addedWeight(set.weight, baseWeight)}
            step={loadIncrement(exercise?.equipment, unit)}
            onChange={(value) => updateWeight(item.id, set.id, value)}
          />
          {trackingType === 'distance' ? (
            <Stepper
              label="METRES"
              value={set.distance ?? ''}
              step={5}
              inputMode="numeric"
              onChange={(value) => updateSet(item.id, set.id, 'distance', value)}
            />
          ) : (
            <Stepper
              label="REPS"
              value={set.reps ?? ''}
              step={1}
              inputMode="numeric"
              onChange={(value) => updateSet(item.id, set.id, 'reps', value)}
            />
          )}
        </div>
        {baseWeight > 0 && set.weight !== '' && (
          <p className="focus-total">{formatLoad(set.weight)} {unit} total</p>
        )}
        {undoButton || restBar || (
          <button className="focus-cta" onClick={completeSet}>
            <Check size={22} strokeWidth={3} /> Complete set
          </button>
        )}
      </>
    )
  }

  if (set && mode === 'hold') {
    const priorHold = Number(previous?.sets?.[setIndex]?.duration) || 0
    const logged = Number(set.duration) || 0
    work = (
      <>
        <div className="focus-reference">
          {resting && <b>UP NEXT · SET {setIndex + 1} · </b>}
          {running && priorHold
            ? elapsed < priorHold
              ? <b>{Math.ceil(priorHold - elapsed)}s TO MATCH LAST TIME</b>
              : <b>+{Math.floor(elapsed - priorHold)}s ON LAST TIME</b>
            : priorHold
              ? 'LAST TIME ' + priorHold + ' SEC'
              : 'NOTHING LOGGED LAST TIME'}
        </div>
        {!running && (
          <div className="focus-steppers">
            <Stepper
              label="SECONDS"
              value={set.duration ?? ''}
              step={5}
              inputMode="numeric"
              onChange={(value) => updateSet(item.id, set.id, 'duration', value)}
            />
          </div>
        )}
        {undoButton || restBar || (running ? (
          <button className="focus-cta" onClick={stopHold}>
            <Square size={18} fill="currentColor" /> Stop · log {formatCardioTime(elapsed)}
          </button>
        ) : (
          <div className="focus-cta-row">
            <button className="focus-cta is-quiet" onClick={completeSet} disabled={!logged}>
              <Check size={20} strokeWidth={3} /> Log {logged}s
            </button>
            <button className="focus-cta" onClick={startTimer}>
              <Play size={19} fill="currentColor" /> Start timer
            </button>
          </div>
        ))}
      </>
    )
  }

  if (mode === 'cardio' && manualFor === item.id) {
    work = (
      <div className="focus-cardio">
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
        <button className="focus-link" onClick={() => setManualFor(null)}>
          <Play size={14} /> Use the live timer
        </button>
      </div>
    )
  } else if (set && mode === 'cardio') {
    const previousSplits = previous?.sets?.filter((entry) => entry.completed) || []
    const prior = previousSplits[setIndex] || previousSplits[0]
    const priorTime = Number(prior?.duration) || 0
    const priorDistance = prior ? cardioSetDistanceKm(prior) : 0
    const paused = !running && !set.completed && set.timed && elapsed > 0

    // On a treadmill the distance is known live, so it can be held up against
    // where last time's pace would have you by now.
    let reference
    if (running && runOptions.autoDistance && priorTime > 0 && priorDistance > 0 && elapsed > 20) {
      const gap = snapshot.distanceKm - (priorDistance * elapsed) / priorTime
      reference = (
        <b>
          {formatCardioDistance(Math.abs(gap), du)} {du} {gap >= 0 ? 'AHEAD OF' : 'BEHIND'} LAST TIME&rsquo;S PACE
        </b>
      )
    } else if (prior) {
      reference =
        'LAST TIME ' +
        formatCardioDistance(priorDistance, du) + ' ' + du +
        ' · ' + formatCardioTime(priorTime) +
        (priorDistance && priorTime ? ' · ' + formatCardioPace(priorTime / priorDistance, du) : '')
    } else {
      reference = 'FIRST TIME LOGGING THIS'
    }

    const speedValue = set.speed === '' || set.speed == null ? '' : round(distanceFromKilometers(set.speed, du), 1)
    const changeRunField = (field, value) =>
      running
        ? editSet(set.id, (current) => setRunValue(current, field, value, Date.now(), runOptions))
        : updateSet(item.id, set.id, field, value)

    work = (
      <>
        <div className="focus-reference">{reference}</div>

        <div className="focus-steppers">
          {runOptions.autoDistance ? (
            <>
              <Stepper
                label={du.toUpperCase() + '/H'}
                ariaLabel={'Treadmill speed in ' + du + ' per hour'}
                value={speedValue}
                step={0.1}
                max={40}
                onChange={(value) => changeRunField('speed', value === '' ? '' : distanceToKilometers(value, du))}
              />
              <Stepper
                label="INCLINE %"
                value={set.incline ?? ''}
                step={0.5}
                max={30}
                onChange={(value) => changeRunField('incline', value)}
              />
            </>
          ) : (
            <Stepper
              label={du.toUpperCase()}
              ariaLabel={'Distance in ' + du}
              value={set.distanceKm === '' || set.distanceKm == null ? '' : round(distanceFromKilometers(set.distanceKm, du))}
              step={0.1}
              onChange={(value) =>
                updateSet(item.id, set.id, 'distanceKm', value === '' ? '' : distanceToKilometers(value, du))
              }
            />
          )}
        </div>

        <button
          className={'focus-details-toggle' + (detailsOpen ? ' is-open' : '')}
          onClick={() => setDetailsOpen((open) => !open)}
          aria-expanded={detailsOpen}
        >
          Heart rate, calories, effort{runOptions.autoDistance && !running ? ', distance' : ''}
          <ChevronDown size={15} />
        </button>
        {detailsOpen && (
          <div className="focus-details">
            {runOptions.autoDistance && !running && (
              <DetailField
                label="DISTANCE"
                suffix={du}
                step="0.01"
                value={set.distanceKm === '' || set.distanceKm == null ? '' : round(distanceFromKilometers(set.distanceKm, du), 3)}
                onChange={(value) =>
                  updateSet(item.id, set.id, 'distanceKm', value === '' ? '' : distanceToKilometers(value, du))
                }
              />
            )}
            <DetailField label="HEART RATE" suffix="bpm" max="240" value={set.heartRate} onChange={(value) => updateSet(item.id, set.id, 'heartRate', value)} />
            <DetailField label="CALORIES" suffix="kcal" value={set.calories} onChange={(value) => updateSet(item.id, set.id, 'calories', value)} />
            <DetailField label="EFFORT" suffix="RPE" step="0.5" max="10" value={set.rpe} onChange={(value) => updateSet(item.id, set.id, 'rpe', value)} />
          </div>
        )}

        {undoButton || (running ? (
          <div className="focus-cta-row">
            <button className="focus-cta is-quiet" onClick={pauseTimer}>
              <Pause size={19} fill="currentColor" /> Pause
            </button>
            <button className="focus-cta" onClick={finishRun}>
              <Flag size={19} /> Finish {item.sets.length > 1 ? 'split' : 'run'}
            </button>
          </div>
        ) : paused ? (
          <div className="focus-cta-row">
            <button className="focus-cta is-quiet" onClick={finishRun}>
              <Flag size={19} /> Finish
            </button>
            <button className="focus-cta" onClick={startTimer}>
              <Play size={19} fill="currentColor" /> Resume
            </button>
          </div>
        ) : (
          <>
            <button className="focus-cta" onClick={startTimer}>
              <Play size={20} fill="currentColor" /> Start {exercise?.pattern === 'Incline Walking' ? 'walk' : 'run'}
            </button>
            <button className="focus-link" onClick={() => setManualFor(item.id)}>
              Already done it? Log without the timer
            </button>
          </>
        ))}
      </>
    )
  }

  if (!set && !(mode === 'cardio' && manualFor === item.id)) {
    work = (
      <div className="focus-done">
        <p>
          {workoutDone
            ? 'Every set is logged.'
            : 'All ' + item.sets.length + ' ' + (mode === 'cardio' ? 'splits' : 'sets') + ' of ' +
              (exercise?.name || 'this exercise') + ' logged.'}
        </p>
        {workoutDone ? (
          <button className="focus-cta" onClick={openFinish}>
            <Flag size={20} /> Finish workout
          </button>
        ) : (
          nextUp && (
            <button className="focus-cta" onClick={() => setPinned(null)}>
              Next: {exerciseMap.get(nextUp.exerciseId)?.name || 'exercise'} <ChevronRight size={20} />
            </button>
          )
        )}
        <div className="focus-done-actions">
          <button onClick={() => addSet(item.id)}>
            <Plus size={15} /> Add {mode === 'cardio' ? 'split' : 'set'}
          </button>
          <button onClick={openExercisePicker}><ListPlus size={15} /> Add exercise</button>
        </div>
      </div>
    )
  }

  return (
    <div className="live-workout focus-workout">
      {sessionBar}

      <div className="focus-body content-width content-width--narrow">
        <AnimatePresence mode="popLayout" initial={false} custom={direction}>
          <motion.section
            key={item.id}
            className="focus-card"
            custom={direction}
            variants={{
              enter: (dir) => ({ opacity: 0, x: dir * 48 }),
              center: { opacity: 1, x: 0 },
              exit: (dir) => ({ opacity: 0, x: dir * -48 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <motion.div
              className="focus-stage"
              drag="x"
              dragDirectionLock
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.18}
              dragSnapToOrigin
              onDragEnd={(_, info) => {
                if (info.offset.x < -64 || info.velocity.x < -480) goTo(itemIndex + 1)
                else if (info.offset.x > 64 || info.velocity.x > 480) goTo(itemIndex - 1)
              }}
            >
              <div className="focus-kicker">
                <span>Exercise {itemIndex + 1} of {exercises.length}</span>
                {item.supersetId && <span className="superset-mark"><Link2 size={12} /> SUPERSET</span>}
              </div>
              <button className="focus-title" onClick={() => openExercise(item.exerciseId)}>
                <strong>{exercise?.name || 'Exercise'}</strong>
                <small>
                  {exercise?.primaryMuscle} · {exercise?.equipment}
                  {target ? ' · target ' + target : ''}
                </small>
              </button>

              <FocusRings rings={rings} rest={resting}>{center}</FocusRings>
            </motion.div>

            {resting ? (
              <div className="focus-rest-controls">
                <button onClick={() => adjustRest(-15)}>−15s</button>
                <button onClick={() => adjustRest(15)}>+15s</button>
              </div>
            ) : (
              <FocusLegend items={legend} />
            )}

            <div className="focus-sets" role="group" aria-label={mode === 'cardio' ? 'Splits' : 'Sets'}>
              {item.sets.map((entry, index) => (
                <button
                  key={entry.id}
                  className={
                    'focus-set-dot' +
                    (entry.completed ? ' is-done' : '') +
                    (entry === set ? ' is-current' : '') +
                    (isRunning(entry) ? ' is-live' : '') +
                    (entry.type === 'warmup' ? ' is-warmup' : '')
                  }
                  onClick={() => setPinned({ itemId: item.id, setId: entry.id })}
                  aria-label={(mode === 'cardio' ? 'Split ' : 'Set ') + (index + 1) + (entry.completed ? ', done' : '')}
                  aria-current={entry === set ? 'step' : undefined}
                >
                  {setBadge(entry, index)}
                </button>
              ))}
              <button
                className="focus-set-dot is-add"
                onClick={() => addSet(item.id)}
                aria-label={mode === 'cardio' ? 'Add split' : 'Add set'}
              >
                <Plus size={14} strokeWidth={2.6} />
              </button>
            </div>

            {work}
          </motion.section>
        </AnimatePresence>

        <nav className="focus-nav" aria-label="Exercises">
          <button onClick={() => goTo(itemIndex - 1)} disabled={!prevItem}>
            <ChevronLeft size={18} />
            <span>{prevItem ? exerciseMap.get(prevItem.exerciseId)?.name : ''}</span>
          </button>
          <div className="focus-nav-tools">
            {mode === 'cardio' && running && (
              <button className="is-set" onClick={lap} aria-label="Lap: log this split and start the next">
                Lap
              </button>
            )}
            {set && mode !== 'cardio' && (
              <button
                className={set.rpe === '' || set.rpe == null ? '' : 'is-set'}
                onClick={() => openSetOptions(item.id, set.id)}
                aria-label={'Set ' + (setIndex + 1) + ' options'}
              >
                {set.rpe === '' || set.rpe == null ? 'RPE' : 'RPE ' + set.rpe}
              </button>
            )}
            <button onClick={() => openExerciseMenu(item.id)} aria-label={'Options for ' + (exercise?.name || 'exercise')}>
              <Ellipsis size={20} />
            </button>
          </div>
          <button onClick={() => goTo(itemIndex + 1)} disabled={!nextItem}>
            <span>{nextItem ? exerciseMap.get(nextItem.exerciseId)?.name : ''}</span>
            <ChevronRight size={18} />
          </button>
        </nav>
      </div>
    </div>
  )
}
