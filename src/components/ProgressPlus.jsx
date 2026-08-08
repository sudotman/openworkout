import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  Activity,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Flame,
  Moon,
  Plus,
  Ruler,
  Scale,
  Trash2,
  TrendingUp,
  Trophy,
  X,
} from 'lucide-react'
import '../progress-plus.css'

const DAY_MS = 86400000
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const DURATION_EXERCISES = new Set(['forearm-plank', 'side-plank'])
const DISTANCE_EXERCISES = new Set([
  'farmers-carry',
  'suitcase-carry',
  'kettlebell-front-rack-carry',
  'sled-push',
])
const MEASUREMENT_FIELDS = [
  { key: 'weight', label: 'Weight', icon: Scale, kind: 'weight' },
  { key: 'bodyFat', label: 'Body fat', suffix: '%' },
  { key: 'waist', label: 'Waist', kind: 'length' },
  { key: 'chest', label: 'Chest', kind: 'length' },
  { key: 'arm', label: 'Arm', kind: 'length' },
  { key: 'thigh', label: 'Thigh', kind: 'length' },
]

function toDate(value) {
  if (value instanceof Date) return new Date(value)
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(value + 'T12:00:00')
  }
  return new Date(value)
}

function isValidDate(date) {
  return date instanceof Date && !Number.isNaN(date.getTime())
}

function atStartOfDay(value) {
  const date = toDate(value)
  if (!isValidDate(date)) return null
  date.setHours(0, 0, 0, 0)
  return date
}

function localDateKey(value) {
  const date = toDate(value)
  if (!isValidDate(date)) return ''
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function todayInputValue() {
  return localDateKey(new Date())
}

function formatDate(value, options) {
  const date = toDate(value)
  if (!isValidDate(date)) return 'Unknown date'
  return new Intl.DateTimeFormat('en', options).format(date)
}

function formatNumber(value, maximumFractionDigits = 1) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '—'
  return new Intl.NumberFormat('en', { maximumFractionDigits }).format(number)
}

function compactNumber(value) {
  const number = Number(value) || 0
  return new Intl.NumberFormat('en', {
    notation: Math.abs(number) >= 10000 ? 'compact' : 'standard',
    maximumFractionDigits: Math.abs(number) >= 10000 ? 1 : 0,
  }).format(number)
}

function normalizedUnit(unit) {
  return String(unit).toLowerCase().startsWith('lb') ? 'lb' : 'kg'
}

function formatDuration(seconds) {
  const value = Math.max(0, Math.round(Number(seconds) || 0))
  if (value < 60) return value + ' sec'
  const minutes = Math.floor(value / 60)
  const remainder = value % 60
  return remainder ? minutes + 'm ' + remainder + 's' : minutes + ' min'
}

function exerciseTrackingType(exercise, exerciseId) {
  if (typeof exercise === 'object' && exercise?.trackingType) return exercise.trackingType
  if (DURATION_EXERCISES.has(exerciseId)) return 'duration'
  if (DISTANCE_EXERCISES.has(exerciseId)) return 'distance'
  return 'weight-reps'
}

function startOfWeek(value) {
  const date = atStartOfDay(value)
  if (!date) return null
  const day = date.getDay() || 7
  date.setDate(date.getDate() - day + 1)
  return date
}

function getCompletedSets(workoutExercise) {
  return (workoutExercise?.sets || []).filter((set) => set?.completed)
}

function lookupExercise(exerciseMap, exerciseId) {
  if (!exerciseMap || !exerciseId) return null
  if (typeof exerciseMap.get === 'function') return exerciseMap.get(exerciseId) || null
  if (Array.isArray(exerciseMap)) {
    return exerciseMap.find((exercise) => exercise?.id === exerciseId) || null
  }
  return exerciseMap[exerciseId] || null
}

function EmptyPanel({ icon: Icon, title, body, actionLabel, onAction }) {
  return (
    <motion.div
      className="pp-empty"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24 }}
    >
      <span className="pp-empty-icon"><Icon size={21} /></span>
      <strong>{title}</strong>
      <p>{body}</p>
      {actionLabel && onAction && (
        <button className="pp-button pp-button--dark" type="button" onClick={onAction}>
          <Plus size={16} /> {actionLabel}
        </button>
      )}
    </motion.div>
  )
}

