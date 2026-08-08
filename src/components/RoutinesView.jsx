import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  Copy,
  Dumbbell,
  Edit3,
  Folder,
  GripVertical,
  Layers3,
  Play,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import '../routines.css'

const PROGRAM_LIBRARY = [
  {
    id: 'full-body-foundation',
    name: 'Full body foundation',
    folder: 'OpenWorkout programs',
    description: 'A balanced three-day session for building strength, skill, and consistency.',
    frequency: '3× / week',
    duration: '45–55 min',
    exerciseIds: [
      'goblet-squat',
      'dumbbell-bench-press',
      'lat-pulldown',
      'barbell-romanian-deadlift',
      'forearm-plank',
    ],
    prescriptions: {
      'goblet-squat': { sets: 3, minReps: 8, maxReps: 12, restSeconds: 90 },
      'dumbbell-bench-press': { sets: 3, minReps: 8, maxReps: 12, restSeconds: 90 },
      'lat-pulldown': { sets: 3, minReps: 8, maxReps: 12, restSeconds: 90 },
      'barbell-romanian-deadlift': { sets: 3, minReps: 6, maxReps: 10, restSeconds: 120 },
    },
  },
  {
    id: 'upper-builder',
    name: 'Upper builder',
    folder: 'OpenWorkout programs',
    description: 'A complete upper-body day with a practical mix of compounds and accessories.',
    frequency: '2× / week',
    duration: '55–65 min',
    exerciseIds: [
      'incline-dumbbell-press',
      'pull-up',
      'seated-dumbbell-shoulder-press',
      'seated-cable-row',
      'dumbbell-lateral-raise',
      'rope-triceps-pushdown',
    ],
    prescriptions: {
      'incline-dumbbell-press': { sets: 3, minReps: 6, maxReps: 10, restSeconds: 120 },
      'pull-up': { sets: 3, minReps: 5, maxReps: 10, restSeconds: 120 },
      'seated-dumbbell-shoulder-press': { sets: 3, minReps: 8, maxReps: 12, restSeconds: 90 },
      'seated-cable-row': { sets: 3, minReps: 8, maxReps: 12, restSeconds: 90 },
      'dumbbell-lateral-raise': { sets: 3, minReps: 12, maxReps: 20, restSeconds: 60 },
      'rope-triceps-pushdown': { sets: 3, minReps: 10, maxReps: 15, restSeconds: 60 },
    },
  },
  {
    id: 'lower-strength',
    name: 'Lower strength',
    folder: 'OpenWorkout programs',
    description: 'A focused lower-body session built around squatting, hinging, and durable legs.',
    frequency: '1–2× / week',
    duration: '55–65 min',
    exerciseIds: [
      'barbell-back-squat',
      'barbell-romanian-deadlift',
      'leg-press',
      'lying-leg-curl',
      'standing-calf-raise',
    ],
    prescriptions: {
      'barbell-back-squat': { sets: 4, minReps: 4, maxReps: 6, restSeconds: 180 },
      'barbell-romanian-deadlift': { sets: 3, minReps: 6, maxReps: 8, restSeconds: 150 },
      'leg-press': { sets: 3, minReps: 8, maxReps: 12, restSeconds: 120 },
      'lying-leg-curl': { sets: 3, minReps: 10, maxReps: 15, restSeconds: 75 },
      'standing-calf-raise': { sets: 4, minReps: 10, maxReps: 15, restSeconds: 60 },
    },
  },
]

const DEFAULT_PRESCRIPTION = { sets: 3, minReps: 8, maxReps: 12, restSeconds: 90 }

const MODAL_MOTION = {
  initial: { opacity: 0, y: 26, scale: 0.985 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 18, scale: 0.99 },
  transition: { duration: 0.24, ease: [0.22, 1, 0.36, 1] },
}

