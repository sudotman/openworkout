import { useEffect, useMemo, useState } from 'react'
import {
  Calculator,
  Check,
  CircleDot,
  Flame,
  Minus,
  OctagonAlert,
  Plus,
  RotateCcw,
  Target,
  Trash2,
  TrendingDown,
  X,
} from 'lucide-react'
import '../workout-tools.css'

const UNIT_PRESETS = {
  kg: {
    bar: 20,
    target: 100,
    working: 100,
    increment: 2.5,
    plates: [
      { weight: 25, count: 2 },
      { weight: 20, count: 4 },
      { weight: 15, count: 2 },
      { weight: 10, count: 2 },
      { weight: 5, count: 2 },
      { weight: 2.5, count: 2 },
      { weight: 1.25, count: 2 },
    ],
  },
  lb: {
    bar: 45,
    target: 225,
    working: 225,
    increment: 5,
    plates: [
      { weight: 45, count: 4 },
      { weight: 35, count: 2 },
      { weight: 25, count: 2 },
      { weight: 10, count: 2 },
      { weight: 5, count: 2 },
      { weight: 2.5, count: 2 },
    ],
  },
}

const WARMUP_SCHEME = [
  { percent: 40, reps: 10, label: 'Ease in' },
  { percent: 60, reps: 6, label: 'Build' },
  { percent: 75, reps: 3, label: 'Prime' },
  { percent: 90, reps: 1, label: 'Ready' },
]

const SET_TYPES = [
  {
    id: 'normal',
    label: 'Normal',
    description: 'Your standard working set',
    icon: CircleDot,
  },
  {
    id: 'warmup',
    label: 'Warm-up',
    description: 'A lighter set to prepare',
    icon: Flame,
  },
  {
    id: 'drop',
    label: 'Drop',
    description: 'Reduced load after a hard set',
    icon: TrendingDown,
  },
  {
    id: 'failure',
    label: 'Failure',
    description: 'Taken to technical failure',
    icon: OctagonAlert,
  },
]

