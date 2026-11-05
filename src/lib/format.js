import { addedWeight, formatLoad } from './base-weight.js'
import {
  cardioSetDistanceKm,
  cardioSetPaceSecondsPerKm,
  formatCardioDistance,
  formatCardioPace,
  formatCardioTime,
} from './cardio.js'

export function formatDate(dateValue, options) {
  const date = new Date(dateValue)
  return new Intl.DateTimeFormat('en', options).format(date)
}

export function formatDuration(seconds) {
  const safeSeconds = Math.max(0, Math.floor(seconds || 0))
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  const remainingSeconds = safeSeconds % 60
  if (hours > 0) return String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0') + ':' + String(remainingSeconds).padStart(2, '0')
  return String(minutes).padStart(2, '0') + ':' + String(remainingSeconds).padStart(2, '0')
}

export function compactNumber(value) {
  return new Intl.NumberFormat('en', {
    notation: value >= 10000 ? 'compact' : 'standard',
    maximumFractionDigits: value >= 10000 ? 1 : 0,
  }).format(value || 0)
}

export function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

/**
 * Last time's set, written in the same terms as the input beside it. When an
 * exercise has a base weight, the row is about what you add, so the reference
 * has to be too — otherwise the column reintroduces exactly the arithmetic the
 * base weight removed. Sets store the total, so subtracting today's base is
 * what makes typing the number shown here repeat last time's load, whatever
 * base (if any) was in use back then.
 */
export function previousSetLabel(set, trackingType, baseWeight = 0) {
  if (!set) return '—'
  if (trackingType === 'duration') return set.duration ? set.duration + ' sec' : '—'
  const load = addedWeight(set.weight, baseWeight)
  if (trackingType === 'distance') {
    return (load === '' ? '—' : formatLoad(load)) + ' · ' + (set.distance || '—') + 'm'
  }
  return (load === '' ? '—' : formatLoad(load)) + '×' + String(set.reps ?? '—')
}

export function completedSetLabel(set, trackingType, unit, distanceUnit = 'km') {
  if (trackingType === 'duration') return (set.duration || 0) + ' seconds'
  if (trackingType === 'distance') {
    return (set.weight || 0) + ' ' + unit + ' · ' + (set.distance || 0) + ' m'
  }
  if (trackingType === 'cardio') {
    return `${formatCardioDistance(cardioSetDistanceKm(set), distanceUnit)} ${distanceUnit} · ${formatCardioTime(set.duration)} · ${formatCardioPace(cardioSetPaceSecondsPerKm(set), distanceUnit)}`
  }
  return (set.weight || 'BW') + (set.weight ? ' ' + unit : '') + ' × ' + (set.reps || 0)
}