/**
 * Month calendar for completed workouts. Dates with more than one workout show
 * multiple dots; the callback receives the first workout and the full day's list.
 */
export function TrainingCalendar({ workouts = [], onSelectWorkout }) {
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const date = new Date()
    return new Date(date.getFullYear(), date.getMonth(), 1)
  })
  const [direction, setDirection] = useState(1)

  const workoutDays = useMemo(() => {
    const days = new Map()
    workouts.forEach((workout) => {
      const key = localDateKey(workout?.startedAt || workout?.completedAt)
      if (!key) return
      if (!days.has(key)) days.set(key, [])
      days.get(key).push(workout)
    })
    return days
  }, [workouts])

  const calendarDays = useMemo(() => {
    const first = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1)
    const mondayOffset = (first.getDay() + 6) % 7
    const gridStart = new Date(first)
    gridStart.setDate(first.getDate() - mondayOffset)
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(gridStart)
      date.setDate(gridStart.getDate() + index)
      return date
    })
  }, [visibleMonth])

  const currentWeekStart = startOfWeek(new Date())
  const weeklyStreak = useMemo(() => {
    if (!workoutDays.size || !currentWeekStart) return 0
    const hasTrainingInWeek = (weekStart) => {
      for (let day = 0; day < 7; day += 1) {
        const candidate = new Date(weekStart)
        candidate.setDate(weekStart.getDate() + day)
        if (workoutDays.has(localDateKey(candidate))) return true
      }
      return false
    }

    const cursor = new Date(currentWeekStart)
    // An in-progress week does not erase a streak earned through last week.
    if (!hasTrainingInWeek(cursor)) cursor.setDate(cursor.getDate() - 7)
    let streak = 0
    while (hasTrainingInWeek(cursor) && streak < 520) {
      streak += 1
      cursor.setDate(cursor.getDate() - 7)
    }
    return streak
  }, [currentWeekStart, workoutDays])

  const restDaysThisWeek = useMemo(() => {
    if (!currentWeekStart) return 0
    const today = atStartOfDay(new Date())
    let count = 0
    const cursor = new Date(currentWeekStart)
    // Count only finished days; today is still available for training.
    while (cursor < today) {
      if (!workoutDays.has(localDateKey(cursor))) count += 1
      cursor.setDate(cursor.getDate() + 1)
    }
    return count
  }, [currentWeekStart, workoutDays])

  const monthWorkoutCount = useMemo(() => {
    return workouts.filter((workout) => {
      const date = toDate(workout?.startedAt || workout?.completedAt)
      return isValidDate(date) &&
        date.getFullYear() === visibleMonth.getFullYear() &&
        date.getMonth() === visibleMonth.getMonth()
    }).length
  }, [visibleMonth, workouts])

  const changeMonth = (amount) => {
    setDirection(amount)
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1))
  }

  const returnToToday = () => {
    const now = new Date()
    const amount = now > visibleMonth ? 1 : -1
    setDirection(amount)
    setVisibleMonth(new Date(now.getFullYear(), now.getMonth(), 1))
  }

  const isCurrentMonth = visibleMonth.getFullYear() === new Date().getFullYear() &&
    visibleMonth.getMonth() === new Date().getMonth()

  return (
    <section className="pp-module pp-calendar" aria-labelledby="pp-calendar-title">
      <header className="pp-module-head">
        <div>
          <span className="pp-kicker">CONSISTENCY</span>
          <h2 id="pp-calendar-title">Training calendar</h2>
        </div>
        {!isCurrentMonth && (
          <button className="pp-text-button" type="button" onClick={returnToToday}>Today</button>
        )}
      </header>

      <div className="pp-calendar-summary">
        <div>
          <span className="pp-summary-icon pp-summary-icon--accent"><Flame size={17} /></span>
          <span><strong>{weeklyStreak}</strong><small>week streak</small></span>
        </div>
        <div>
          <span className="pp-summary-icon"><Moon size={17} /></span>
          <span><strong>{restDaysThisWeek}</strong><small>rest days this week</small></span>
        </div>
        <div>
          <span className="pp-summary-icon"><Dumbbell size={17} /></span>
          <span><strong>{monthWorkoutCount}</strong><small>sessions this month</small></span>
        </div>
      </div>

      <div className="pp-month-controls">
        <button type="button" onClick={() => changeMonth(-1)} aria-label="Previous month">
          <ChevronLeft size={19} />
        </button>
        <strong aria-live="polite">
          {formatDate(visibleMonth, { month: 'long', year: 'numeric' })}
        </strong>
        <button type="button" onClick={() => changeMonth(1)} aria-label="Next month">
          <ChevronRight size={19} />
        </button>
      </div>

      <div className="pp-weekdays" aria-hidden="true">
        {WEEKDAYS.map((day, index) => <span key={day + index}>{day}</span>)}
      </div>

      <div className="pp-calendar-viewport">
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.div
            className="pp-calendar-grid"
            key={visibleMonth.toISOString()}
            custom={direction}
            initial={(travel) => ({ opacity: 0, x: travel * 18 })}
            animate={{ opacity: 1, x: 0 }}
            exit={(travel) => ({ opacity: 0, x: travel * -18 })}
            transition={{ duration: 0.19, ease: [0.22, 1, 0.36, 1] }}
          >
            {calendarDays.map((date) => {
              const key = localDateKey(date)
              const dayWorkouts = workoutDays.get(key) || []
              const outsideMonth = date.getMonth() !== visibleMonth.getMonth()
              const isToday = key === localDateKey(new Date())
              const label = formatDate(date, { weekday: 'long', month: 'long', day: 'numeric' })
              return (
                <button
                  className={[
                    'pp-calendar-day',
                    outsideMonth ? 'pp-calendar-day--outside' : '',
                    isToday ? 'pp-calendar-day--today' : '',
                    dayWorkouts.length ? 'pp-calendar-day--trained' : '',
                  ].filter(Boolean).join(' ')}
                  key={key}
                  type="button"
                  disabled={!dayWorkouts.length}
                  onClick={() => onSelectWorkout?.(dayWorkouts[0], dayWorkouts)}
                  aria-label={dayWorkouts.length
                    ? label + ', ' + dayWorkouts.length + (dayWorkouts.length === 1 ? ' workout' : ' workouts')
                    : label + ', no workout'}
                >
                  <span>{date.getDate()}</span>
                  <i className="pp-workout-dots" aria-hidden="true">
                    {dayWorkouts.slice(0, 3).map((workout, index) => (
                      <b key={workout?.id || key + index} />
                    ))}
                  </i>
                </button>
              )
            })}
          </motion.div>
        </AnimatePresence>
      </div>

      {!workouts.length && (
        <div className="pp-inline-empty">
          <CalendarDays size={16} /> Complete a workout to begin your calendar.
        </div>
      )}
    </section>
  )
}