function makeEditor(routine) {
  if (!routine) {
    return {
      mode: 'create',
      id: null,
      name: '',
      folder: '',
      description: '',
      exerciseIds: [],
      prescriptions: {},
    }
  }

  return {
    mode: 'edit',
    id: routine.id,
    name: routine.name || '',
    folder: routine.folder === 'Unfiled' ? '' : routine.folder || '',
    description: routine.description || '',
    exerciseIds: Array.from(new Set(routine.exerciseIds || [])),
    prescriptions: { ...(routine.prescriptions || {}) },
  }
}

function clampNumber(value, minimum, maximum) {
  if (value === '' || value === null || value === undefined) return undefined
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return undefined
  return Math.min(maximum, Math.max(minimum, Math.round(parsed)))
}

function cleanPrescription(source) {
  if (!source || typeof source !== 'object') return null
  const sets = clampNumber(source.sets, 1, 20)
  let minReps = clampNumber(source.minReps, 1, 100)
  let maxReps = clampNumber(source.maxReps, 1, 100)
  const restSeconds = clampNumber(source.restSeconds, 0, 600)

  if (minReps !== undefined && maxReps !== undefined && maxReps < minReps) {
    const lowerValue = maxReps
    maxReps = minReps
    minReps = lowerValue
  }

  const prescription = {}
  if (sets !== undefined) prescription.sets = sets
  if (minReps !== undefined) prescription.minReps = minReps
  if (maxReps !== undefined) prescription.maxReps = maxReps
  if (restSeconds !== undefined) prescription.restSeconds = restSeconds
  return Object.keys(prescription).length ? prescription : null
}

function prescriptionSummary(prescription) {
  if (!prescription) return 'Set targets'
  const pieces = []
  if (prescription.sets) pieces.push(prescription.sets + ' sets')
  if (prescription.minReps && prescription.maxReps) {
    pieces.push(prescription.minReps + '–' + prescription.maxReps + ' reps')
  } else if (prescription.minReps || prescription.maxReps) {
    pieces.push((prescription.minReps || prescription.maxReps) + ' reps')
  }
  if (prescription.restSeconds !== undefined && prescription.restSeconds !== '') {
    pieces.push(prescription.restSeconds + 's rest')
  }
  return pieces.join(' · ') || 'Set targets'
}

function plural(value, singular, pluralForm = singular + 's') {
  return value + ' ' + (value === 1 ? singular : pluralForm)
}

function sameExerciseList(left = [], right = []) {
  return left.length === right.length && left.every((id, index) => id === right[index])
}

