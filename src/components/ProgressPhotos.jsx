import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  CalendarDays,
  Check,
  Columns2,
  HardDrive,
  ImagePlus,
  Plus,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react'
import '../progress-photos.css'

const PHOTO_LIMIT = 12
const MAX_IMAGE_EDGE = 900
const JPEG_QUALITY = 0.72
const MAX_SOURCE_BYTES = 30 * 1024 * 1024

function localDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function toLocalDate(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(value + 'T12:00:00')
  }
  return new Date(value)
}

function formatDate(value, options) {
  const date = toLocalDate(value)
  if (Number.isNaN(date.getTime())) return 'Unknown date'
  return new Intl.DateTimeFormat('en', options).format(date)
}

function dataUrlBytes(dataUrl) {
  if (typeof dataUrl !== 'string' || !dataUrl) return 0
  const comma = dataUrl.indexOf(',')
  const content = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl
  if (!dataUrl.includes(';base64,')) return content.length
  const padding = content.endsWith('==') ? 2 : content.endsWith('=') ? 1 : 0
  return Math.max(0, Math.floor(content.length * 0.75) - padding)
}

function formatBytes(bytes) {
  if (!bytes) return '0 KB'
  if (bytes < 1024 * 1024) return Math.max(1, Math.round(bytes / 1024)) + ' KB'
  return (bytes / 1024 / 1024).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1) + ' MB'
}

function loadHtmlImage(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('This image format could not be decoded. Try a JPEG, PNG, or WebP image.'))
    }
    image.src = objectUrl
  })
}

async function decodeImage(file) {
  if (typeof globalThis.createImageBitmap === 'function') {
    try {
      return await globalThis.createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
      // Safari and older browsers can reject the orientation option; the HTML
      // image fallback still decodes common phone and camera formats locally.
    }
  }
  return loadHtmlImage(file)
}

async function compressImage(file) {
  if (!file?.type?.startsWith('image/')) throw new Error('Choose an image file to continue.')
  if (file.size > MAX_SOURCE_BYTES) throw new Error('Choose an image smaller than 30 MB.')

  const source = await decodeImage(file)
  try {
    const sourceWidth = source.naturalWidth || source.width
    const sourceHeight = source.naturalHeight || source.height
    if (!sourceWidth || !sourceHeight) throw new Error('The selected image has no readable dimensions.')

    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(sourceWidth, sourceHeight))
    const width = Math.max(1, Math.round(sourceWidth * scale))
    const height = Math.max(1, Math.round(sourceHeight * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d', { alpha: false })
    if (!context) throw new Error('Image compression is unavailable in this browser.')

    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, width, height)
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(source, 0, 0, width, height)
    const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
    if (!dataUrl.startsWith('data:image/jpeg')) throw new Error('The image could not be compressed.')
    return dataUrl
  } finally {
    source.close?.()
  }
}

function photoIdentity(photo, index) {
  return String(photo?.id || 'photo-' + (photo?.date || 'undated') + '-' + index)
}

/**
 * A private, callback-driven progress photo gallery. Images are resized and
 * encoded entirely in the browser before onAdd is called.
 */
