import {
  cardioSetPaceSecondsPerKm,
  formatCardioDistance,
  formatCardioPace,
  formatCardioSpeed,
  formatCardioTime,
  getCardioSummary,
  isCardioExercise,
} from './cardio.js'

const CARD_WIDTH = 1080
const CARD_HEIGHT = 1920
const PAPER = '#f3efe5'
const INK = '#171713'
const MUTED = '#766f62'
const RULE = '#aaa191'
const ACCENT = '#cf4433'
const MAX_VISIBLE_MOVEMENTS = 4
const KM_PER_MILE = 1.609344

function fitFontSize(context, text, maxWidth, startSize, minimumSize = 32, weight = 760) {
  let size = startSize
  while (size > minimumSize) {
    context.font = `${weight} ${size}px Manrope, sans-serif`
    if (context.measureText(String(text)).width <= maxWidth) break
    size -= 2
  }
  return size
}

function truncateText(context, text, maxWidth) {
  const value = String(text || '')
  if (context.measureText(value).width <= maxWidth) return value
  let visible = value
  while (visible.length > 1 && context.measureText(`${visible}…`).width > maxWidth) {
    visible = visible.slice(0, -1).trim()
  }
  return `${visible}…`
}

function wrapText(context, text, maxWidth, maxLines = 2) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean)
  const lines = []
  let line = ''

  words.forEach((word) => {
    const candidate = line ? `${line} ${word}` : word
    if (!line || context.measureText(candidate).width <= maxWidth) {
      line = candidate
      return
    }
    lines.push(line)
    line = word
  })
  if (line) lines.push(line)

  if (lines.length <= maxLines) return lines
  const visible = lines.slice(0, maxLines)
  visible[maxLines - 1] = truncateText(context, lines.slice(maxLines - 1).join(' '), maxWidth)
  return visible
}

function formatDate(dateValue) {
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return 'TODAY'
  return new Intl.DateTimeFormat('en', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date).toUpperCase()
}

function formatDuration(seconds) {
  const totalMinutes = Math.max(1, Math.round(Number(seconds || 0) / 60))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (!hours) return `${totalMinutes} MIN`
  if (!minutes) return `${hours} HR`
  return `${hours}H ${String(minutes).padStart(2, '0')}M`
}

function formatVolume(value) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.round(value || 0))
}

function formatPaceTick(seconds) {
  const rounded = Math.max(0, Math.round(Number(seconds) || 0))
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')}`
}

function drawRule(context, x1, y, x2, color = INK, width = 2) {
  context.save()
  context.strokeStyle = color
  context.lineWidth = width
  context.beginPath()
  context.moveTo(x1, y)
  context.lineTo(x2, y)
  context.stroke()
  context.restore()
}

function drawPaper(context) {
  context.fillStyle = PAPER
  context.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT)

  let seed = 31
  context.fillStyle = 'rgba(91, 82, 67, 0.11)'
  for (let index = 0; index < 1800; index += 1) {
    seed = (seed * 9301 + 49297) % 233280
    const x = (seed / 233280) * CARD_WIDTH
    seed = (seed * 9301 + 49297) % 233280
    const y = (seed / 233280) * CARD_HEIGHT
    context.fillRect(Math.round(x), Math.round(y), 1.25, 1.25)
  }
}

