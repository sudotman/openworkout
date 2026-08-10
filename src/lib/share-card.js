const CARD_WIDTH = 1080
const CARD_HEIGHT = 1920

function roundedRect(context, x, y, width, height, radius) {
  const safeRadius = Math.min(radius, width / 2, height / 2)
  context.beginPath()
  context.roundRect(x, y, width, height, safeRadius)
}

function fitFontSize(context, text, maxWidth, startSize, minimumSize = 42, weight = 760) {
  let size = startSize
  while (size > minimumSize) {
    context.font = `${weight} ${size}px Manrope, sans-serif`
    if (context.measureText(text).width <= maxWidth) break
    size -= 2
  }
  return size
}

function wrapText(context, text, maxWidth, maxLines = 3) {
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

  if (lines.length > maxLines) {
    const visible = lines.slice(0, maxLines)
    const overflow = lines.slice(maxLines - 1).join(' ')
    let finalLine = overflow
    while (finalLine.length > 1 && context.measureText(`${finalLine}…`).width > maxWidth) {
      finalLine = finalLine.slice(0, -1).trim()
    }
    visible[maxLines - 1] = `${finalLine}…`
    return visible
  }
  return lines
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

function drawBrandMark(context, x, y) {
  context.save()
  context.strokeStyle = '#d9ff4f'
  context.lineWidth = 3
  context.beginPath()
  context.arc(x + 25, y + 25, 24, 0, Math.PI * 2)
  context.stroke()
  context.fillStyle = '#d9ff4f'
  roundedRect(context, x + 10, y + 15, 6, 20, 3)
  context.fill()
  roundedRect(context, x + 34, y + 15, 6, 20, 3)
  context.fill()
  roundedRect(context, x + 14, y + 22, 22, 6, 3)
  context.fill()
  context.restore()
}

function drawBackground(context) {
  context.fillStyle = '#11130f'
  context.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT)

  const glow = context.createRadialGradient(1040, 120, 20, 1040, 120, 720)
  glow.addColorStop(0, 'rgba(217, 255, 79, 0.27)')
  glow.addColorStop(0.45, 'rgba(217, 255, 79, 0.07)')
  glow.addColorStop(1, 'rgba(217, 255, 79, 0)')
  context.fillStyle = glow
  context.fillRect(300, 0, 780, 900)

  context.save()
  context.strokeStyle = 'rgba(217, 255, 79, 0.10)'
  context.lineWidth = 3
  ;[0, 1, 2, 3].forEach((index) => {
    context.beginPath()
    context.moveTo(600 + index * 62, -80)
    context.bezierCurveTo(1000 + index * 30, 220, 690 + index * 72, 500, 1160, 700 + index * 54)
    context.stroke()
  })
  context.restore()

  let seed = 17
  context.fillStyle = 'rgba(255, 255, 255, 0.035)'
  for (let index = 0; index < 620; index += 1) {
    seed = (seed * 9301 + 49297) % 233280
    const x = (seed / 233280) * CARD_WIDTH
    seed = (seed * 9301 + 49297) % 233280
    const y = (seed / 233280) * CARD_HEIGHT
    context.fillRect(Math.round(x), Math.round(y), 2, 2)
  }

  context.fillStyle = '#d9ff4f'
  context.fillRect(0, 0, 14, CARD_HEIGHT)
}

function drawStat(context, x, y, width, label, value) {
  context.fillStyle = 'rgba(255, 255, 255, 0.045)'
  roundedRect(context, x, y, width, 190, 28)
  context.fill()
  context.strokeStyle = 'rgba(255, 255, 255, 0.09)'
  context.lineWidth = 2
  context.stroke()

  context.fillStyle = 'rgba(255, 255, 255, 0.48)'
  context.font = '500 22px "DM Mono", monospace'
  context.fillText(label, x + 30, y + 48)
  context.fillStyle = '#f8f7f0'
  const size = fitFontSize(context, value, width - 60, 56, 36, 650)
  context.font = `650 ${size}px Manrope, sans-serif`
  context.fillText(value, x + 30, y + 127)
}

function buildCardData(workout, unit, exerciseMap) {
  const completedExercises = (workout?.exercises || []).map((item) => {
    const completedSets = (item.sets || []).filter((set) => set.completed)
    return {
      name: exerciseMap?.get(item.exerciseId)?.name || 'Exercise',
      setCount: completedSets.length,
    }
  }).filter((item) => item.setCount > 0)

  const completedSets = completedExercises.reduce((total, item) => total + item.setCount, 0)
  const volume = (workout?.exercises || []).reduce(
    (total, item) => total + (item.sets || []).reduce((setTotal, set) => {
      if (!set.completed || set.type === 'warmup') return setTotal
      return setTotal + (Number(set.weight) || 0) * (Number(set.reps) || 0)
    }, 0),
    0,
  )

  return {
    title: String(workout?.name || 'Workout').trim().toUpperCase(),
    date: formatDate(workout?.completedAt || workout?.startedAt),
    duration: formatDuration(workout?.durationSeconds),
    completedSets,
    volume,
    unit: unit || 'kg',
    exercises: completedExercises,
  }
}

