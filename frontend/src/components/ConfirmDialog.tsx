import { useEffect, useId, useRef } from 'react'

interface Props {
  title: string
  body?: string
  confirmLabel: string
  cancelLabel: string
  onConfirm: () => void
  onCancel: () => void
}

// Dialog sombre inline (design échelle C3) : focus Confirmer au montage, Escape = annuler, Tab cyclique sur 2 boutons.
export function ConfirmDialog({ title, body, confirmLabel, cancelLabel, onConfirm, onCancel }: Props) {
  const confirmRef = useRef<HTMLButtonElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const cancelFn = useRef(onCancel)
  cancelFn.current = onCancel
  const titleId = useId()
  const bodyId = useId()

  useEffect(() => { confirmRef.current?.focus() }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); cancelFn.current() } }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab') return
    e.preventDefault()
    const active = document.activeElement
    const next = e.shiftKey
      ? (active === cancelRef.current ? confirmRef.current : cancelRef.current)
      : (active === confirmRef.current ? cancelRef.current : confirmRef.current)
    next?.focus()
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,.6)', display: 'grid', placeItems: 'center', padding: 20 }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div
        role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={body ? bodyId : undefined}
        onKeyDown={onKeyDown}
        style={{ background: '#0d0d12', borderRadius: 20, border: '1px solid rgba(255,255,255,.12)', padding: '22px 20px', width: 'min(100%, 360px)', color: '#f5f5f7', boxShadow: '0 30px 80px rgba(0,0,0,.6)' }}
      >
        <h2 id={titleId} style={{ margin: 0, fontSize: 18, fontWeight: 750, letterSpacing: '-.02em' }}>{title}</h2>
        {body && <p id={bodyId} style={{ margin: '10px 0 0', fontSize: 14, lineHeight: 1.45, color: 'rgba(245,245,247,.72)' }}>{body}</p>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
          <button ref={cancelRef} type="button" className="btn-ghost" style={{ padding: '10px 16px' }} onClick={onCancel}>{cancelLabel}</button>
          <button ref={confirmRef} type="button" className="btn-primary" style={{ padding: '10px 16px' }} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