function buildCardData(workout, unit, distanceUnit, exerciseMap) {
  const completedExercises = (workout?.exercises || []).flatMap((item) => {
    const exercise = exerciseMap?.get?.(item.exerciseId)
    const cardio = isCardioExercise(exercise)
    const completedSets = (item.sets || []).filter((set) => set.completed)
    const countedSets = cardio
      ? completedSets
      : completedSets.filter((set) => set.type !== 'warmup')
    if (!countedSets.length) return []

    const volume = cardio ? 0 : countedSets.reduce(
      (total, set) => total + (Number(set.weight) || 0) * (Number(set.reps) || 0),
      0,
    )
    return [{
      name: exercise?.name || 'Exercise',
      setCount: countedSets.length,
      cardio,
      volume,
    }]
  })

  const strengthExercises = completedExercises.filter((item) => !item.cardio)
  const cardioExercises = completedExercises.filter((item) => item.cardio)
  const strengthSets = strengthExercises.reduce((total, item) => total + item.setCount, 0)
  const volume = strengthExercises.reduce((total, item) => total + item.volume, 0)
  const cardio = getCardioSummary(workout, exerciseMap)
  const hasCardio = cardio.entries.length > 0
  const hasStrength = strengthSets > 0
  const mode = hasCardio && hasStrength ? 'hybrid' : hasCardio ? 'cardio' : 'strength'

  return {
    title: String(workout?.name || 'Workout').trim().toUpperCase(),
    date: formatDate(workout?.completedAt || workout?.startedAt),
    duration: formatDuration(workout?.durationSeconds),
    volume,
    unit: unit || 'kg',
    distanceUnit: distanceUnit === 'mi' ? 'mi' : 'km',
    exercises: completedExercises,
    strengthExercises,
    cardioExercises,
    strengthSets,
    cardio,
    mode,
  }
}

function drawHeader(context, data) {
  context.fillStyle = INK
  context.font = '760 30px Manrope, sans-serif'
  context.fillText('OPENWORKOUT', 80, 112)

  context.fillStyle = MUTED
  context.font = '500 20px "DM Mono", monospace'
  context.textAlign = 'right'
  context.fillText(data.date, 1000, 104)
  context.fillText(data.mode.toUpperCase(), 1000, 132)
  context.textAlign = 'left'
  drawRule(context, 80, 164, 1000)
}

function drawTitle(context, title) {
  context.fillStyle = INK
  context.font = '760 100px Manrope, sans-serif'
  const lines = wrapText(context, title, 920, 2)
  lines.forEach((line, index) => context.fillText(line, 78, 285 + index * 92))
  return Math.max(390, 302 + lines.length * 92)
}

function drawMetric(context, { label, value, unit }, x, y, width, size = 150) {
  context.fillStyle = MUTED
  context.font = '500 20px "DM Mono", monospace'
  context.fillText(label, x, y)

  const valueSize = fitFontSize(context, value, width - 88, size, 70, 760)
  context.fillStyle = INK
  context.font = `760 ${valueSize}px Manrope, sans-serif`
  context.fillText(value, x - 5, y + 145)
  const valueWidth = context.measureText(value).width
  context.fillStyle = ACCENT
  context.font = '500 29px "DM Mono", monospace'
  context.fillText(unit, Math.min(x + width - 62, x + valueWidth + 10), y + 136)
}

function drawHero(context, data, top) {
  const hasVolume = data.volume > 0
  if (data.mode === 'hybrid') {
    drawMetric(context, {
      label: 'RUN DISTANCE',
      value: formatCardioDistance(data.cardio.distanceKm, data.distanceUnit),
      unit: data.distanceUnit.toUpperCase(),
    }, 80, top, 420, 112)

    context.strokeStyle = INK
    context.lineWidth = 2
    context.beginPath()
    context.moveTo(540, top - 10)
    context.lineTo(540, top + 158)
    context.stroke()

    drawMetric(context, {
      label: hasVolume ? 'LIFT VOLUME' : 'LIFT WORK',
      value: hasVolume ? formatVolume(data.volume) : String(data.strengthSets),
      unit: hasVolume ? data.unit.toUpperCase() : data.strengthSets === 1 ? 'SET' : 'SETS',
    }, 580, top, 420, 112)
  } else if (data.mode === 'cardio') {
    drawMetric(context, {
      label: 'DISTANCE',
      value: formatCardioDistance(data.cardio.distanceKm, data.distanceUnit),
      unit: data.distanceUnit.toUpperCase(),
    }, 80, top, 920)
  } else {
    drawMetric(context, {
      label: hasVolume ? 'TOTAL VOLUME' : 'COMPLETED WORK',
      value: hasVolume ? formatVolume(data.volume) : String(data.strengthSets),
      unit: hasVolume ? data.unit.toUpperCase() : data.strengthSets === 1 ? 'SET' : 'SETS',
    }, 80, top, 920)
  }
  return top + 184
}

