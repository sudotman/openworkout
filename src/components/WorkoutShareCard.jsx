import { useEffect, useMemo, useState } from 'react'
import { Download, Share2 } from 'lucide-react'
import { motion } from 'motion/react'
import {
  createWorkoutShareImage,
  downloadShareImage,
  workoutShareFilename,
} from '../lib/share-card.js'
import {
  formatCardioDistance,
  formatCardioPace,
  formatCardioTime,
  getCardioSummary,
  isCardioExercise,
} from '../lib/cardio.js'
import '../share-card.css'

export function WorkoutShareCard({ workout, unit, distanceUnit, exerciseMap, onDone, notify }) {
  const [imageBlob, setImageBlob] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [error, setError] = useState('')
  const [sharing, setSharing] = useState(false)

  useEffect(() => {
    let cancelled = false
    let objectUrl = ''
    setImageBlob(null)
    setPreviewUrl('')
    setError('')

    createWorkoutShareImage(workout, unit, distanceUnit, exerciseMap)
      .then((blob) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setImageBlob(blob)
        setPreviewUrl(objectUrl)
      })
      .catch((renderError) => {
        if (!cancelled) setError(renderError.message || 'Could not create the image')
      })

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [distanceUnit, exerciseMap, unit, workout])

  const cardio = useMemo(() => getCardioSummary(workout, exerciseMap), [exerciseMap, workout])
  const strength = useMemo(() => (workout?.exercises || []).flatMap((item) => {
    if (isCardioExercise(exerciseMap?.get(item.exerciseId))) return []
    const completedSets = (item.sets || []).filter((set) => set.completed && set.type !== 'warmup')
    return completedSets.length ? [{ item, completedSets }] : []
  }), [exerciseMap, workout])
  const strengthSetCount = strength.reduce((total, entry) => total + entry.completedSets.length, 0)
  const strengthVolume = strength.reduce((total, entry) => total + entry.completedSets.reduce(
    (setTotal, set) => setTotal + (Number(set.weight) || 0) * (Number(set.reps) || 0),
    0,
  ), 0)
  const hasCardio = cardio.distanceKm > 0
  const mode = hasCardio && strengthSetCount > 0 ? 'hybrid' : hasCardio ? 'cardio' : 'strength'
  const shareFacts = mode === 'hybrid'
    ? [
        ['DISTANCE', `${formatCardioDistance(cardio.distanceKm, distanceUnit)} ${distanceUnit}`],
        ['PACE', formatCardioPace(cardio.paceSecondsPerKm, distanceUnit)],
        ['LIFTING', strengthVolume > 0 ? `${Math.round(strengthVolume).toLocaleString()} ${unit}` : `${strengthSetCount} sets`],
      ]
    : mode === 'cardio'
      ? [
          ['DISTANCE', `${formatCardioDistance(cardio.distanceKm, distanceUnit)} ${distanceUnit}`],
          ['PACE', formatCardioPace(cardio.paceSecondsPerKm, distanceUnit)],
          ['RUN TIME', formatCardioTime(cardio.totalDurationSeconds)],
        ]
      : [
          ['WORK SETS', String(strengthSetCount)],
          ['MOVEMENTS', String(strength.length)],
          ['DURATION', formatCardioTime(workout?.durationSeconds)],
        ]
  const shareCopy = {
    title: workout?.name || 'Workout',
    body: 'A 1080 × 1920 card with this session\u2019s metrics, a per-movement chart, and the full set list.',
  }

  const filename = useMemo(() => workoutShareFilename(workout), [workout])
  const shareFile = useMemo(
    () => imageBlob ? new File([imageBlob], filename, { type: 'image/png' }) : null,
    [filename, imageBlob],
  )
  const canNativeShare = useMemo(() => {
    if (!shareFile || !navigator.share || !navigator.canShare) return false
    try {
      return navigator.canShare({ files: [shareFile] })
    } catch {
      return false
    }
  }, [shareFile])

  const saveImage = () => {
    if (!imageBlob) return
    downloadShareImage(imageBlob, filename)
    notify?.('Story image downloaded')
  }

  const shareImage = async () => {
    if (!imageBlob || sharing) return
    if (!canNativeShare) {
      saveImage()
      return
    }

    setSharing(true)
    try {
      await navigator.share({
        files: [shareFile],
        title: `${workout.name} · OpenWorkout`,
        text: hasCardio
          ? `${formatCardioDistance(cardio.distanceKm, distanceUnit)} ${distanceUnit} · ${formatCardioPace(cardio.paceSecondsPerKm, distanceUnit)}${mode === 'hybrid' ? ` · ${strengthSetCount} lifting sets` : ''}`
          : `${strengthSetCount} sets · ${formatCardioTime(workout?.durationSeconds)}.`,
      })
    } catch (shareError) {
      if (shareError?.name !== 'AbortError') notify?.('Could not open the share menu')
    } finally {
      setSharing(false)
    }
  }

  return (
    <motion.div
      className={`share-workout-sheet share-workout-sheet--${mode}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.24 }}
    >
      <motion.div
        className="share-workout-copy"
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        <span className="share-record-mark" aria-hidden="true" />
        <h2>{shareCopy.title}</h2>
        <p>{shareCopy.body}</p>
        <div className="share-session-facts">
          {shareFacts.map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
        <div className="share-workout-meta">
          <span>STORY FORMAT</span>
          <strong>1080 × 1920 PNG</strong>
        </div>
        <div className="share-workout-actions">
          <button
            className="button button--accent button--wide"
            onClick={shareImage}
            disabled={!imageBlob || sharing}
          >
            {canNativeShare ? <Share2 size={18} /> : <Download size={18} />}
            {sharing ? 'Opening share menu…' : canNativeShare ? 'Share session' : 'Download image'}
          </button>
          {canNativeShare && (
            <button className="button button--outline button--wide" onClick={saveImage} disabled={!imageBlob}>
              <Download size={17} /> Save a copy
            </button>
          )}
          <button className="button button--ghost button--wide" onClick={onDone}>Done</button>
        </div>
        <small className="share-privacy-note">Nothing is posted automatically. You choose where the image goes.</small>
      </motion.div>

      <motion.div
        className="share-card-preview"
        aria-live="polite"
        initial={{ opacity: 0, y: 16, rotate: 0.8 }}
        animate={{ opacity: 1, y: 0, rotate: 0 }}
        transition={{ duration: 0.46, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
      >
        {previewUrl && <img src={previewUrl} alt={`Share card for ${workout.name}`} />}
        {!previewUrl && !error && (
          <div className="share-card-loading">
            <span />
            <strong>Making your session card…</strong>
          </div>
        )}
        {error && (
          <div className="share-card-error">
            <strong>Couldn’t make the image</strong>
            <span>{error}</span>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}