function toNumber(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

function formatWeight(value) {
  return new Intl.NumberFormat('en', {
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0)
}

function roundTo(value, increment) {
  return Math.round((value + Number.EPSILON) / increment) * increment
}

function greatestCommonDivisor(a, b) {
  let left = Math.abs(a)
  let right = Math.abs(b)
  while (right) {
    const next = left % right
    left = right
    right = next
  }
  return left || 1
}

function clonePlatePreset(unit) {
  return UNIT_PRESETS[unit].plates.map((plate) => ({ ...plate }))
}

function calculatePlateLoad(targetValue, barValue, inventory) {
  const target = toNumber(targetValue)
  const bar = toNumber(barValue)
  const desiredPerSide = Math.max(0, (target - bar) / 2)
  const activePlates = inventory
    .filter((plate) => plate.count > 0 && plate.weight > 0)
    .slice()
    .sort((left, right) => right.weight - left.weight)

  if (activePlates.length === 0) {
    return {
      achieved: bar,
      difference: bar - target,
      exact: Math.abs(bar - target) < 0.001,
      perSide: 0,
      plates: [],
    }
  }

  const scaledWeights = activePlates.map((plate) => Math.round(plate.weight * 100))
  const divisor = scaledWeights.reduce(greatestCommonDivisor)
  const weights = scaledWeights.map((weight) => weight / divisor)
  const desired = (desiredPerSide * 100) / divisor

  let states = new Map([[0, new Array(activePlates.length).fill(0)]])

  activePlates.forEach((plate, plateIndex) => {
    const nextStates = new Map(states)
    const previousStates = Array.from(states.entries())

    previousStates.forEach(([loadedWeight, combination]) => {
      for (let quantity = 1; quantity <= plate.count; quantity += 1) {
        const nextWeight = loadedWeight + weights[plateIndex] * quantity
        if (nextStates.has(nextWeight)) continue
        const nextCombination = combination.slice()
        nextCombination[plateIndex] = quantity
        nextStates.set(nextWeight, nextCombination)
      }
    })

    states = nextStates
  })

  let bestWeight = 0
  let bestCombination = states.get(0)
  let bestDistance = Math.abs(desired)

  states.forEach((combination, loadedWeight) => {
    const distance = Math.abs(loadedWeight - desired)
    const equallyClose = Math.abs(distance - bestDistance) < 0.0001
    const isBelow = loadedWeight <= desired
    const bestIsAbove = bestWeight > desired
    const fewerPlates = combination.reduce((sum, count) => sum + count, 0)
      < bestCombination.reduce((sum, count) => sum + count, 0)

    if (
      distance < bestDistance - 0.0001
      || (equallyClose && isBelow && bestIsAbove)
      || (equallyClose && isBelow === !bestIsAbove && fewerPlates)
    ) {
      bestWeight = loadedWeight
      bestCombination = combination
      bestDistance = distance
    }
  })

  const perSide = (bestWeight * divisor) / 100
  const achieved = bar + perSide * 2
  const difference = achieved - target
  const plates = activePlates
    .map((plate, index) => ({ ...plate, count: bestCombination[index] }))
    .filter((plate) => plate.count > 0)

  return {
    achieved,
    difference,
    exact: Math.abs(difference) < 0.001,
    perSide,
    plates,
  }
}

function NumericField({ id, label, note, value, onChange, unit, step }) {
  return (
    <div className="wt-field">
      <div className="wt-field-copy">
        <label htmlFor={id}>{label}</label>
        {note && <span>{note}</span>}
      </div>
      <div className="wt-input-wrap">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min="0"
          step={step}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <span>{unit}</span>
      </div>
    </div>
  )
}

function ToolHeader({ onClose }) {
  return (
    <header className="wt-header">
      <div>
        <span className="wt-kicker">LIFTING UTILITIES</span>
        <h2>Workout tools</h2>
      </div>
      {onClose && (
        <button className="wt-close" type="button" onClick={onClose} aria-label="Close workout tools">
          <X size={20} />
        </button>
      )}
    </header>
  )
}

function PlateInventory({ plates, unit, onAdjust, onReset }) {
  return (
    <section className="wt-inventory" aria-labelledby="wt-inventory-title">
      <div className="wt-section-head">
        <div>
          <h3 id="wt-inventory-title">Available plate pairs</h3>
          <p>Set how many matching pairs are on your rack.</p>
        </div>
        <button className="wt-reset" type="button" onClick={onReset}>
          <RotateCcw size={14} /> Reset
        </button>
      </div>

      <div className="wt-inventory-scroller">
        {plates.map((plate) => (
          <div className={'wt-plate-control ' + (plate.count > 0 ? 'wt-plate-control-active' : '')} key={plate.weight}>
            <span className="wt-plate-label">
              <strong>{formatWeight(plate.weight)}</strong>
              <small>{unit} pair</small>
            </span>
            <span className="wt-stepper">
              <button
                type="button"
                onClick={() => onAdjust(plate.weight, -1)}
                disabled={plate.count === 0}
                aria-label={'Remove one ' + formatWeight(plate.weight) + ' ' + unit + ' plate pair'}
              >
                <Minus size={14} />
              </button>
              <b aria-label={plate.count + ' pairs'}>{plate.count}</b>
              <button
                type="button"
                onClick={() => onAdjust(plate.weight, 1)}
                disabled={plate.count >= 8}
                aria-label={'Add one ' + formatWeight(plate.weight) + ' ' + unit + ' plate pair'}
              >
                <Plus size={14} />
              </button>
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}

function PlateResult({ result, bar, target, unit }) {
  const maxPlate = result.plates[0]?.weight || 1
  const visualPlates = result.plates.flatMap((plate) =>
    Array.from({ length: plate.count }, (_, index) => ({
      key: plate.weight + '-' + index,
      weight: plate.weight,
    })),
  )

  let resultNote = 'Exact match'
  if (!result.exact) {
    resultNote = formatWeight(Math.abs(result.difference)) + ' ' + unit + (result.difference > 0 ? ' over' : ' under')
  }

  return (
    <section className="wt-result" aria-live="polite">
      <div className="wt-result-topline">
        <span>NEAREST LOAD</span>
        <span className={'wt-result-badge ' + (result.exact ? 'wt-result-badge-exact' : '')}>
          {result.exact && <Check size={12} />}
          {resultNote}
        </span>
      </div>

      <div className="wt-result-number">
        <strong>{formatWeight(result.achieved)}</strong>
        <span>{unit}</span>
      </div>

      <div className="wt-bar-visual" aria-label={'Load ' + formatWeight(result.perSide) + ' ' + unit + ' on each side'}>
        <span className="wt-bar-end" />
        <span className="wt-bar-collar" />
        <span className="wt-bar-sleeve" />
        <span className="wt-bar-plates">
          {visualPlates.map((plate) => (
            <i
              className="wt-visual-plate"
              key={plate.key}
              title={formatWeight(plate.weight) + ' ' + unit}
              style={{ '--wt-plate-height': 34 + Math.round((plate.weight / maxPlate) * 38) + 'px' }}
            />
          ))}
        </span>
      </div>

      <div className="wt-load-equation" aria-label="Load breakdown">
        <span><small>BAR</small><strong>{formatWeight(toNumber(bar))} {unit}</strong></span>
        <i>+</i>
        <span><small>EACH SIDE</small><strong>{formatWeight(result.perSide)} {unit}</strong></span>
      </div>

      <div className="wt-breakdown">
        <span>Per side</span>
        <div>
          {result.plates.length ? result.plates.map((plate) => (
            <span className="wt-breakdown-chip" key={plate.weight}>
              {formatWeight(plate.weight)} <small>× {plate.count}</small>
            </span>
          )) : (
            <span className="wt-empty-load">Empty bar</span>
          )}
        </div>
      </div>

      {toNumber(target) < toNumber(bar) && (
        <p className="wt-result-warning">The target is lighter than the selected bar, so the empty bar is the closest load.</p>
      )}
    </section>
  )
}

function PlateCalculator({ unit, preset }) {
  const [target, setTarget] = useState(String(preset.target))
  const [bar, setBar] = useState(String(preset.bar))
  const [plates, setPlates] = useState(() => clonePlatePreset(unit))

  useEffect(() => {
    setTarget(String(preset.target))
    setBar(String(preset.bar))
    setPlates(clonePlatePreset(unit))
  }, [preset, unit])

  const result = useMemo(() => calculatePlateLoad(target, bar, plates), [bar, plates, target])

  const adjustPlate = (weight, direction) => {
    setPlates((current) => current.map((plate) => (
      plate.weight === weight
        ? { ...plate, count: Math.max(0, Math.min(8, plate.count + direction)) }
        : plate
    )))
  }

  return (
    <div className="wt-panel wt-plate-panel" role="tabpanel" id="wt-panel-plates" aria-labelledby="wt-tab-plates">
      <div className="wt-intro">
        <h3>Load the bar without the guesswork.</h3>
        <p>Enter the total weight, then match the plates shown for one side.</p>
      </div>

      <div className="wt-field-grid">
        <NumericField
          id="wt-target-weight"
          label="Target total"
          note="Including the bar"
          value={target}
          onChange={setTarget}
          unit={unit}
          step={preset.increment}
        />
        <NumericField
          id="wt-bar-weight"
          label="Bar weight"
          note="Change for specialty bars"
          value={bar}
          onChange={setBar}
          unit={unit}
          step={preset.increment}
        />
      </div>

      <PlateInventory
        plates={plates}
        unit={unit}
        onAdjust={adjustPlate}
        onReset={() => setPlates(clonePlatePreset(unit))}
      />

      <PlateResult result={result} bar={bar} target={target} unit={unit} />
    </div>
  )
}

function WarmupCalculator({ unit, preset }) {
  const [workingWeight, setWorkingWeight] = useState(String(preset.working))

  useEffect(() => {
    setWorkingWeight(String(preset.working))
  }, [preset])

  const working = toNumber(workingWeight)
  const sets = useMemo(() => WARMUP_SCHEME.map((set) => ({
    ...set,
    weight: roundTo(working * (set.percent / 100), preset.increment),
  })), [preset.increment, working])

  const nudgeWorkingWeight = (direction) => {
    setWorkingWeight(String(Math.max(0, roundTo(working + preset.increment * direction, preset.increment))))
  }

  return (
    <div className="wt-panel wt-warmup-panel" role="tabpanel" id="wt-panel-warmup" aria-labelledby="wt-tab-warmup">
      <div className="wt-intro">
        <h3>Arrive ready, not fatigued.</h3>
        <p>A four-set ramp toward your first working set.</p>
      </div>

      <div className="wt-working-control">
        <NumericField
          id="wt-working-weight"
          label="Working weight"
          note={'Rounded to ' + formatWeight(preset.increment) + ' ' + unit}
          value={workingWeight}
          onChange={setWorkingWeight}
          unit={unit}
          step={preset.increment}
        />
        <div className="wt-working-stepper" aria-label="Adjust working weight">
          <button type="button" onClick={() => nudgeWorkingWeight(-1)} aria-label={'Decrease by ' + preset.increment + ' ' + unit}>
            <Minus size={17} />
          </button>
          <span>{formatWeight(preset.increment)} {unit}</span>
          <button type="button" onClick={() => nudgeWorkingWeight(1)} aria-label={'Increase by ' + preset.increment + ' ' + unit}>
            <Plus size={17} />
          </button>
        </div>
      </div>

      <section className="wt-ramp" aria-labelledby="wt-ramp-title" aria-live="polite">
        <div className="wt-section-head wt-ramp-head">
          <div>
            <h3 id="wt-ramp-title">Your ramp</h3>
            <p>Keep every rep fast and controlled.</p>
          </div>
          <span className="wt-ramp-count">4 SETS</span>
        </div>

        <ol className="wt-warmup-list">
          {sets.map((set, index) => (
            <li className="wt-warmup-row" key={set.percent}>
              <span className="wt-warmup-index">{String(index + 1).padStart(2, '0')}</span>
              <span className="wt-warmup-progress" aria-hidden="true">
                <i style={{ '--wt-ramp-width': set.percent + '%' }} />
              </span>
              <span className="wt-warmup-copy">
                <small>{set.percent}% · {set.label}</small>
                <strong>{formatWeight(set.weight)} <em>{unit}</em></strong>
              </span>
              <span className="wt-warmup-reps">
                <strong>{set.reps}</strong>
                <small>REPS</small>
              </span>
            </li>
          ))}
        </ol>

        <div className="wt-working-destination">
          <span><Target size={16} /> WORKING SET</span>
          <strong>{formatWeight(working)} <small>{unit}</small></strong>
        </div>
      </section>
    </div>
  )
}

export function WorkoutTools({ unit = 'kg', onClose }) {
  const normalizedUnit = unit === 'lb' ? 'lb' : 'kg'
  const preset = UNIT_PRESETS[normalizedUnit]
  const [activeTool, setActiveTool] = useState('plates')

  return (
    <section className="wt-tools" aria-label="Workout tools">
      <ToolHeader onClose={onClose} />

      <div className="wt-tabs" role="tablist" aria-label="Choose a workout tool">
        <button
          id="wt-tab-plates"
          type="button"
          role="tab"
          aria-selected={activeTool === 'plates'}
          aria-controls="wt-panel-plates"
          onClick={() => setActiveTool('plates')}
        >
          <Calculator size={17} />
          Plate calculator
        </button>
        <button
          id="wt-tab-warmup"
          type="button"
          role="tab"
          aria-selected={activeTool === 'warmup'}
          aria-controls="wt-panel-warmup"
          onClick={() => setActiveTool('warmup')}
        >
          <Flame size={17} />
          Warm-up sets
        </button>
      </div>

      {activeTool === 'plates'
        ? <PlateCalculator unit={normalizedUnit} preset={preset} />
        : <WarmupCalculator unit={normalizedUnit} preset={preset} />}
    </section>
  )
}

function normalizeSetType(type) {
  const normalized = String(type || 'normal').toLowerCase().replace(/[^a-z]/g, '')
  if (normalized === 'warmup') return 'warmup'
  if (normalized === 'drop' || normalized === 'dropset') return 'drop'
  if (normalized === 'failure' || normalized === 'failed') return 'failure'
  return 'normal'
}

export function SetOptions({ set, onChangeType, onDelete, onClose }) {
  const activeType = normalizeSetType(set?.type)
  const setNumber = set?.number ?? (Number.isFinite(set?.index) ? set.index + 1 : null)

  const chooseType = (type) => {
    onChangeType?.(type)
    onClose?.()
  }

  const deleteSet = () => {
    onDelete?.()
    onClose?.()
  }

  return (
    <section className="wt-set-options" aria-label="Set options">
      <header className="wt-header wt-set-header">
        <div>
          <span className="wt-kicker">{setNumber ? 'SET ' + setNumber : 'WORKOUT SET'}</span>
          <h2>Set type</h2>
          <p>Mark the intent so your log reads clearly later.</p>
        </div>
        {onClose && (
          <button className="wt-close" type="button" onClick={onClose} aria-label="Close set options">
            <X size={20} />
          </button>
        )}
      </header>

      <div className="wt-type-list">
        {SET_TYPES.map((type) => {
          const Icon = type.icon
          const selected = activeType === type.id
          return (
            <button
              className={'wt-type-row ' + (selected ? 'wt-type-row-active' : '')}
              type="button"
              key={type.id}
              aria-pressed={selected}
              onClick={() => chooseType(type.id)}
            >
              <span className="wt-type-icon"><Icon size={19} /></span>
              <span className="wt-type-copy">
                <strong>{type.label}</strong>
                <small>{type.description}</small>
              </span>
              <span className="wt-type-check" aria-hidden="true">
                {selected && <Check size={16} strokeWidth={3} />}
              </span>
            </button>
          )
        })}
      </div>

      <button className="wt-delete-set" type="button" onClick={deleteSet}>
        <Trash2 size={17} />
        Delete set
      </button>
    </section>
  )
}