function strengthPlotValues(data) {
  const usesVolume = data.strengthExercises.some((item) => item.volume > 0)
  return {
    usesVolume,
    entries: data.strengthExercises.slice(0, MAX_VISIBLE_MOVEMENTS).map((item) => ({
      label: item.name,
      value: usesVolume ? item.volume : item.setCount,
    })),
  }
}

function drawBarChart(context, entries, x, y, width, height, usesVolume) {
  if (!entries.length) {
    context.fillStyle = MUTED
    context.font = '500 20px "DM Mono", monospace'
    context.fillText('NO LIFTING DATA LOGGED', x, y + height / 2)
    return
  }

  const maxValue = Math.max(...entries.map((item) => item.value), 1)
  const baseline = y + height - 42
  const availableHeight = height - 74
  const slot = width / entries.length
  drawRule(context, x, baseline, x + width, RULE, 1.5)

  entries.forEach((entry, index) => {
    const barWidth = Math.min(112, slot * 0.5)
    const barHeight = Math.max(18, (entry.value / maxValue) * availableHeight)
    const barX = x + index * slot + (slot - barWidth) / 2
    const barY = baseline - barHeight
    context.fillStyle = INK
    context.fillRect(barX, barY, barWidth, barHeight)

    context.fillStyle = INK
    context.font = '500 18px "DM Mono", monospace'
    context.textAlign = 'center'
    context.fillText(usesVolume ? formatVolume(entry.value) : String(entry.value), barX + barWidth / 2, barY - 12)

    context.fillStyle = MUTED
    context.font = '500 17px "DM Mono", monospace'
    const shortLabel = truncateText(context, entry.label.toUpperCase(), slot - 16)
    context.fillText(shortLabel, x + index * slot + slot / 2, baseline + 30)
  })
  context.textAlign = 'left'
}

function cardioPaces(data) {
  const factor = data.distanceUnit === 'mi' ? KM_PER_MILE : 1
  return data.cardio.entries
    .map((entry) => cardioSetPaceSecondsPerKm(entry.set) * factor)
    .filter((pace) => Number.isFinite(pace) && pace > 0)
}

function drawPaceChart(context, paces, x, y, width, height) {
  if (!paces.length) {
    context.fillStyle = MUTED
    context.font = '500 20px "DM Mono", monospace'
    context.fillText('PACE DATA NOT LOGGED', x, y + height / 2)
    return
  }

  const minimum = Math.min(...paces)
  const maximum = Math.max(...paces)
  const padding = Math.max(5, (maximum - minimum) * 0.18)
  const low = minimum - padding
  const high = maximum + padding
  const left = x + 86
  const right = x + width
  const top = y + 15
  const bottom = y + height - 44
  const range = Math.max(1, high - low)

  ;[low, (low + high) / 2, high].forEach((value) => {
    const lineY = top + ((value - low) / range) * (bottom - top)
    drawRule(context, left, lineY, right, RULE, 1.2)
    context.fillStyle = MUTED
    context.font = '500 17px "DM Mono", monospace'
    context.fillText(formatPaceTick(value), x, lineY + 6)
  })

  const points = paces.map((pace, index) => ({
    x: paces.length === 1 ? (left + right) / 2 : left + index * (right - left) / (paces.length - 1),
    y: top + ((pace - low) / range) * (bottom - top),
  }))

  context.strokeStyle = ACCENT
  context.lineWidth = 4
  context.beginPath()
  points.forEach((point, index) => {
    if (!index) context.moveTo(point.x, point.y)
    else context.lineTo(point.x, point.y)
  })
  context.stroke()

  const labelEvery = Math.max(1, Math.ceil(points.length / 7))
  points.forEach((point, index) => {
    context.fillStyle = PAPER
    context.strokeStyle = ACCENT
    context.lineWidth = 3
    context.beginPath()
    context.arc(point.x, point.y, 8, 0, Math.PI * 2)
    context.fill()
    context.stroke()

    if (index % labelEvery === 0 || index === points.length - 1) {
      context.fillStyle = MUTED
      context.font = '500 16px "DM Mono", monospace'
      context.textAlign = 'center'
      context.fillText(`S${index + 1}`, point.x, bottom + 32)
    }
  })
  context.textAlign = 'left'
}