function WeightTrend({ entries, unit }) {
  const points = useMemo(() => {
    return entries
      .filter((entry) => entry?.weight !== null && entry?.weight !== '' && Number.isFinite(Number(entry?.weight)))
      .slice(-12)
      .map((entry) => ({ ...entry, numericWeight: Number(entry.weight) }))
  }, [entries])

  if (!points.length) {
    return (
      <div className="pp-trend-empty">
        <TrendingUp size={18} /> Add weight to a check-in to see your trend.
      </div>
    )
  }

  const values = points.map((point) => point.numericWeight)
  const minimum = Math.min(...values)
  const maximum = Math.max(...values)
  const spread = Math.max(maximum - minimum, Math.max(maximum * 0.02, 1))
  const chartPoints = points.map((point, index) => ({
    ...point,
    x: 13 + (index / Math.max(points.length - 1, 1)) * 294,
    y: 14 + ((maximum - point.numericWeight) / spread) * 70,
  }))
  const line = chartPoints.map((point) => point.x + ',' + point.y).join(' ')
  const area = 'M ' + chartPoints[0].x + ' 92 L ' +
    chartPoints.map((point) => point.x + ' ' + point.y).join(' L ') +
    ' L ' + chartPoints.at(-1).x + ' 92 Z'

  return (
    <div className="pp-trend-chart">
      <div className="pp-trend-title">
        <span>WEIGHT TREND</span>
        <strong>{formatNumber(points.at(-1).numericWeight)} {unit}</strong>
      </div>
      <svg viewBox="0 0 320 108" role="img" aria-label={'Weight trend across ' + points.length + ' check-ins'}>
        <title>Weight trend</title>
        <line className="pp-chart-grid" x1="13" x2="307" y1="92" y2="92" />
        <path className="pp-chart-area" d={area} />
        <motion.polyline
          className="pp-chart-line"
          points={line}
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
        />
        {chartPoints.map((point, index) => (
          <motion.circle
            className="pp-chart-point"
            cx={point.x}
            cy={point.y}
            r="3.4"
            key={(point.id || point.date) + index}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.05 + index * 0.025 }}
          />
        ))}
      </svg>
      <div className="pp-chart-dates">
        <span>{formatDate(points[0].date, { month: 'short', day: 'numeric' })}</span>
        <span>{formatDate(points.at(-1).date, { month: 'short', day: 'numeric' })}</span>
      </div>
    </div>
  )
}

