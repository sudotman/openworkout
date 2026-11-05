import { ArrowLeft, X } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useRef } from 'react'

export function Sheet({ children, onClose, kind = '', wide = false, share = false, hideClose = false }) {
  const backdropRef = useRef(null)

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  useEffect(() => {
    if (kind !== 'picker') return undefined

    const viewport = window.visualViewport
    const syncVisualViewport = () => {
      const backdrop = backdropRef.current
      if (!backdrop) return
      backdrop.style.setProperty('--visual-viewport-height', `${viewport?.height || window.innerHeight}px`)
      backdrop.style.setProperty('--visual-viewport-top', `${viewport?.offsetTop || 0}px`)
    }

    syncVisualViewport()
    viewport?.addEventListener('resize', syncVisualViewport)
    viewport?.addEventListener('scroll', syncVisualViewport)
    window.addEventListener('resize', syncVisualViewport)
    return () => {
      viewport?.removeEventListener('resize', syncVisualViewport)
      viewport?.removeEventListener('scroll', syncVisualViewport)
      window.removeEventListener('resize', syncVisualViewport)
    }
  }, [kind])

  return (
    <motion.div
      ref={backdropRef}
      className={'sheet-backdrop ' + (kind === 'picker' ? 'sheet-backdrop--picker' : '')}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <motion.div
        className={'sheet ' + (wide ? 'sheet--wide ' : '') + (share ? 'sheet--share ' : '') + (kind === 'picker' ? 'sheet--picker' : '')}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 32, stiffness: 350 }}
        role="dialog"
        aria-modal="true"
      >
        <div className="sheet-handle" />
        {!hideClose && (
          <button className="sheet-close icon-button" onClick={onClose} aria-label="Close dialog">
            <X size={20} />
          </button>
        )}
        {children}
      </motion.div>
    </motion.div>
  )
}

export function SheetHeading({ eyebrow, title, body, back }) {
  return (
    <div className="sheet-heading">
      {back && (
        <button className="sheet-back" onClick={back}>
          <ArrowLeft size={17} /> Back
        </button>
      )}
      {eyebrow && <span className="section-kicker">{eyebrow}</span>}
      <h2>{title}</h2>
      {body && <p>{body}</p>}
    </div>
  )
}

export function ConfirmSheet({ icon: Icon, title, body, confirmLabel, onConfirm, onCancel, danger }) {
  return (
    <div className="sheet-content compact-sheet">
      <span className={'confirm-icon ' + (danger ? 'confirm-icon--danger' : '')}><Icon size={24} /></span>
      <SheetHeading title={title} body={body} />
      <button className={'button button--wide ' + (danger ? 'button--danger' : 'button--dark')} onClick={onConfirm}>
        {confirmLabel}
      </button>
      <button className="button button--ghost button--wide" onClick={onCancel}>Cancel</button>
    </div>
  )
}