function drawChartHeader(context, label, value, y) {
  context.fillStyle = MUTED
  context.font = '500 18px "DM Mono", monospace'
  context.fillText(label, 80, y)
  context.fillStyle = ACCENT
  context.textAlign = 'right'
  context.fillText(value, 1000, y)
  context.textAlign = 'left'
}

function drawPerformancePlot(context, data, top) {
  drawRule(context, 80, top, 1000)
  if (data.mode === 'hybrid') {
    drawChartHeader(context, 'RUN · PACE BY SPLIT', `MIN / ${data.distanceUnit.toUpperCase()}`, top + 38)
    drawPaceChart(context, cardioPaces(data), 80, top + 56, 920, 155)
    drawRule(context, 80, top + 226, 1000, RULE, 1.5)
    const strength = strengthPlotValues(data)
    drawChartHeader(context, 'LIFT · VOLUME BY MOVEMENT', strength.usesVolume ? data.unit.toUpperCase() : 'SETS', top + 262)
    drawBarChart(context, strength.entries, 80, top + 276, 920, 158, strength.usesVolume)
    drawRule(context, 80, top + 456, 1000)
    return top + 456
  }

  if (data.mode === 'cardio') {
    drawChartHeader(context, 'PACE BY SPLIT', `MIN / ${data.distanceUnit.toUpperCase()}`, top + 38)
    drawPaceChart(context, cardioPaces(data), 80, top + 64, 920, 292)
  } else {
    const strength = strengthPlotValues(data)
    drawChartHeader(context, strength.usesVolume ? 'VOLUME BY MOVEMENT' : 'SETS BY MOVEMENT', strength.usesVolume ? data.unit.toUpperCase() : 'SETS', top + 38)
    drawBarChart(context, strength.entries, 80, top + 60, 920, 300, strength.usesVolume)
  }
  drawRule(context, 80, top + 382, 1000)
  return top + 382
}

function drawFacts(context, data, top) {
  const facts = data.mode === 'hybrid'
    ? [
        ['DURATION', data.duration],
        ['RUN PACE', formatCardioPace(data.cardio.paceSecondsPerKm, data.distanceUnit)],
        ['LIFT SETS', String(data.strengthSets)],
      ]
    : data.mode === 'cardio'
      ? [
          ['RUN TIME', formatCardioTime(data.cardio.totalDurationSeconds)],
          ['AVG PACE', formatCardioPace(data.cardio.paceSecondsPerKm, data.distanceUnit)],
          ['AVG SPEED', formatCardioSpeed(data.cardio.averageSpeedKph, data.distanceUnit)],
        ]
      : [
          ['DURATION', data.duration],
          ['WORK SETS', String(data.strengthSets)],
          ['MOVEMENTS', String(data.strengthExercises.length)],
        ]

  const cellWidth = 920 / 3
  facts.forEach(([label, value], index) => {
    const x = 80 + index * cellWidth
    if (index) {
      context.strokeStyle = RULE
      context.lineWidth = 1.5
      context.beginPath()
      context.moveTo(x, top + 5)
      context.lineTo(x, top + 96)
      context.stroke()
    }
    context.fillStyle = MUTED
    context.font = '500 17px "DM Mono", monospace'
    context.fillText(label, x + (index ? 22 : 0), top + 27)
    context.fillStyle = INK
    context.font = '700 35px Manrope, sans-serif'
    context.fillText(value, x + (index ? 22 : 0), top + 78)
  })
  drawRule(context, 80, top + 112, 1000)
  return top + 112
}