/** Body measurements with a local callback-driven add/delete flow. */
export function MeasurementsPanel({ measurements = [], onAdd, onDelete, unit = 'kg' }) {
  const weightUnit = normalizedUnit(unit)
  const lengthUnit = weightUnit === 'lb' ? 'in' : 'cm'
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({
    date: todayInputValue(),
    weight: '',
    bodyFat: '',
    waist: '',
    chest: '',
    arm: '',
    thigh: '',
  })

  const entries = useMemo(() => {
    return [...measurements]
      .filter((entry) => entry && isValidDate(toDate(entry.date || entry.createdAt)))
      .sort((a, b) => toDate(a.date || a.createdAt) - toDate(b.date || b.createdAt))
  }, [measurements])
  const latest = entries.at(-1)
  const weightedEntries = entries.filter((entry) =>
    entry?.weight !== null && entry?.weight !== '' && Number.isFinite(Number(entry?.weight)),
  )
  const latestWeightEntry = weightedEntries.at(-1)
  const previousWeightEntry = weightedEntries.at(-2)
  const latestWeight = latestWeightEntry ? Number(latestWeightEntry.weight) : null
  const weightChange = latestWeight !== null && previousWeightEntry
    ? latestWeight - Number(previousWeightEntry.weight)
    : null
  const hasValue = MEASUREMENT_FIELDS.some((field) => form[field.key] !== '')

  const getSuffix = (field) => {
    if (field.suffix) return field.suffix
    if (field.kind === 'weight') return weightUnit
    if (field.kind === 'length') return lengthUnit
    return ''
  }

  const updateField = (key, value) => setForm((current) => ({ ...current, [key]: value }))

  const submit = (event) => {
    event.preventDefault()
    if (!form.date || !hasValue) return
    const id = globalThis.crypto?.randomUUID?.() || 'measurement-' + Date.now()
    const nextEntry = { id, date: form.date }
    MEASUREMENT_FIELDS.forEach((field) => {
      nextEntry[field.key] = form[field.key] === '' ? null : Number(form[field.key])
    })
    onAdd?.(nextEntry)
    setForm({
      date: todayInputValue(),
      weight: '',
      bodyFat: '',
      waist: '',
      chest: '',
      arm: '',
      thigh: '',
    })
    setAdding(false)
  }

  return (
    <section className="pp-module pp-measurements" aria-labelledby="pp-measurements-title">
      <header className="pp-module-head">
        <div>
          <span className="pp-kicker">BODY METRICS</span>
          <h2 id="pp-measurements-title">Measurements</h2>
        </div>
        <button
          className={adding ? 'pp-icon-button' : 'pp-button pp-button--dark'}
          type="button"
          onClick={() => setAdding((value) => !value)}
          aria-label={adding ? 'Close measurement form' : 'Add measurement'}
        >
          {adding ? <X size={18} /> : <><Plus size={16} /> <span>Add entry</span></>}
        </button>
      </header>

      <AnimatePresence initial={false}>
        {adding && (
          <motion.form
            className="pp-measurement-form"
            onSubmit={submit}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="pp-form-inner">
              <label className="pp-field pp-field--date">
                <span>Date</span>
                <input
                  type="date"
                  value={form.date}
                  max={todayInputValue()}
                  onChange={(event) => updateField('date', event.target.value)}
                  required
                />
              </label>
              <div className="pp-field-grid">
                {MEASUREMENT_FIELDS.map((field) => (
                  <label className="pp-field" key={field.key}>
                    <span>{field.label} <i>{getSuffix(field)}</i></span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.1"
                      value={form[field.key]}
                      placeholder="—"
                      onChange={(event) => updateField(field.key, event.target.value)}
                    />
                  </label>
                ))}
              </div>
              <button className="pp-button pp-button--accent pp-button--wide" type="submit" disabled={!hasValue}>
                Save measurement
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {entries.length ? (
        <>
          <div className="pp-latest-measurement">
            <div className="pp-featured-value">
              <span className="pp-summary-icon pp-summary-icon--accent"><Scale size={18} /></span>
              <div>
                <small>LATEST WEIGHT</small>
                <strong>{latestWeight !== null ? formatNumber(latestWeight) : '—'} <i>{latestWeight !== null ? weightUnit : ''}</i></strong>
                <span className={weightChange > 0 ? 'pp-change pp-change--up' : 'pp-change'}>
                  {weightChange === null
                    ? 'No prior weight entry'
                    : (weightChange > 0 ? '+' : '') + formatNumber(weightChange) + ' ' + weightUnit + ' since last check-in'}
                </span>
              </div>
            </div>
            <div className="pp-latest-grid">
              {MEASUREMENT_FIELDS.slice(1).map((field) => (
                <div key={field.key}>
                  <span>{field.label}</span>
                  <strong>{latest?.[field.key] == null ? '—' : formatNumber(latest[field.key])}</strong>
                  <small>{latest?.[field.key] == null ? '' : getSuffix(field)}</small>
                </div>
              ))}
            </div>
          </div>

          <WeightTrend entries={entries} unit={weightUnit} />

          <div className="pp-measurement-history">
            <div className="pp-subhead">
              <strong>Recent check-ins</strong>
              <span>{entries.length} total</span>
            </div>
            {[...entries].reverse().slice(0, 6).map((entry, index) => {
              const details = MEASUREMENT_FIELDS.slice(1)
                .filter((field) => entry[field.key] != null)
                .slice(0, 3)
                .map((field) => field.label + ' ' + formatNumber(entry[field.key]) + getSuffix(field))
              return (
                <motion.div
                  className="pp-measurement-row"
                  key={entry.id || entry.date + index}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.025 }}
                >
                  <span className="pp-measurement-date">
                    <strong>{formatDate(entry.date || entry.createdAt, { day: '2-digit' })}</strong>
                    <small>{formatDate(entry.date || entry.createdAt, { month: 'short', year: 'numeric' })}</small>
                  </span>
                  <span className="pp-measurement-detail">
                    <strong>{entry.weight == null ? 'Body check-in' : formatNumber(entry.weight) + ' ' + weightUnit}</strong>
                    <small>{details.length ? details.join(' · ') : 'No additional measurements'}</small>
                  </span>
                  <button
                    type="button"
                    onClick={() => onDelete?.(entry.id, entry)}
                    aria-label={'Delete measurement from ' + formatDate(entry.date || entry.createdAt, { month: 'long', day: 'numeric' })}
                  >
                    <Trash2 size={16} />
                  </button>
                </motion.div>
              )
            })}
          </div>
        </>
      ) : (
        <EmptyPanel
          icon={Ruler}
          title="Start your baseline"
          body="Track only the measurements useful to you. Every field is optional."
          actionLabel="Add first entry"
          onAction={() => setAdding(true)}
        />
      )}
    </section>
  )
}