function RoutinesView({
  routines = [],
  allExercises = [],
  onStart = () => {},
  onCreate = () => {},
  onUpdate = () => {},
  onDuplicate = () => {},
  onDelete = () => {},
}) {
  const [editor, setEditor] = useState(null)
  const [exerciseQuery, setExerciseQuery] = useState('')
  const [expandedPrescriptionId, setExpandedPrescriptionId] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [savedPrograms, setSavedPrograms] = useState(() => new Set())
  const nameInputRef = useRef(null)
  const titleId = useId()
  const deleteTitleId = useId()

  const exerciseMap = useMemo(
    () => new Map(allExercises.map((exercise) => [exercise.id, exercise])),
    [allExercises],
  )

  const groups = useMemo(() => {
    const grouped = new Map()

    routines.forEach((routine) => {
      const folder = routine.folder?.trim() || 'Unfiled'
      if (!grouped.has(folder)) grouped.set(folder, [])
      grouped.get(folder).push(routine)
    })

    return Array.from(grouped, ([folder, items]) => ({ folder, items })).sort((a, b) => {
      if (a.folder === 'Unfiled') return 1
      if (b.folder === 'Unfiled') return -1
      return a.folder.localeCompare(b.folder)
    })
  }, [routines])

  const programmedExerciseCount = useMemo(
    () => routines.reduce((total, routine) => total + (routine.exerciseIds?.length || 0), 0),
    [routines],
  )

  const selectedIds = useMemo(() => new Set(editor?.exerciseIds || []), [editor?.exerciseIds])
  const matchingExercises = useMemo(() => {
    const query = exerciseQuery.trim().toLowerCase()
    return allExercises.filter((exercise) => {
      if (selectedIds.has(exercise.id)) return false
      if (!query) return true
      return [
        exercise.name,
        exercise.primaryMuscle,
        exercise.equipment,
        exercise.pattern,
      ].some((value) => value?.toLowerCase().includes(query))
    })
  }, [allExercises, exerciseQuery, selectedIds])

  const modalOpen = Boolean(editor || deleteTarget)

  useEffect(() => {
    if (!modalOpen) return undefined
    document.body.classList.add('routine-modal-open')
    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') return
      if (deleteTarget) setDeleteTarget(null)
      else setEditor(null)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.classList.remove('routine-modal-open')
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [deleteTarget, modalOpen])

  useEffect(() => {
    if (!editor) return undefined
    const frame = window.requestAnimationFrame(() => nameInputRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [editor?.id, editor?.mode])

  const openCreate = () => {
    setExerciseQuery('')
    setExpandedPrescriptionId(null)
    setEditor(makeEditor())
  }

  const openEdit = (routine) => {
    setExerciseQuery('')
    setExpandedPrescriptionId(null)
    setEditor(makeEditor(routine))
  }

  const addExercise = (exerciseId) => {
    setEditor((current) => {
      if (!current || current.exerciseIds.includes(exerciseId)) return current
      return { ...current, exerciseIds: [...current.exerciseIds, exerciseId] }
    })
    setExerciseQuery('')
  }

  const removeExercise = (exerciseId) => {
    setEditor((current) => {
      if (!current) return current
      const prescriptions = { ...current.prescriptions }
      delete prescriptions[exerciseId]
      return {
        ...current,
        exerciseIds: current.exerciseIds.filter((id) => id !== exerciseId),
        prescriptions,
      }
    })
    if (expandedPrescriptionId === exerciseId) setExpandedPrescriptionId(null)
  }

  const togglePrescription = (exerciseId) => {
    if (expandedPrescriptionId === exerciseId) {
      setExpandedPrescriptionId(null)
      return
    }
    setEditor((current) => {
      if (!current || current.prescriptions?.[exerciseId]) return current
      return {
        ...current,
        prescriptions: {
          ...current.prescriptions,
          [exerciseId]: { ...DEFAULT_PRESCRIPTION },
        },
      }
    })
    setExpandedPrescriptionId(exerciseId)
  }

  const updatePrescription = (exerciseId, field, value) => {
    setEditor((current) => {
      if (!current) return current
      return {
        ...current,
        prescriptions: {
          ...current.prescriptions,
          [exerciseId]: {
            ...DEFAULT_PRESCRIPTION,
            ...(current.prescriptions?.[exerciseId] || {}),
            [field]: value,
          },
        },
      }
    })
  }

  const clearPrescription = (exerciseId) => {
    setEditor((current) => {
      if (!current) return current
      const prescriptions = { ...current.prescriptions }
      delete prescriptions[exerciseId]
      return { ...current, prescriptions }
    })
    setExpandedPrescriptionId(null)
  }

  const moveExercise = (index, direction) => {
    setEditor((current) => {
      if (!current) return current
      const targetIndex = index + direction
      if (targetIndex < 0 || targetIndex >= current.exerciseIds.length) return current
      const exerciseIds = [...current.exerciseIds]
      const [moved] = exerciseIds.splice(index, 1)
      exerciseIds.splice(targetIndex, 0, moved)
      return { ...current, exerciseIds }
    })
  }

  const submitEditor = (event) => {
    event.preventDefault()
    if (!editor?.name.trim() || !editor.exerciseIds.length) return

    const data = {
      name: editor.name.trim(),
      folder: editor.folder.trim() || 'Unfiled',
      description: editor.description.trim(),
      exerciseIds: [...editor.exerciseIds],
      prescriptions: Object.fromEntries(
        editor.exerciseIds.flatMap((exerciseId) => {
          const prescription = cleanPrescription(editor.prescriptions?.[exerciseId])
          return prescription ? [[exerciseId, prescription]] : []
        }),
      ),
    }

    if (editor.mode === 'edit') onUpdate(editor.id, data)
    else onCreate(data)
    setEditor(null)
  }

  const saveProgram = (program) => {
    onCreate({
      name: program.name,
      folder: program.folder,
      description: program.description,
      exerciseIds: [...program.exerciseIds],
      prescriptions: Object.fromEntries(
        Object.entries(program.prescriptions || {}).map(([exerciseId, prescription]) => [
          exerciseId,
          { ...prescription },
        ]),
      ),
    })
    setSavedPrograms((current) => new Set(current).add(program.id))
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    onDelete(deleteTarget.id)
    setDeleteTarget(null)
  }

  const modalLayer = (
    <AnimatePresence>
      {editor && (
        <motion.div
          className="routine-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setEditor(null)
          }}
        >
          <motion.section
            className="routine-editor"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            {...MODAL_MOTION}
          >
            <div className="routine-editor-handle" aria-hidden="true" />
            <header className="routine-editor-header">
              <div>
                <span>{editor.mode === 'edit' ? 'EDIT ROUTINE' : 'NEW ROUTINE'}</span>
                <h2 id={titleId}>{editor.mode === 'edit' ? 'Tune your plan.' : 'Build your next session.'}</h2>
              </div>
              <button
                type="button"
                className="routine-icon-button routine-editor-close"
                onClick={() => setEditor(null)}
                aria-label="Close routine editor"
              >
                <X size={20} />
              </button>
            </header>

            <form className="routine-editor-form" onSubmit={submitEditor}>
              <div className="routine-editor-fields">
                <label className="routine-field">
                  <span>Name</span>
                  <input
                    ref={nameInputRef}
                    value={editor.name}
                    onChange={(event) => setEditor((current) => ({ ...current, name: event.target.value }))}
                    placeholder="e.g. Monday upper"
                    maxLength={60}
                    autoComplete="off"
                    required
                  />
                </label>

                <label className="routine-field">
                  <span>Folder</span>
                  <div className="routine-field-with-icon">
                    <Folder size={16} aria-hidden="true" />
                    <input
                      value={editor.folder}
                      onChange={(event) => setEditor((current) => ({ ...current, folder: event.target.value }))}
                      placeholder="e.g. Strength block"
                      maxLength={40}
                      autoComplete="off"
                    />
                  </div>
                  <small>Leave blank to keep it unfiled.</small>
                </label>

                <label className="routine-field">
                  <span>Description <i>optional</i></span>
                  <textarea
                    value={editor.description}
                    onChange={(event) => setEditor((current) => ({ ...current, description: event.target.value }))}
                    placeholder="What is this session for?"
                    rows={4}
                    maxLength={180}
                  />
                  <small className="routine-character-count">{editor.description.length}/180</small>
                </label>
              </div>

              <div className="routine-exercise-builder">
                <div className="routine-builder-heading">
                  <div>
                    <span>EXERCISE ORDER</span>
                    <h3>{plural(editor.exerciseIds.length, 'exercise')}</h3>
                  </div>
                  <small>Use the arrows to set workout order.</small>
                </div>

                <div className="routine-selected-list" aria-live="polite">
                  <AnimatePresence initial={false}>
                    {editor.exerciseIds.map((exerciseId, index) => {
                      const exercise = exerciseMap.get(exerciseId)
                      const prescription = editor.prescriptions?.[exerciseId]
                      const prescriptionOpen = expandedPrescriptionId === exerciseId
                      return (
                        <motion.div
                          layout
                          key={exerciseId}
                          className="routine-selected-item"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.18 }}
                        >
                          <div className="routine-selected-row">
                            <GripVertical size={16} aria-hidden="true" />
                            <span className="routine-order-number">{String(index + 1).padStart(2, '0')}</span>
                            <span className="routine-selected-copy">
                              <strong>{exercise?.name || 'Unknown exercise'}</strong>
                              <small>{exercise ? exercise.primaryMuscle + ' · ' + exercise.equipment : exerciseId}</small>
                            </span>
                            <span className="routine-order-actions">
                              <button
                                type="button"
                                onClick={() => moveExercise(index, -1)}
                                disabled={index === 0}
                                aria-label={'Move ' + (exercise?.name || 'exercise') + ' up'}
                              >
                                <ArrowUp size={15} />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveExercise(index, 1)}
                                disabled={index === editor.exerciseIds.length - 1}
                                aria-label={'Move ' + (exercise?.name || 'exercise') + ' down'}
                              >
                                <ArrowDown size={15} />
                              </button>
                              <button
                                type="button"
                                className="routine-remove-exercise"
                                onClick={() => removeExercise(exerciseId)}
                                aria-label={'Remove ' + (exercise?.name || 'exercise')}
                              >
                                <X size={16} />
                              </button>
                            </span>
                          </div>

                          <button
                            type="button"
                            className={'routine-prescription-toggle ' + (prescription ? 'routine-has-prescription' : '')}
                            onClick={() => togglePrescription(exerciseId)}
                            aria-expanded={prescriptionOpen}
                          >
                            <SlidersHorizontal size={14} />
                            <span>{prescriptionSummary(prescription)}</span>
                            <ChevronDown size={15} className={prescriptionOpen ? 'routine-chevron-open' : ''} />
                          </button>

                          <AnimatePresence initial={false}>
                            {prescriptionOpen && (
                              <motion.div
                                className="routine-prescription-panel"
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.18 }}
                              >
                                <div className="routine-prescription-grid">
                                  <label>
                                    <span>Sets</span>
                                    <input
                                      type="number"
                                      inputMode="numeric"
                                      min="1"
                                      max="20"
                                      value={prescription?.sets ?? ''}
                                      onChange={(event) => updatePrescription(exerciseId, 'sets', event.target.value)}
                                      aria-label={'Target sets for ' + (exercise?.name || 'exercise')}
                                    />
                                  </label>
                                  <label>
                                    <span>Min reps</span>
                                    <input
                                      type="number"
                                      inputMode="numeric"
                                      min="1"
                                      max="100"
                                      value={prescription?.minReps ?? ''}
                                      onChange={(event) => updatePrescription(exerciseId, 'minReps', event.target.value)}
                                      aria-label={'Minimum reps for ' + (exercise?.name || 'exercise')}
                                    />
                                  </label>
                                  <label>
                                    <span>Max reps</span>
                                    <input
                                      type="number"
                                      inputMode="numeric"
                                      min="1"
                                      max="100"
                                      value={prescription?.maxReps ?? ''}
                                      onChange={(event) => updatePrescription(exerciseId, 'maxReps', event.target.value)}
                                      aria-label={'Maximum reps for ' + (exercise?.name || 'exercise')}
                                    />
                                  </label>
                                  <label>
                                    <span>Rest <i>sec</i></span>
                                    <input
                                      type="number"
                                      inputMode="numeric"
                                      min="0"
                                      max="600"
                                      step="5"
                                      value={prescription?.restSeconds ?? ''}
                                      onChange={(event) => updatePrescription(exerciseId, 'restSeconds', event.target.value)}
                                      aria-label={'Rest seconds for ' + (exercise?.name || 'exercise')}
                                    />
                                  </label>
                                </div>
                                <button
                                  type="button"
                                  className="routine-clear-prescription"
                                  onClick={() => clearPrescription(exerciseId)}
                                >
                                  Clear targets
                                </button>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      )
                    })}
                  </AnimatePresence>

                  {!editor.exerciseIds.length && (
                    <div className="routine-selection-empty">
                      <Dumbbell size={21} strokeWidth={1.7} />
                      <span>
                        <strong>Add your first exercise</strong>
                        <small>Search the complete library below.</small>
                      </span>
                    </div>
                  )}
                </div>

                <div className="routine-exercise-search">
                  <Search size={18} aria-hidden="true" />
                  <input
                    value={exerciseQuery}
                    onChange={(event) => setExerciseQuery(event.target.value)}
                    placeholder="Search exercises, muscles, equipment…"
                    aria-label="Search exercises to add"
                  />
                  {exerciseQuery && (
                    <button type="button" onClick={() => setExerciseQuery('')} aria-label="Clear exercise search">
                      <X size={16} />
                    </button>
                  )}
                </div>

                <div className="routine-search-results" aria-label="Available exercises">
                  {matchingExercises.map((exercise) => (
                    <button
                      type="button"
                      key={exercise.id}
                      className="routine-search-result"
                      onClick={() => addExercise(exercise.id)}
                    >
                      <span>
                        <strong>{exercise.name}</strong>
                        <small>{exercise.primaryMuscle} · {exercise.equipment}</small>
                      </span>
                      <Plus size={18} />
                    </button>
                  ))}
                  {!matchingExercises.length && (
                    <p className="routine-no-results">
                      {allExercises.length ? 'No available exercises match that search.' : 'The exercise library is empty.'}
                    </p>
                  )}
                </div>
              </div>

              <footer className="routine-editor-footer">
                <p>
                  {!editor.exerciseIds.length
                    ? 'Add at least one exercise to save.'
                    : plural(editor.exerciseIds.length, 'exercise') + ' ready'}
                </p>
                <div>
                  <button type="button" className="routine-button routine-button-quiet" onClick={() => setEditor(null)}>
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="routine-button routine-button-dark"
                    disabled={!editor.name.trim() || !editor.exerciseIds.length}
                  >
                    <Check size={17} />
                    {editor.mode === 'edit' ? 'Save changes' : 'Create routine'}
                  </button>
                </div>
              </footer>
            </form>
          </motion.section>
        </motion.div>
      )}

      {deleteTarget && (
        <motion.div
          className="routine-modal-backdrop routine-modal-backdrop-confirm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setDeleteTarget(null)
          }}
        >
          <motion.section
            className="routine-confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={deleteTitleId}
            {...MODAL_MOTION}
          >
            <span className="routine-confirm-icon"><Trash2 size={22} /></span>
            <span className="routine-modal-kicker">DELETE ROUTINE</span>
            <h2 id={deleteTitleId}>Remove “{deleteTarget.name}”?</h2>
            <p>This removes the routine from this device. Your completed workout history stays untouched.</p>
            <div className="routine-confirm-actions">
              <button type="button" className="routine-button routine-button-quiet" onClick={() => setDeleteTarget(null)}>
                Keep routine
              </button>
              <button type="button" className="routine-button routine-button-danger" onClick={confirmDelete} autoFocus>
                Delete routine
              </button>
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  )

  return (
    <div className="routine-view content-width">
      <header className="routine-view-header">
        <div>
          <span className="routine-kicker">PROGRAM YOUR TRAINING</span>
          <h1>Routines</h1>
          <p>Build repeatable sessions, organize them your way, and start training in one tap.</p>
        </div>
        <button type="button" className="routine-button routine-button-dark routine-header-action" onClick={openCreate}>
          <Plus size={18} /> New routine
        </button>
      </header>

      <div className="routine-summary" aria-label="Routine overview">
        <span><strong>{routines.length}</strong> {routines.length === 1 ? 'routine' : 'routines'}</span>
        <span><strong>{groups.length}</strong> {groups.length === 1 ? 'folder' : 'folders'}</span>
        <span><strong>{programmedExerciseCount}</strong> programmed exercises</span>
      </div>

      <button type="button" className="routine-button routine-button-dark routine-mobile-create" onClick={openCreate}>
        <Plus size={18} /> New routine
      </button>

      <div className="routine-workspace">
        <div className="routine-primary">
          {groups.length ? (
            <div className="routine-groups">
              {groups.map((group, groupIndex) => (
                <motion.section
                  className="routine-folder"
                  key={group.folder}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: groupIndex * 0.04 }}
                >
                  <header className="routine-folder-heading">
                    <span><Folder size={15} /> {group.folder}</span>
                    <small>{plural(group.items.length, 'routine')}</small>
                  </header>

                  <div className="routine-list">
                    {group.items.map((routine, index) => {
                      const exerciseIds = routine.exerciseIds || []
                      const exerciseNames = exerciseIds
                        .map((id) => exerciseMap.get(id)?.name)
                        .filter(Boolean)
                      const prescribedCount = exerciseIds.filter((id) => routine.prescriptions?.[id]).length
                      return (
                        <motion.article className="routine-row" key={routine.id} layout>
                          <span className="routine-row-index">{String(index + 1).padStart(2, '0')}</span>
                          <div className="routine-row-main">
                            <h3>{routine.name}</h3>
                            <p>{routine.description || exerciseNames.slice(0, 3).join(' · ') || 'Ready for exercises'}</p>
                            <span>
                              {plural(exerciseIds.length, 'exercise')}
                              {prescribedCount ? ' · ' + prescribedCount + ' prescribed' : ''}
                              {exerciseNames.length > 3 ? ' · +' + (exerciseNames.length - 3) + ' more' : ''}
                            </span>
                          </div>
                          <div className="routine-row-actions">
                            <button
                              type="button"
                              className="routine-icon-button"
                              onClick={() => openEdit(routine)}
                              aria-label={'Edit ' + routine.name}
                              title="Edit routine"
                            >
                              <Edit3 size={17} />
                            </button>
                            <button
                              type="button"
                              className="routine-icon-button"
                              onClick={() => onDuplicate(routine.id)}
                              aria-label={'Duplicate ' + routine.name}
                              title="Duplicate routine"
                            >
                              <Copy size={17} />
                            </button>
                            <button
                              type="button"
                              className="routine-icon-button routine-delete-button"
                              onClick={() => setDeleteTarget(routine)}
                              aria-label={'Delete ' + routine.name}
                              title="Delete routine"
                            >
                              <Trash2 size={17} />
                            </button>
                            <button
                              type="button"
                              className="routine-start-button"
                              onClick={() => onStart(routine)}
                              disabled={!exerciseIds.length}
                              aria-label={'Start ' + routine.name}
                            >
                              <Play size={16} fill="currentColor" />
                              <span>Start</span>
                            </button>
                          </div>
                        </motion.article>
                      )
                    })}
                  </div>
                </motion.section>
              ))}
            </div>
          ) : (
            <motion.section
              className="routine-empty"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <span><Layers3 size={25} strokeWidth={1.7} /></span>
              <div>
                <span className="routine-kicker">NO ROUTINES YET</span>
                <h2>Make every session easier to start.</h2>
                <p>Build a routine from the full exercise library, or save one of the programs alongside it.</p>
              </div>
              <button type="button" className="routine-button routine-button-dark" onClick={openCreate}>
                <Plus size={17} /> Build a routine
              </button>
            </motion.section>
          )}
        </div>

        <aside className="routine-program-library">
          <header className="routine-program-header">
            <span className="routine-program-icon"><Sparkles size={17} /></span>
            <span className="routine-program-kicker">BUILT-IN PROGRAMS</span>
            <h2>A strong place to start.</h2>
            <p>Save a ready-made session, then edit it around your equipment and goals.</p>
          </header>

          <div className="routine-program-list">
            {PROGRAM_LIBRARY.map((program, index) => {
              const alreadySaved = savedPrograms.has(program.id) || routines.some(
                (routine) => routine.name === program.name && sameExerciseList(routine.exerciseIds, program.exerciseIds),
              )
              return (
                <article className="routine-program" key={program.id}>
                  <span className="routine-program-number">0{index + 1}</span>
                  <h3>{program.name}</h3>
                  <p>{program.description}</p>
                  <div className="routine-program-meta">
                    <span>{program.frequency}</span>
                    <span>{program.duration}</span>
                    <span>{plural(program.exerciseIds.length, 'move')}</span>
                  </div>
                  <button
                    type="button"
                    className={'routine-save-program ' + (alreadySaved ? 'routine-is-saved' : '')}
                    onClick={() => saveProgram(program)}
                    disabled={alreadySaved}
                  >
                    {alreadySaved ? <Check size={16} /> : <Plus size={16} />}
                    {alreadySaved ? 'Saved to routines' : 'Save this program'}
                  </button>
                </article>
              )
            })}
          </div>
        </aside>
      </div>

      {typeof document !== 'undefined' ? createPortal(modalLayer, document.body) : modalLayer}
    </div>
  )
}

export { RoutinesView }
export default RoutinesView
