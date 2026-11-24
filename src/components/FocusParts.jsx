import { Minus, Plus } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { fraction } from '../lib/focus.js'

const RING_RADII = [88, 72, 56]

function round(value) {
  return Math.round(value * 100) / 100
}

/**
 * Three concentric rings. While resting, the outer ring becomes the countdown
 * and the other two step back, so the one number that matters right then is
 * the one you see.
 *
 * @param {{ rings: Array<{ tone: string, value: number }>, rest?: { remaining: number, total: number } | null, children?: import('react').ReactNode }} props
 */
export function FocusRings({ rings, rest, children }) {
  const restProgress = rest ? fraction(rest.remaining, rest.total) : 0
  return (
    <div className={'focus-rings' + (rest ? ' is-resting' : '')}>
      <svg viewBox="0 0 200 200" aria-hidden="true">
        {RING_RADII.map((radius, index) => {
          const ring = rings[index]
          const isRestRing = rest && index === 0
          const value = isRestRing ? restProgress : ring.value
          return (
            <g key={radius} className={'focus-ring focus-ring--' + (isRestRing ? 'rest' : ring.tone)}>
              <circle className="focus-ring-track" cx="100" cy="100" r={radius} />
              <circle
                className="focus-ring-fill"
                cx="100"
                cy="100"
                r={radius}
                pathLength="1"
                style={{ strokeDasharray: value + ' 1', opacity: value > 0 ? 1 : 0 }}
              />
            </g>
          )
        })}
      </svg>
      <div className="focus-rings-center">{children}</div>
    </div>
  )
}

/**
 * The three numbers behind the rings, each keyed to its ring's colour.
 *
 * @param {{ items: Array<{ label: string, value: string, tone?: string }> }} props
 */
export function FocusLegend({ items }) {
  return (
    <dl className="focus-legend">
      {items.map((entry) => (
        <div key={entry.label} className={entry.tone ? 'focus-legend--' + entry.tone : 'focus-legend--plain'}>
          <dt>{entry.label}</dt>
          <dd>{entry.value}</dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * A big number with a minus and plus either side. Holding a button repeats it;
 * the number itself is a field, so a big jump is one tap and a keyboard away.
 */
export function Stepper({ label, value, step, min = 0, max, onChange, inputMode = 'decimal', ariaLabel }) {
  const latest = useRef(value)
  const hold = useRef({ timer: null, repeated: false })

  useEffect(() => {
    latest.current = value
  }, [value])

  useEffect(() => () => window.clearTimeout(hold.current.timer), [])

  const bump = (direction) => {
    const current = Number(latest.current) || 0
    let next = Math.max(min, round(current + direction * step))
    if (max != null) next = Math.min(max, next)
    latest.current = next
    onChange(next)
  }

  const stop = () => {
    window.clearTimeout(hold.current.timer)
    hold.current.timer = null
  }

  const start = (direction) => {
    stop()
    hold.current.repeated = false
    const repeat = (delay) => {
      hold.current.timer = window.setTimeout(() => {
        hold.current.repeated = true
        bump(direction)
        repeat(70)
      }, delay)
    }
    repeat(380)
  }

  // A hold has already stepped; the click that ends it must not step again.
  // Keyboard presses arrive as a click with no hold, and step once.
  const click = (direction) => {
    if (hold.current.repeated) {
      hold.current.repeated = false
      return
    }
    bump(direction)
  }

  const handlers = (direction) => ({
    onPointerDown: () => start(direction),
    onPointerUp: stop,
    onPointerLeave: stop,
    onPointerCancel: stop,
    onContextMenu: (event) => event.preventDefault(),
    onClick: () => click(direction),
  })

  return (
    <div className="focus-stepper">
      <button type="button" aria-label={'Decrease ' + label.toLowerCase()} {...handlers(-1)}>
        <Minus size={22} strokeWidth={2.4} />
      </button>
      <label>
        <input
          type="number"
          inputMode={inputMode}
          min={min}
          max={max}
          step={step}
          value={value ?? ''}
          placeholder="0"
          aria-label={ariaLabel || label}
          onFocus={(event) => event.target.select()}
          onChange={(event) => onChange(event.target.value === '' ? '' : Number(event.target.value))}
        />
        <span>{label}</span>
      </label>
      <button type="button" aria-label={'Increase ' + label.toLowerCase()} {...handlers(1)}>
        <Plus size={22} strokeWidth={2.4} />
      </button>
    </div>
  )
}
