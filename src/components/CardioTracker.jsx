import { useEffect, useRef, useState } from 'react'
import { Check, Gauge, HeartPulse, Plus, Route, TimerReset, Trash2, TrendingUp } from 'lucide-react'
import {
  cardioSetDistanceKm,
  cardioSetPaceSecondsPerKm,
  cardioSetSpeedKph,
  distanceFromKilometers,
  distanceToKilometers,
  formatCardioDistance,
  formatCardioPace,
  formatCardioSpeed,
  formatCardioTime,
  normalizeDistanceUnit,
  parseCardioTime,
} from '../lib/cardio.js'
import '../cardio.css'

function MetricInput({ label, suffix, value, onChange, min = 0, max, step = 'any', placeholder = '—' }) {
  return (
    <label className="cardio-field">
      <span>{label}</span>
      <span className="cardio-input-wrap">
        <input
          inputMode="decimal"
          type="number"
          min={min}
          max={max}
          step={step}
          value={value ?? ''}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
        {suffix && <small>{suffix}</small>}
      </span>
    </label>
  )
}

function DurationInput({ value, onChange }) {
  const [draft, setDraft] = useState(() => value ? formatCardioTime(value) : '')
  const focused = useRef(false)

  useEffect(() => {
    if (!focused.current) setDraft(value ? formatCardioTime(value) : '')
  }, [value])

  const commit = () => {
    focused.current = false
    const seconds = parseCardioTime(draft)
    if (seconds === null) {
      setDraft(value ? formatCardioTime(value) : '')
      return
    }
    onChange(seconds)
    setDraft(seconds ? formatCardioTime(seconds) : '')
  }

  return (
    <label className="cardio-field">
      <span>DURATION</span>
      <span className="cardio-input-wrap">
        <input
          inputMode="numeric"
          value={draft}
          placeholder="mm:ss"
          onFocus={() => { focused.current = true }}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
          }}
          aria-label="Run duration in minutes and seconds"
        />
      </span>
    </label>
  )
}

export function CardioTracker({
  item,
  exercise,
  previous,
  distanceUnit,
  updateSet,
  toggleSet,
  addSet,
  removeSet,
}) {
  const normalizedUnit = normalizeDistanceUnit(distanceUnit)
  const previousCompleted = previous?.sets?.filter((set) => set.completed) || []

  return (
    <div className="cardio-tracker">
      {item.sets.map((set, index) => {
        const distanceKm = cardioSetDistanceKm(set)
        const pace = cardioSetPaceSecondsPerKm(set)
        const speed = cardioSetSpeedKph(set)
        const priorSet = previousCompleted[index]
        const previousLabel = priorSet
          ? `${formatCardioDistance(cardioSetDistanceKm(priorSet), normalizedUnit)} ${normalizedUnit} · ${formatCardioPace(cardioSetPaceSecondsPerKm(priorSet), normalizedUnit)}`
          : 'No previous split'

        return (
          <section className={`cardio-segment ${set.completed ? 'is-complete' : ''}`} key={set.id} data-set-id={set.id}>
            <header>
              <div>
                <span>{item.sets.length > 1 ? `SPLIT ${String(index + 1).padStart(2, '0')}` : 'RUN METRICS'}</span>
                <small>{previousLabel}</small>
              </div>
              {item.sets.length > 1 && !set.completed && (
                <button className="cardio-delete" onClick={() => removeSet(item.id, set.id)} aria-label={`Delete split ${index + 1}`}>
                  <Trash2 size={15} />
                </button>
              )}
            </header>

            <div className="cardio-fields">
              <MetricInput
                label="DISTANCE"
                suffix={normalizedUnit}
                step="0.01"
                value={set.distanceKm === '' || set.distanceKm == null
                  ? ''
                  : Math.round(distanceFromKilometers(set.distanceKm, normalizedUnit) * 1000) / 1000}
                onChange={(value) => updateSet(
                  item.id,
                  set.id,
                  'distanceKm',
                  value === '' ? '' : distanceToKilometers(value, normalizedUnit),
                )}
              />
              <DurationInput
                value={set.duration}
                onChange={(value) => updateSet(item.id, set.id, 'duration', value)}
              />
              <MetricInput
                label={exercise?.equipment === 'Machine' ? 'TREADMILL SPEED' : 'AVG SPEED'}
                suffix={`${normalizedUnit}/h`}
                step="0.1"
                value={set.speed === '' || set.speed == null
                  ? ''
                  : Math.round(distanceFromKilometers(set.speed, normalizedUnit) * 10) / 10}
                onChange={(value) => updateSet(
                  item.id,
                  set.id,
                  'speed',
                  value === '' ? '' : distanceToKilometers(value, normalizedUnit),
                )}
              />
              <MetricInput
                label="AVG INCLINE"
                suffix="%"
                step="0.5"
                max="30"
                value={set.incline}
                onChange={(value) => updateSet(item.id, set.id, 'incline', value)}
              />
              <MetricInput
                label="AVG HEART RATE"
                suffix="bpm"
                step="1"
                max="240"
                value={set.heartRate}
                onChange={(value) => updateSet(item.id, set.id, 'heartRate', value)}
              />
              <MetricInput
                label="CALORIES"
                suffix="kcal"
                step="1"
                value={set.calories}
                onChange={(value) => updateSet(item.id, set.id, 'calories', value)}
              />
              <MetricInput
                label="EFFORT"
                suffix="RPE"
                min="1"
                max="10"
                step="0.5"
                value={set.rpe}
                onChange={(value) => updateSet(item.id, set.id, 'rpe', value)}
              />
            </div>

            <div className="cardio-derived" aria-live="polite">
              <div><Route size={15} /><span>DISTANCE</span><strong>{distanceKm ? `${formatCardioDistance(distanceKm, normalizedUnit)} ${normalizedUnit}` : '—'}</strong></div>
              <div><TimerReset size={15} /><span>PACE</span><strong>{formatCardioPace(pace, normalizedUnit)}</strong></div>
              <div><Gauge size={15} /><span>AVG SPEED</span><strong>{formatCardioSpeed(speed, normalizedUnit)}</strong></div>
            </div>

            <button
              className={`cardio-complete ${set.completed ? 'is-complete' : ''}`}
              onClick={() => toggleSet(item.id, set.id)}
              disabled={!set.completed && distanceKm <= 0}
            >
              <Check size={17} strokeWidth={3} />
              {set.completed
                ? 'Split logged'
                : distanceKm <= 0
                  ? 'Add distance to log'
                  : item.sets.length > 1 ? 'Log split' : 'Log run'}
            </button>
          </section>
        )
      })}

      <button className="cardio-add-split" onClick={() => addSet(item.id)}>
        <Plus size={16} /> Add interval / split
      </button>

      <div className="cardio-guidance">
        <TrendingUp size={16} />
        <p>{exercise?.equipment === 'Machine'
          ? 'Enter distance + time for pace, or treadmill speed + time to calculate distance.'
          : 'Enter distance + time to calculate pace and average speed.'}</p>
        <HeartPulse size={16} />
      </div>
    </div>
  )
}
