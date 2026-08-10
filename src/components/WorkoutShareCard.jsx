import { useEffect, useMemo, useState } from 'react'
import { Check, Download, Share2 } from 'lucide-react'
import {
  createWorkoutShareImage,
  downloadShareImage,
  workoutShareFilename,
} from '../lib/share-card.js'
import '../share-card.css'

export function WorkoutShareCard({ workout, unit, exerciseMap, onDone, notify }) {
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

    createWorkoutShareImage(workout, unit, exerciseMap)
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
  }, [exerciseMap, unit, workout])

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
        text: 'Session complete. Work put in.',
      })
    } catch (shareError) {
      if (shareError?.name !== 'AbortError') notify?.('Could not open the share menu')
    } finally {
      setSharing(false)
    }
  }

  return (
    <div className="share-workout-sheet">
      <div className="share-workout-copy">
        <span className="share-complete-icon"><Check size={22} strokeWidth={3} /></span>
        <span className="section-kicker">WORKOUT SAVED</span>
        <h2>That one’s in the books.</h2>
        <p>Your session card is ready for Stories, group chats, or wherever you keep the people who keep you honest.</p>
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
      </div>

      <div className="share-card-preview" aria-live="polite">
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
      </div>
    </div>
  )
}