/** Completed working-set distribution by primary muscle over the last 30 days. */
export function MuscleBreakdown({ workouts = [], exerciseMap }) {
  const breakdown = useMemo(() => {
    const cutoff = atStartOfDay(new Date(Date.now() - 29 * DAY_MS))
    const counts = new Map()
    workouts.forEach((workout) => {
      const workoutDate = toDate(workout?.startedAt || workout?.completedAt)
      if (!isValidDate(workoutDate) || workoutDate < cutoff) return
      ;(workout.exercises || []).forEach((workoutExercise) => {
        const exercise = lookupExercise(exerciseMap, workoutExercise.exerciseId)
        const muscle = exercise?.primaryMuscle
        const setCount = getCompletedSets(workoutExercise).length
        if (!muscle || !setCount) return
        counts.set(muscle, (counts.get(muscle) || 0) + setCount)
      })
    })
    return [...counts.entries()]
      .map(([muscle, sets]) => ({ muscle, sets }))
      .sort((a, b) => b.sets - a.sets || a.muscle.localeCompare(b.muscle))
  }, [exerciseMap, workouts])

  const totalSets = breakdown.reduce((total, item) => total + item.sets, 0)
  const maximum = Math.max(...breakdown.map((item) => item.sets), 1)

  return (
    <section className="pp-module pp-muscles" aria-labelledby="pp-muscles-title">
      <header className="pp-module-head">
        <div>
          <span className="pp-kicker">LAST 30 DAYS</span>
          <h2 id="pp-muscles-title">Muscle balance</h2>
        </div>
        {!!totalSets && <span className="pp-total-badge">{totalSets} sets</span>}
      </header>

      {breakdown.length ? (
        <>
          <div className="pp-muscle-lead">
            <span className="pp-summary-icon pp-summary-icon--accent"><Activity size={18} /></span>
            <div>
              <small>MOST TRAINED</small>
              <strong>{breakdown[0].muscle}</strong>
              <span>{breakdown[0].sets} working sets</span>
            </div>
            <div>
              <small>MUSCLES HIT</small>
              <strong>{breakdown.length}</strong>
            </div>
          </div>

          <div className="pp-muscle-list">
            {breakdown.map((item, index) => (
              <div className="pp-muscle-row" key={item.muscle}>
                <div className="pp-muscle-label-row">
                  <span><i>{String(index + 1).padStart(2, '0')}</i>{item.muscle}</span>
                  <strong>{item.sets}<small> sets</small></strong>
                </div>
                <div className="pp-muscle-track">
                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: (item.sets / maximum) * 100 + '%' }}
                    viewport={{ once: true, amount: 0.7 }}
                    transition={{ duration: 0.48, delay: index * 0.035, ease: [0.22, 1, 0.36, 1] }}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="pp-footnote">Primary muscle only · completed working sets</p>
        </>
      ) : (
        <EmptyPanel
          icon={Dumbbell}
          title="No muscle data yet"
          body="Complete a working set and its primary muscle will appear here."
        />
      )}
    </section>
  )
}

function PerformanceChart({ sessions, metric = 'estimate', unit }) {
  const chartMeta = {
    estimate: { title: 'Estimated 1RM trend', suffix: unit, aria: 'Estimated one rep max' },
    reps: { title: 'Rep trend', suffix: 'reps', aria: 'Rep' },
    duration: { title: 'Duration trend', suffix: 'seconds', aria: 'Duration' },
    distance: { title: 'Distance trend', suffix: 'm', aria: 'Distance' },
  }[metric]
  const data = sessions.slice(-12).map((session) => ({
    ...session,
    chartValue: metric === 'estimate'
      ? session.bestEstimate
      : metric === 'reps'
        ? session.bestReps
        : session.bestMetric,
  })).filter((session) => Number.isFinite(session.chartValue))

  if (!data.length) return null
  const values = data.map((session) => session.chartValue)
  const minimum = Math.min(...values)
  const maximum = Math.max(...values)
  const spread = Math.max(maximum - minimum, Math.max(maximum * 0.04, 1))
  const points = data.map((session, index) => ({
    ...session,
    x: 16 + (index / Math.max(data.length - 1, 1)) * 288,
    y: 14 + ((maximum - session.chartValue) / spread) * 74,
  }))
  const polyline = points.map((point) => point.x + ',' + point.y).join(' ')
  const area = 'M ' + points[0].x + ' 96 L ' +
    points.map((point) => point.x + ' ' + point.y).join(' L ') +
    ' L ' + points.at(-1).x + ' 96 Z'

  return (
    <div className="pp-performance-chart">
      <div className="pp-subhead">
        <strong>{chartMeta.title}</strong>
        <span>{chartMeta.suffix}</span>
      </div>
      <svg viewBox="0 0 320 112" role="img" aria-label={chartMeta.aria + ' trend'}>
        <title>{chartMeta.title}</title>
        <line className="pp-chart-grid" x1="16" x2="304" y1="96" y2="96" />
        <path className="pp-chart-area" d={area} />
        <motion.polyline
          className="pp-chart-line"
          points={polyline}
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        />
        {points.map((point, index) => (
          <motion.circle
            className="pp-chart-point"
            key={point.workoutId || index}
            cx={point.x}
            cy={point.y}
            r="3.4"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.12 + index * 0.025 }}
          />
        ))}
      </svg>
      <div className="pp-chart-dates">
        <span>{formatDate(data[0].date, { month: 'short', day: 'numeric' })}</span>
        <span>{formatDate(data.at(-1).date, { month: 'short', day: 'numeric' })}</span>
      </div>
    </div>
  )
}

