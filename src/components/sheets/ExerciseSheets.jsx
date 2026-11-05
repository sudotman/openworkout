import {
  Anchor,
  ArrowDown,
  ArrowUp,
  Check,
  ChevronRight,
  Info,
  Link2,
  Plus,
  Search,
  Settings,
  TimerReset,
  Trash2,
  Zap,
} from 'lucide-react'
import { useState } from 'react'
import { equipmentOptions, muscleGroups } from '../../data/exercises.js'
import { ExerciseMuscleMap, ExercisePerformance } from '../../features.js'
import { barPresets, formatLoad, normalizeBaseWeight, suggestedBaseWeight } from '../../lib/base-weight.js'
import { SheetHeading } from './Sheet.jsx'

export function ExercisePicker({ allExercises, currentIds, addExercise, openDetails }) {
  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState('All')
  const results = allExercises.filter((exercise) => {
    const search = query.toLowerCase()
    return (
      (!query ||
        exercise.name.toLowerCase().includes(search) ||
        exercise.primaryMuscle.toLowerCase().includes(search)) &&
      (muscle === 'All' || exercise.primaryMuscle === muscle)
    )
  })

  return (
    <div className="sheet-content picker-content">
      <SheetHeading
        title="Add an exercise"
        body={'Search all ' + allExercises.length + ' exercises.'}
      />
      <label className="search-box search-box--sheet">
        <Search size={19} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search exercises" autoFocus />
      </label>
      <div className="filter-scroller picker-filters">
        {['All', ...muscleGroups].map((group) => (
          <button
            className={'filter-chip ' + (muscle === group ? 'is-active' : '')}
            key={group}
            onClick={() => setMuscle(group)}
          >
            {group}
          </button>
        ))}
      </div>
      <div className="picker-list">
        {results.map((exercise) => {
          const added = currentIds.includes(exercise.id)
          return (
            <div className="picker-row" key={exercise.id}>
              <button className="picker-details" onClick={() => openDetails(exercise.id)}>
                <span className="directory-monogram">{exercise.name.split(' ').slice(0, 2).map((word) => word[0]).join('')}</span>
                <span>
                  <strong>{exercise.name}</strong>
                  <small>{exercise.primaryMuscle} · {exercise.equipment}</small>
                </span>
              </button>
              <button
                className={'picker-add ' + (added ? 'is-added' : '')}
                onClick={() => !added && addExercise(exercise.id)}
                disabled={added}
                aria-label={added ? exercise.name + ' already added' : 'Add ' + exercise.name}
              >
                {added ? <Check size={17} /> : <Plus size={18} />}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function ExerciseDetail({
  exercise,
  workouts,
  unit,
  distanceUnit,
  canAdd,
  addExercise,
  goBack,
  editCustom,
  deleteCustom,
}) {
  if (!exercise) return null
  return (
    <div className="sheet-content exercise-detail">
      <SheetHeading
        eyebrow={exercise.primaryMuscle + ' · ' + exercise.equipment}
        title={exercise.name}
        body={exercise.pattern + ' · ' + exercise.difficulty}
        back={goBack}
      />

      <ExerciseMuscleMap exercise={exercise} />

      <div className="instruction-layout">
        <section>
          <div className="instruction-title">
            <span>HOW TO</span>
            <small>{exercise.instructions.length} STEPS</small>
          </div>
          <ol className="instruction-steps">
            {exercise.instructions.map((instruction, index) => (
              <li key={instruction}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <p>{instruction}</p>
              </li>
            ))}
          </ol>
        </section>

        <aside className="cue-panel">
          <div className="instruction-title">
            <span>COACHING CUES</span>
          </div>
          <ul>
            {exercise.cues.map((cue) => (
              <li key={cue}><Zap size={14} fill="currentColor" /> {cue}</li>
            ))}
          </ul>
          <div className="safety-note">
            <Info size={17} />
            <p>Use a load you can control. Stop if you feel sharp pain, dizziness, or unusual discomfort.</p>
          </div>
        </aside>
      </div>

      <ExercisePerformance exercise={exercise} workouts={workouts} unit={unit} distanceUnit={distanceUnit} />

      {exercise.custom && (
        <div className="custom-detail-actions">
          <button onClick={editCustom}><Settings size={16} /> Edit custom exercise</button>
          <button onClick={deleteCustom}><Trash2 size={16} /> Delete</button>
        </div>
      )}

      {canAdd && (
        <div className="sheet-sticky-action">
          <button className="button button--accent button--wide" onClick={() => addExercise(exercise.id)}>
            <Plus size={18} /> Add to workout
          </button>
        </div>
      )}
    </div>
  )
}

export function ExerciseActionsSheet({
  workout,
  workoutExerciseId,
  unit,
  moveExercise,
  toggleSuperset,
  setExerciseRest,
  openBaseWeight,
  removeExercise,
  close,
}) {
  const index = workout?.exercises.findIndex((exercise) => exercise.id === workoutExerciseId) ?? -1
  const item = workout?.exercises[index]
  return (
    <div className="sheet-content compact-menu-sheet">
      <SheetHeading
        title="Adjust exercise"
        body="Reorder the session, create a superset, or remove this exercise."
      />
      <div className="exercise-action-list">
        <button onClick={() => moveExercise(workoutExerciseId, -1)} disabled={index <= 0}>
          <span><ArrowUp size={17} /></span><div><strong>Move up</strong><small>Earlier in this workout</small></div><ChevronRight size={18} />
        </button>
        <button onClick={() => moveExercise(workoutExerciseId, 1)} disabled={index < 0 || index >= workout.exercises.length - 1}>
          <span><ArrowDown size={17} /></span><div><strong>Move down</strong><small>Later in this workout</small></div><ChevronRight size={18} />
        </button>
        <button onClick={() => toggleSuperset(workoutExerciseId)} disabled={workout?.exercises.length < 2}>
          <span><Link2 size={17} /></span>
          <div>
            <strong>{item?.supersetId ? 'Remove superset' : 'Pair as superset'}</strong>
            <small>{item?.supersetId ? 'Unlink the grouped exercises' : 'Link with the adjacent exercise'}</small>
          </div>
          <ChevronRight size={18} />
        </button>
        <button onClick={() => openBaseWeight(workoutExerciseId)}>
          <span><Anchor size={17} /></span>
          <div>
            <strong>Base weight</strong>
            <small>
              {normalizeBaseWeight(item?.baseWeight)
                ? 'Starts at ' + formatLoad(item.baseWeight) + ' ' + unit + ' — you log what you add'
                : 'Log only what you add to the bar'}
            </small>
          </div>
          <ChevronRight size={18} />
        </button>
        <div className="exercise-rest-option">
          <div>
            <span><TimerReset size={17} /></span>
            <div><strong>Rest after sets</strong><small>Override the default for this exercise</small></div>
          </div>
          <div>
            {[60, 90, 120, 180].map((seconds) => (
              <button
                key={seconds}
                className={item?.restSeconds === seconds ? 'is-active' : ''}
                onClick={() => setExerciseRest(workoutExerciseId, seconds)}
              >
                {seconds < 120 ? seconds + 's' : seconds / 60 + 'm'}
              </button>
            ))}
          </div>
        </div>
        <button className="is-danger" onClick={() => removeExercise(workoutExerciseId)}>
          <span><Trash2 size={17} /></span><div><strong>Remove exercise</strong><small>Delete its sets from this session</small></div><ChevronRight size={18} />
        </button>
      </div>
      <button className="button button--ghost button--wide" onClick={close}>Cancel</button>
    </div>
  )
}

// The session bar replaces the app bar on phones, so anything the app bar
// offered has to be reachable from here too.
export function SessionMenuSheet({ openPicker, openSettings, openDiscard, close }) {
  return (
    <div className="sheet-content compact-menu-sheet">
      <SheetHeading title="Workout options" />
      <div className="exercise-action-list">
        <button onClick={openPicker}>
          <span><Plus size={17} /></span><div><strong>Add exercise</strong><small>From the library or your own</small></div><ChevronRight size={18} />
        </button>
        <button onClick={openSettings}>
          <span><Settings size={17} /></span><div><strong>Settings</strong><small>Units, rest timer, theme, backups</small></div><ChevronRight size={18} />
        </button>
        <button className="is-danger" onClick={openDiscard}>
          <span><Trash2 size={17} /></span><div><strong>Discard workout</strong><small>Remove this session and its sets</small></div><ChevronRight size={18} />
        </button>
      </div>
      <button className="button button--ghost button--wide" onClick={close}>Cancel</button>
    </div>
  )
}

export function BaseWeightSheet({ exercise, item, unit, onSave, onClose }) {
  const current = normalizeBaseWeight(item?.baseWeight)
  const suggestion = suggestedBaseWeight(exercise, unit)
  const [value, setValue] = useState(() => (current ? String(current) : suggestion ? String(suggestion) : ''))
  const presets = barPresets(unit)
  const parsed = normalizeBaseWeight(value)

  return (
    <div className="sheet-content base-weight-sheet">
      <SheetHeading
        title="Base weight"
        body={
          'What ' + (exercise?.name || 'this exercise') + ' weighs before you add anything — the bar, or a loaded carriage. ' +
          'You then log only what you put on, and the total is kept for you.'
        }
      />

      <div className="base-weight-presets" role="group" aria-label="Common base weights">
        {presets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className={parsed === preset.weight ? 'is-active' : ''}
            onClick={() => setValue(String(preset.weight))}
          >
            <strong>{formatLoad(preset.weight)}<small>{unit}</small></strong>
            <span>{preset.label}</span>
          </button>
        ))}
      </div>

      <label className="base-weight-custom">
        <span>OR ENTER IT EXACTLY</span>
        <div>
          <input
            inputMode="decimal"
            type="number"
            min="0"
            step="0.5"
            value={value}
            placeholder="0"
            autoFocus
            onFocus={(event) => event.target.select()}
            onChange={(event) => setValue(event.target.value)}
            aria-label={'Base weight in ' + unit}
          />
          <b>{unit}</b>
        </div>
      </label>

      <p className="base-weight-preview">
        {parsed > 0 ? (
          <>
            Type <b>60</b>, log <b>{formatLoad(60 + parsed)} {unit}</b>.
          </>
        ) : (
          <>No base weight — you log the total yourself.</>
        )}
      </p>

      <div className="base-weight-actions">
        <button className="button button--accent button--wide" onClick={() => onSave(parsed)}>
          <Check size={18} /> {parsed > 0 ? 'Use ' + formatLoad(parsed) + ' ' + unit : 'Save'}
        </button>
        {current > 0 && (
          <button className="button button--ghost button--wide" onClick={() => onSave(0)}>
            Remove base weight
          </button>
        )}
        <button className="button button--ghost button--wide" onClick={onClose}>Cancel</button>
      </div>

      <p className="base-weight-note">
        Remembered for {exercise?.name || 'this exercise'} in future workouts. Weights you have
        already logged keep their total.
      </p>
    </div>
  )
}

export function CustomExerciseSheet({ initial, onSave }) {
  const [form, setForm] = useState(() => ({
    name: initial?.name || '',
    primaryMuscle: initial?.primaryMuscle || 'Chest',
    equipment: initial?.equipment || 'Dumbbell',
    difficulty: initial?.difficulty || 'Beginner',
    trackingType: initial?.trackingType || 'weight-reps',
    pattern: initial?.pattern || '',
    instructions: initial?.instructions?.join('\n') || '',
    cues: initial?.cues?.join('\n') || '',
  }))
  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }))
  const save = () => {
    if (!form.name.trim()) return
    onSave({
      ...form,
      instructions: form.instructions.split('\n').map((value) => value.trim()).filter(Boolean),
      cues: form.cues.split('\n').map((value) => value.trim()).filter(Boolean),
    })
  }
  return (
    <div className="sheet-content custom-exercise-sheet">
      <SheetHeading
        title={initial ? 'Edit exercise' : 'Create exercise'}
        body="Add an exercise that is not in the built-in library."
      />
      <div className="custom-form-grid">
        <label className="custom-form-wide">
          <span>EXERCISE NAME</span>
          <input value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="e.g. Cable Bayesian Curl" autoFocus />
        </label>
        <label>
          <span>PRIMARY MUSCLE</span>
          <select value={form.primaryMuscle} onChange={(event) => update('primaryMuscle', event.target.value)}>
            {muscleGroups.map((group) => <option key={group}>{group}</option>)}
          </select>
        </label>
        <label>
          <span>EQUIPMENT</span>
          <select value={form.equipment} onChange={(event) => update('equipment', event.target.value)}>
            {equipmentOptions.map((option) => <option key={option}>{option}</option>)}
          </select>
        </label>
        <label>
          <span>DIFFICULTY</span>
          <select value={form.difficulty} onChange={(event) => update('difficulty', event.target.value)}>
            {['Beginner', 'Intermediate', 'Advanced'].map((option) => <option key={option}>{option}</option>)}
          </select>
        </label>
        <label>
          <span>TRACKING STYLE</span>
          <select value={form.trackingType} onChange={(event) => update('trackingType', event.target.value)}>
            <option value="weight-reps">Weight + reps</option>
            <option value="duration">Duration</option>
            <option value="distance">Weight + distance</option>
            <option value="cardio">Run / cardio metrics</option>
          </select>
        </label>
        <label className="custom-form-wide">
          <span>MOVEMENT PATTERN</span>
          <input value={form.pattern} onChange={(event) => update('pattern', event.target.value)} placeholder="e.g. Elbow flexion" />
        </label>
        <label className="custom-form-wide">
          <span>INSTRUCTIONS · ONE STEP PER LINE</span>
          <textarea rows={4} value={form.instructions} onChange={(event) => update('instructions', event.target.value)} placeholder={'Set up the cable just above floor height.\nKeep the upper arm behind your torso.\nCurl without moving the shoulder.'} />
        </label>
        <label className="custom-form-wide">
          <span>COACHING CUES · ONE PER LINE</span>
          <textarea rows={3} value={form.cues} onChange={(event) => update('cues', event.target.value)} placeholder={'Keep the elbow still.\nControl the return.'} />
        </label>
      </div>
      <button className="button button--accent button--wide" onClick={save} disabled={!form.name.trim()}>
        {initial ? <Check size={18} /> : <Plus size={18} />} {initial ? 'Save changes' : 'Save custom exercise'}
      </button>
    </div>
  )
}