export async function createWorkoutShareImage(workout, unit, exerciseMap) {
  if (typeof document === 'undefined') throw new Error('Share images require a browser')
  await Promise.allSettled([
    document.fonts?.load?.('760 112px Manrope'),
    document.fonts?.load?.('500 24px "DM Mono"'),
  ].filter(Boolean))

  const canvas = document.createElement('canvas')
  canvas.width = CARD_WIDTH
  canvas.height = CARD_HEIGHT
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not prepare the share image')

  const data = buildCardData(workout, unit, exerciseMap)
  drawBackground(context)

  drawBrandMark(context, 78, 77)
  context.fillStyle = '#f8f7f0'
  context.font = '750 30px Manrope, sans-serif'
  context.fillText('OPENWORKOUT', 150, 112)
  context.fillStyle = 'rgba(255, 255, 255, 0.46)'
  context.font = '500 21px "DM Mono", monospace'
  context.textAlign = 'right'
  context.fillText(`SESSION // ${data.date}`, 1000, 110)
  context.textAlign = 'left'

  context.fillStyle = '#d9ff4f'
  roundedRect(context, 80, 216, 288, 58, 29)
  context.fill()
  context.fillStyle = '#161812'
  context.font = '650 20px "DM Mono", monospace'
  context.fillText('SESSION COMPLETE', 110, 253)

  context.fillStyle = '#f8f7f0'
  context.font = '760 112px Manrope, sans-serif'
  const titleLines = wrapText(context, data.title, 900, 3)
  titleLines.forEach((line, index) => context.fillText(line, 78, 390 + index * 108))

  const dividerY = Math.max(712, 420 + titleLines.length * 108)
  context.strokeStyle = 'rgba(255, 255, 255, 0.13)'
  context.lineWidth = 2
  context.beginPath()
  context.moveTo(80, dividerY)
  context.lineTo(1000, dividerY)
  context.stroke()

  const hasVolume = data.volume > 0
  const heroValue = hasVolume ? formatVolume(data.volume) : String(data.completedSets)
  const heroUnit = hasVolume ? data.unit.toUpperCase() : data.completedSets === 1 ? 'SET' : 'SETS'
  const heroLabel = hasVolume ? 'TOTAL TRAINING VOLUME' : 'COMPLETED WORK'
  context.fillStyle = 'rgba(255, 255, 255, 0.46)'
  context.font = '500 23px "DM Mono", monospace'
  context.fillText(heroLabel, 80, dividerY + 82)

  const heroSize = fitFontSize(context, heroValue, 740, 160, 92, 760)
  context.fillStyle = '#f8f7f0'
  context.font = `760 ${heroSize}px Manrope, sans-serif`
  context.fillText(heroValue, 74, dividerY + 248)
  const heroWidth = context.measureText(heroValue).width
  context.fillStyle = '#d9ff4f'
  context.font = '650 42px "DM Mono", monospace'
  context.fillText(heroUnit, Math.min(850, 82 + heroWidth), dividerY + 238)

  const statsY = dividerY + 310
  drawStat(context, 80, statsY, 286, 'DURATION', data.duration)
  drawStat(context, 397, statsY, 286, 'WORK SETS', String(data.completedSets))
  drawStat(context, 714, statsY, 286, 'MOVEMENTS', String(data.exercises.length))

  const movementY = statsY + 280
  context.fillStyle = 'rgba(255, 255, 255, 0.46)'
  context.font = '500 22px "DM Mono", monospace'
  context.fillText('TODAY’S WORK', 80, movementY)

  const visibleExercises = data.exercises.slice(0, 4)
  visibleExercises.forEach((exercise, index) => {
    const rowY = movementY + 70 + index * 94
    context.fillStyle = 'rgba(255, 255, 255, 0.28)'
    context.font = '500 21px "DM Mono", monospace'
    context.fillText(String(index + 1).padStart(2, '0'), 80, rowY)
    context.fillStyle = '#f8f7f0'
    const exerciseSize = fitFontSize(context, exercise.name, 650, 37, 28, 650)
    context.font = `650 ${exerciseSize}px Manrope, sans-serif`
    context.fillText(exercise.name, 150, rowY + 2)
    context.fillStyle = '#d9ff4f'
    context.font = '500 21px "DM Mono", monospace'
    context.textAlign = 'right'
    context.fillText(`${exercise.setCount} ${exercise.setCount === 1 ? 'SET' : 'SETS'}`, 1000, rowY)
    context.textAlign = 'left'
    if (index < visibleExercises.length - 1) {
      context.strokeStyle = 'rgba(255, 255, 255, 0.08)'
      context.beginPath()
      context.moveTo(150, rowY + 40)
      context.lineTo(1000, rowY + 40)
      context.stroke()
    }
  })

  if (data.exercises.length > visibleExercises.length) {
    context.fillStyle = 'rgba(255, 255, 255, 0.42)'
    context.font = '500 19px "DM Mono", monospace'
    context.fillText(`+ ${data.exercises.length - visibleExercises.length} MORE MOVEMENTS`, 150, movementY + 70 + visibleExercises.length * 94)
  }

  context.fillStyle = '#d9ff4f'
  context.font = '650 23px "DM Mono", monospace'
  context.fillText('WORK PUT IN. SESSION LOGGED.', 80, 1834)
  context.fillStyle = 'rgba(255, 255, 255, 0.34)'
  context.font = '500 19px "DM Mono", monospace'
  context.textAlign = 'right'
  context.fillText('TRAIN • TRACK • REPEAT', 1000, 1834)
  context.textAlign = 'left'

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

