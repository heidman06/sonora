import { useEffect, useRef } from 'react'

interface Props {
  message: string
  actionLabel: string
  onAction: () => void
  onDone: () => void
  ms?: number
}

// Snackbar fixe au-dessus du mini-player (design échelle P2/C3) ; timer nettoyé au démontage.
export function UndoToast({ message, actionLabel, onAction, onDone, ms = 5000 }: Props) {
  const actionFn = useRef(onAction)
  actionFn.current = onAction
  const doneFn = useRef(onDone)
  doneFn.current = onDone

  useEffect(() => {
    const timer = window.setTimeout(() => doneFn.current(), ms)
    return () => window.clearTimeout(timer)
  }, [ms])

  return (
    <div
      className="undo-toast"
      role="status" aria-live="polite"
      style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 'calc(150px + var(--safe-b))', zIndex: 150, display: 'flex', alignItems: 'center', gap: 14, background: '#0d0d12', color: '#f5f5f7', border: '1px solid rgba(255,255,255,.14)', padding: '11px 18px', borderRadius: 999, boxShadow: '0 18px 40px rgba(0,0,0,.4)', fontSize: 13.5, fontWeight: 650, maxWidth: 'calc(100vw - 28px)' }}
    >
      <span>{message}</span>
      <button
        type="button"
        style={{ flex: 'none', background: 'rgba(255,255,255,.12)', color: '#f5f5f7', border: 0, borderRadius: 999, padding: '5px 12px', fontSize: 13, fontWeight: 800 }}
        onClick={() => { actionFn.current(); doneFn.current() }}
      >{actionLabel}</button>
    </div>
  )
}