function workRows(data) {
  return data.exercises.map((exercise) => ({
    name: exercise.name,
    value: exercise.cardio
      ? `${exercise.setCount} ${exercise.setCount === 1 ? 'SPLIT' : 'SPLITS'}`
      : `${exercise.setCount} ${exercise.setCount === 1 ? 'SET' : 'SETS'}`,
  }))
}

function drawWorkRegister(context, data, top) {
  const rows = workRows(data)
  const visibleRows = rows.slice(0, MAX_VISIBLE_MOVEMENTS)
  const hiddenCount = Math.max(0, rows.length - visibleRows.length)

  context.fillStyle = MUTED
  context.font = '500 18px "DM Mono", monospace'
  context.fillText('WORK PERFORMED', 80, top + 24)
  context.textAlign = 'right'
  context.fillStyle = hiddenCount > 0 ? ACCENT : MUTED
  context.fillText(hiddenCount > 0 ? `+${hiddenCount} MORE MOVEMENTS` : 'COMPLETED', 1000, top + 24)
  context.textAlign = 'left'

  visibleRows.forEach((row, index) => {
    const y = top + 72 + index * 68
    context.fillStyle = ACCENT
    context.font = '500 18px "DM Mono", monospace'
    context.fillText(String(index + 1).padStart(2, '0'), 80, y)

    context.fillStyle = INK
    context.font = '650 27px Manrope, sans-serif'
    context.fillText(truncateText(context, row.name.toUpperCase(), 660), 145, y + 2)

    context.fillStyle = MUTED
    context.font = '500 18px "DM Mono", monospace'
    context.textAlign = 'right'
    context.fillText(row.value, 1000, y)
    context.textAlign = 'left'
    drawRule(context, 145, y + 27, 1000, RULE, 1)
  })
}

function drawFooter(context, data) {
  context.fillStyle = ACCENT
  context.beginPath()
  context.arc(86, 1842, 8, 0, Math.PI * 2)
  context.fill()

  context.fillStyle = MUTED
  context.font = '500 17px "DM Mono", monospace'
  context.fillText(`SESSION ${data.date} · LOCAL RECORD`, 115, 1848)
  context.textAlign = 'right'
  context.fillText('OPENWORKOUT', 1000, 1848)
  context.textAlign = 'left'
}

export async function createWorkoutShareImage(workout, unit, distanceUnit, exerciseMap) {
  if (typeof document === 'undefined') throw new Error('Share images require a browser')
  await Promise.allSettled([
    document.fonts?.load?.('760 100px Manrope'),
    document.fonts?.load?.('500 20px "DM Mono"'),
  ].filter(Boolean))

  const canvas = document.createElement('canvas')
  canvas.width = CARD_WIDTH
  canvas.height = CARD_HEIGHT
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not prepare the share image')

  const data = buildCardData(workout, unit, distanceUnit, exerciseMap)
  drawPaper(context)
  drawHeader(context, data)
  const titleBottom = drawTitle(context, data.title)
  const heroBottom = drawHero(context, data, titleBottom + 25)
  const plotBottom = drawPerformancePlot(context, data, heroBottom + 25)
  const factsBottom = drawFacts(context, data, plotBottom + 22)
  drawWorkRegister(context, data, factsBottom + 24)
  drawFooter(context, data)

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Could not create the share image'))
    }, 'image/png')
  })
}

export function workoutShareFilename(workout) {
  const safeName = String(workout?.name || 'workout')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'workout'
  const date = new Date(workout?.completedAt || workout?.startedAt || Date.now())
  const datePart = Number.isNaN(date.getTime()) ? 'session' : date.toISOString().slice(0, 10)
  return `openworkout-${safeName}-${datePart}.png`
}

export function downloadShareImage(blob, filename) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