/** Detailed performance history for one exercise. */
export function ExercisePerformance({ exercise, workouts = [], unit = 'kg' }) {
  const weightUnit = normalizedUnit(unit)
  const exerciseId = typeof exercise === 'string' ? exercise : exercise?.id
  const exerciseName = typeof exercise === 'string' ? 'Exercise performance' : exercise?.name || 'Exercise performance'
  const trackingType = exerciseTrackingType(exercise, exerciseId)

  const sessions = useMemo(() => {
    if (!exerciseId) return []
    return workouts.flatMap((workout) => {
      const entry = (workout.exercises || []).find((item) => item.exerciseId === exerciseId)
      const sets = getCompletedSets(entry)
        .map((set, setIndex) => ({
          id: set.id || workout.id + '-set-' + setIndex,
          weight: Number(set.weight) || 0,
          reps: Number(set.reps) || 0,
          duration: Number(set.duration) || 0,
          distance: Number(set.distance) || 0,
          rpe: Number(set.rpe) || null,
        }))
        .filter((set) => trackingType === 'duration'
          ? set.duration > 0
          : trackingType === 'distance'
            ? set.distance > 0
            : set.reps > 0)
      if (!sets.length) return []
      const date = workout.startedAt || workout.completedAt
      const validDate = toDate(date)
      if (!isValidDate(validDate)) return []
      return [{
        workoutId: workout.id,
        workoutName: workout.name,
        date,
        sets,
        volume: sets.reduce((total, set) => total + set.weight * set.reps, 0),
        bestEstimate: Math.max(...sets.map((set) => set.weight * (1 + set.reps / 30))),
        bestReps: Math.max(...sets.map((set) => set.reps)),
        bestMetric: trackingType === 'duration'
          ? Math.max(...sets.map((set) => set.duration))
          : Math.max(...sets.map((set) => set.distance)),
      }]
    }).sort((a, b) => toDate(a.date) - toDate(b.date))
  }, [exerciseId, trackingType, workouts])

  const allSets = sessions.flatMap((session) => session.sets.map((set) => ({ ...set, session })))
  const bestWeight = Math.max(...allSets.map((set) => set.weight), 0)
  const bestEstimate = Math.max(...allSets.map((set) => set.weight * (1 + set.reps / 30)), 0)
  const bestVolume = Math.max(...sessions.map((session) => session.volume), 0)
  const bestReps = Math.max(...allSets.map((set) => set.reps), 0)
  const usesRepTrend = bestEstimate === 0
  const bestDuration = Math.max(...allSets.map((set) => set.duration), 0)
  const totalDuration = allSets.reduce((total, set) => total + set.duration, 0)
  const bestDistance = Math.max(...allSets.map((set) => set.distance), 0)
  const totalDistance = allSets.reduce((total, set) => total + set.distance, 0)
  const recentSets = [...allSets].reverse().slice(0, 10)

  return (
    <section className="pp-module pp-performance" aria-labelledby="pp-performance-title">
      <header className="pp-module-head pp-module-head--performance">
        <div>
          <span className="pp-kicker">EXERCISE HISTORY</span>
          <h2 id="pp-performance-title">{exerciseName}</h2>
          {typeof exercise !== 'string' && exercise?.primaryMuscle && (
            <p>{exercise.primaryMuscle} · {exercise.equipment}</p>
          )}
        </div>
        {!!sessions.length && <span className="pp-total-badge">{sessions.length} sessions</span>}
      </header>

      {sessions.length ? (
        <>
          {trackingType === 'duration' ? (
            <div className="pp-performance-metrics">
              <div><span><Trophy size={15} /> BEST HOLD</span><strong>{formatDuration(bestDuration)}</strong></div>
              <div><span><Activity size={15} /> TOTAL TIME</span><strong>{formatDuration(totalDuration)}</strong></div>
              <div><span><Dumbbell size={15} /> COMPLETED SETS</span><strong>{allSets.length}</strong></div>
              <div><span><TrendingUp size={15} /> SESSIONS</span><strong>{sessions.length}</strong></div>
            </div>
          ) : trackingType === 'distance' ? (
            <div className="pp-performance-metrics">
              <div><span><Trophy size={15} /> BEST DISTANCE</span><strong>{formatNumber(bestDistance)}<small> m</small></strong></div>
              <div><span><Dumbbell size={15} /> HEAVIEST LOAD</span><strong>{formatNumber(bestWeight)}<small> {weightUnit}</small></strong></div>
              <div><span><Activity size={15} /> TOTAL DISTANCE</span><strong>{compactNumber(totalDistance)}<small> m</small></strong></div>
              <div><span><TrendingUp size={15} /> SESSIONS</span><strong>{sessions.length}</strong></div>
            </div>
          ) : (
            <div className="pp-performance-metrics">
              <div>
                <span><Dumbbell size={15} /> BEST WEIGHT</span>
                <strong>{formatNumber(bestWeight)}<small> {weightUnit}</small></strong>
              </div>
              <div>
                <span><Trophy size={15} /> EST. 1RM</span>
                <strong>{bestEstimate ? formatNumber(bestEstimate) : '—'}<small>{bestEstimate ? ' ' + weightUnit : ''}</small></strong>
              </div>
              <div>
                <span><Activity size={15} /> BEST VOLUME</span>
                <strong>{compactNumber(bestVolume)}<small> {weightUnit}</small></strong>
              </div>
              <div>
                <span><TrendingUp size={15} /> BEST REPS</span>
                <strong>{bestReps}<small> reps</small></strong>
              </div>
            </div>
          )}

          <PerformanceChart
            sessions={sessions}
            metric={trackingType === 'duration'
              ? 'duration'
              : trackingType === 'distance'
                ? 'distance'
                : usesRepTrend ? 'reps' : 'estimate'}
            unit={weightUnit}
          />

          <div className="pp-set-history">
            <div className="pp-subhead">
              <strong>Recent sets</strong>
              <span>{allSets.length} completed</span>
            </div>
            <div className="pp-set-history-head" aria-hidden="true">
              <span>Date</span>
              <span>{trackingType === 'duration' ? 'Duration' : trackingType === 'distance' ? 'Distance' : 'Set'}</span>
              <span>{trackingType === 'duration' ? 'Total' : trackingType === 'distance' ? 'Load' : 'e1RM'}</span>
              <span>RPE</span>
            </div>
            {recentSets.map((set, index) => (
              <motion.div
                className="pp-set-history-row"
                key={set.session.workoutId + '-' + set.id + '-' + index}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.02 }}
              >
                <span>
                  <strong>{formatDate(set.session.date, { month: 'short', day: 'numeric' })}</strong>
                  <small>{formatDate(set.session.date, { year: 'numeric' })}</small>
                </span>
                {trackingType === 'duration' ? (
                  <>
                    <span><strong>{formatDuration(set.duration)}</strong><small>timed hold</small></span>
                    <span><strong>{formatDuration(set.duration)}</strong><small>completed</small></span>
                  </>
                ) : trackingType === 'distance' ? (
                  <>
                    <span><strong>{formatNumber(set.distance)} m</strong><small>distance</small></span>
                    <span><strong>{formatNumber(set.weight)}</strong><small>{weightUnit}</small></span>
                  </>
                ) : (
                  <>
                    <span><strong>{formatNumber(set.weight)} × {set.reps}</strong><small>{weightUnit} × reps</small></span>
                    <span><strong>{set.weight ? formatNumber(set.weight * (1 + set.reps / 30)) : '—'}</strong><small>{set.weight ? weightUnit : ''}</small></span>
                  </>
                )}
                <span><strong>{set.rpe || '—'}</strong><small>{set.rpe ? '/ 10' : ''}</small></span>
              </motion.div>
            ))}
          </div>
        </>
      ) : (
        <EmptyPanel
          icon={Trophy}
          title={exerciseId ? 'No completed sets yet' : 'Choose an exercise'}
          body={exerciseId
            ? 'Log a completed set for this exercise to unlock records and trends.'
            : 'Select an exercise to inspect its best sets and performance history.'}
        />
      )}
    </section>
  )
}