export function ProgressPhotos({ photos = [], onAdd, onDelete }) {
  const fileInputRef = useRef(null)
  const processingRunRef = useRef(0)
  const [adding, setAdding] = useState(false)
  const [date, setDate] = useState(() => localDateKey())
  const [preview, setPreview] = useState('')
  const [fileName, setFileName] = useState('')
  const [processing, setProcessing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [compareMode, setCompareMode] = useState(false)
  const [selectedKeys, setSelectedKeys] = useState([])
  const [deleteKey, setDeleteKey] = useState('')

  const gallery = useMemo(() => {
    return photos
      .map((photo, originalIndex) => ({ photo, key: photoIdentity(photo, originalIndex) }))
      .filter(({ photo }) => photo?.dataUrl)
      .sort((a, b) => toLocalDate(b.photo.date) - toLocalDate(a.photo.date))
      .slice(0, PHOTO_LIMIT)
  }, [photos])

  const storageBytes = useMemo(
    () => photos.reduce((total, photo) => total + dataUrlBytes(photo?.dataUrl), 0),
    [photos],
  )
  const atLimit = photos.length >= PHOTO_LIMIT
  const galleryKeySignature = gallery.map((item) => item.key).join('|')

  useEffect(() => {
    const available = new Set(gallery.map((item) => item.key))
    setSelectedKeys((current) => {
      const next = current.filter((key) => available.has(key))
      return next.length === current.length ? current : next
    })
  }, [galleryKeySignature])

  const selectedPhotos = selectedKeys
    .map((key) => gallery.find((item) => item.key === key))
    .filter(Boolean)

  const clearDraft = () => {
    processingRunRef.current += 1
    setPreview('')
    setFileName('')
    setError('')
    setProcessing(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const closeAdd = () => {
    clearDraft()
    setDate(localDateKey())
    setAdding(false)
  }

  const openAdd = () => {
    if (atLimit) return
    setCompareMode(false)
    setSelectedKeys([])
    setDeleteKey('')
    setAdding(true)
  }

  const chooseFile = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    const input = event.currentTarget
    const processingRun = processingRunRef.current + 1
    processingRunRef.current = processingRun
    setProcessing(true)
    setPreview('')
    setFileName(file.name)
    setError('')
    try {
      const compressed = await compressImage(file)
      if (processingRun === processingRunRef.current) setPreview(compressed)
    } catch (fileError) {
      if (processingRun === processingRunRef.current) {
        setFileName('')
        setError(fileError instanceof Error ? fileError.message : 'The image could not be processed.')
      }
    } finally {
      if (processingRun === processingRunRef.current) setProcessing(false)
      // Allow choosing the same source file again after removing the preview.
      input.value = ''
    }
  }

  const savePhoto = async (event) => {
    event.preventDefault()
    if (!preview || !date || saving || atLimit) return
    setSaving(true)
    setError('')
    try {
      const id = globalThis.crypto?.randomUUID?.() || 'progress-photo-' + Date.now()
      await onAdd?.({ id, date, dataUrl: preview })
      closeAdd()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'The photo could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  const toggleCompareMode = () => {
    setCompareMode((current) => !current)
    setSelectedKeys([])
    setDeleteKey('')
    setAdding(false)
  }

  const toggleSelected = (key) => {
    setSelectedKeys((current) => {
      if (current.includes(key)) return current.filter((item) => item !== key)
      if (current.length < 2) return [...current, key]
      return [current[1], key]
    })
  }

  const deletePhoto = async (item) => {
    try {
      await onDelete?.(item.photo.id, item.photo)
      setSelectedKeys((current) => current.filter((key) => key !== item.key))
      setDeleteKey('')
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'The photo could not be deleted.')
      setDeleteKey('')
    }
  }

  return (
    <section className="photo-module" aria-labelledby="photo-title">
      <header className="photo-header">
        <div>
          <span className="photo-kicker">ON THIS DEVICE</span>
          <h2 id="photo-title">Progress photos</h2>
          <p>Same pose and lighting make changes easier to see.</p>
        </div>
        <button
          className={adding ? 'photo-icon-button' : 'photo-button photo-button--dark'}
          type="button"
          disabled={atLimit && !adding}
          onClick={adding ? closeAdd : openAdd}
          aria-label={adding ? 'Close photo form' : atLimit ? 'Photo limit reached' : 'Add progress photo'}
        >
          {adding ? <X size={18} /> : <><Plus size={16} /><span>{atLimit ? '12 / 12' : 'Add photo'}</span></>}
        </button>
      </header>

      <div className="photo-privacy-note">
        <ShieldCheck size={18} />
        <span><strong>Never uploaded</strong> Compression and storage happen in this browser.</span>
      </div>

      <AnimatePresence initial={false}>
        {adding && (
          <motion.form
            className="photo-add-form"
            onSubmit={savePhoto}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="photo-add-inner">
              <div className="photo-draft-grid">
                <div className={preview ? 'photo-picker photo-picker--ready' : 'photo-picker'}>
                  {preview ? (
                    <motion.img
                      src={preview}
                      alt="Compressed progress photo preview"
                      initial={{ opacity: 0, scale: 0.985 }}
                      animate={{ opacity: 1, scale: 1 }}
                    />
                  ) : (
                    <div className="photo-picker-empty">
                      <span><ImagePlus size={24} /></span>
                      <strong>{processing ? 'Compressing photo…' : 'Choose a photo'}</strong>
                      <small>{processing ? 'This stays on your device' : 'JPEG, PNG, or WebP · up to 30 MB'}</small>
                    </div>
                  )}
                  {processing && <i className="photo-processing-bar" aria-hidden="true" />}
                  {preview && (
                    <button
                      className="photo-remove-preview"
                      type="button"
                      onClick={clearDraft}
                      aria-label="Remove selected photo"
                    >
                      <X size={16} />
                    </button>
                  )}
                  {!processing && !preview && (
                    <button
                      className="photo-picker-hitbox"
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      aria-label="Choose an image file"
                    />
                  )}
                </div>

                <div className="photo-draft-fields">
                  <label className="photo-field">
                    <span><CalendarDays size={14} /> Photo date</span>
                    <input
                      type="date"
                      value={date}
                      max={localDateKey()}
                      onChange={(event) => setDate(event.target.value)}
                      required
                    />
                  </label>
                  <input
                    className="photo-file-input"
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                    onChange={chooseFile}
                  />
                  <button
                    className="photo-button photo-button--outline photo-button--wide"
                    type="button"
                    disabled={processing}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <ImagePlus size={16} /> {preview ? 'Choose another' : 'Select from device'}
                  </button>
                  <div className="photo-compression-detail">
                    <HardDrive size={15} />
                    <span>
                      {preview
                        ? (fileName || 'Photo') + ' · compressed to ' + formatBytes(dataUrlBytes(preview))
                        : 'Saved as a max 900px JPEG at 72% quality.'}
                    </span>
                  </div>
                  <button
                    className="photo-button photo-button--accent photo-button--wide"
                    type="submit"
                    disabled={!preview || !date || processing || saving}
                  >
                    {saving ? 'Saving…' : 'Save photo'}
                  </button>
                </div>
              </div>
              {error && <p className="photo-error" role="alert">{error}</p>}
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {!!gallery.length && (
        <>
          <div className="photo-gallery-toolbar">
            <div>
              <strong>Your timeline</strong>
              <span>{gallery.length} of {PHOTO_LIMIT} photos</span>
            </div>
            {gallery.length >= 2 && (
              <button
                className={compareMode ? 'photo-compare-toggle photo-compare-toggle--active' : 'photo-compare-toggle'}
                type="button"
                onClick={toggleCompareMode}
                aria-pressed={compareMode}
              >
                <Columns2 size={16} /> {compareMode ? 'Done' : 'Compare'}
              </button>
            )}
          </div>

          <AnimatePresence initial={false}>
            {compareMode && (
              <motion.div
                className="photo-compare-panel"
                initial={{ opacity: 0, y: 10, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -6, height: 0 }}
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="photo-compare-head">
                  <div>
                    <span className="photo-kicker">SIDE BY SIDE</span>
                    <strong>{selectedPhotos.length === 2 ? 'Compare progress' : 'Select two photos below'}</strong>
                  </div>
                  <span>{selectedPhotos.length} / 2 selected</span>
                </div>
                <div className="photo-compare-grid">
                  {[0, 1].map((index) => {
                    const item = selectedPhotos[index]
                    return item ? (
                      <motion.figure
                        key={item.key}
                        layoutId={'photo-' + item.key}
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                      >
                        <img
                          src={item.photo.dataUrl}
                          alt={'Progress photo from ' + formatDate(item.photo.date, { month: 'long', day: 'numeric', year: 'numeric' })}
                        />
                        <figcaption>{formatDate(item.photo.date, { month: 'short', day: 'numeric', year: 'numeric' })}</figcaption>
                      </motion.figure>
                    ) : (
                      <div className="photo-compare-placeholder" key={'placeholder-' + index}>
                        <span>{index + 1}</span>
                        <small>Select photo</small>
                      </div>
                    )
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className={compareMode ? 'photo-gallery photo-gallery--selecting' : 'photo-gallery'}>
            <AnimatePresence initial={false}>
              {gallery.map((item, index) => {
                const selectedIndex = selectedKeys.indexOf(item.key)
                const selected = selectedIndex >= 0
                return (
                  <motion.figure
                    className={selected ? 'photo-tile photo-tile--selected' : 'photo-tile'}
                    key={item.key}
                    layout
                    initial={{ opacity: 0, y: 9 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ delay: Math.min(index * 0.025, 0.18) }}
                  >
                    <button
                      className="photo-image-button"
                      type="button"
                      disabled={!compareMode}
                      onClick={() => compareMode && toggleSelected(item.key)}
                      aria-label={compareMode
                        ? (selected ? 'Remove photo from comparison' : 'Select photo for comparison')
                        : undefined}
                    >
                      <img
                        src={item.photo.dataUrl}
                        alt=""
                        loading="lazy"
                        draggable="false"
                      />
                      {compareMode && (
                        <span className={selected ? 'photo-select-mark photo-select-mark--active' : 'photo-select-mark'}>
                          {selected ? selectedIndex + 1 : <Check size={14} />}
                        </span>
                      )}
                    </button>
                    <figcaption>
                      <span>
                        <strong>{formatDate(item.photo.date, { month: 'short', day: 'numeric' })}</strong>
                        <small>{formatDate(item.photo.date, { year: 'numeric' })}</small>
                      </span>
                      {!compareMode && (
                        <button
                          type="button"
                          onClick={() => setDeleteKey(item.key)}
                          aria-label={'Delete photo from ' + formatDate(item.photo.date, { month: 'long', day: 'numeric' })}
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </figcaption>
                    <AnimatePresence>
                      {deleteKey === item.key && (
                        <motion.div
                          className="photo-delete-confirm"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                        >
                          <strong>Delete photo?</strong>
                          <span>This cannot be undone.</span>
                          <div>
                            <button type="button" onClick={() => setDeleteKey('')}>Cancel</button>
                            <button type="button" onClick={() => deletePhoto(item)}>Delete</button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.figure>
                )
              })}
            </AnimatePresence>
          </div>
        </>
      )}

      {!gallery.length && !adding && (
        <motion.div
          className="photo-empty"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <span><ImagePlus size={23} /></span>
          <strong>Start a private photo timeline</strong>
          <p>Use the same angle every few weeks. Photos stay with your local workout data.</p>
          <button className="photo-button photo-button--dark" type="button" onClick={openAdd}>
            <Plus size={16} /> Add first photo
          </button>
        </motion.div>
      )}

      {error && !adding && <p className="photo-error photo-error--standalone" role="alert">{error}</p>}

      <footer className="photo-storage-note">
        <HardDrive size={16} />
        <p>
          <strong>Local storage: about {formatBytes(storageBytes)} used.</strong>
          A 12-photo gallery typically needs 2–6 MB; browser limits vary. Export your data before clearing site storage.
          {photos.length > PHOTO_LIMIT ? ' Showing the 12 most recent photos.' : ''}
        </p>
      </footer>
    </section>
  )
}
