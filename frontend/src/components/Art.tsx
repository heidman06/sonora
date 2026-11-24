import { useEffect, useState } from 'react'
import { artOf } from '../lib/img'

interface Props { id?: string; className?: string; fallback?: string }

// maxres first, graceful fallback to hq (always exists) then mq.
export function Art({ id, className, fallback }: Props) {
  const [src, setSrc] = useState(() => (id ? artOf(id, 'maxres') : fallback || ''))
  useEffect(() => { setSrc(id ? artOf(id, 'maxres') : fallback || '') }, [id, fallback])
  if (!id && !fallback) return <div className={className} style={{ background: 'var(--surface-2)' }} />
  return <img className={className} src={src} alt="" loading="lazy" onError={() => setSrc(id ? artOf(id, 'mq') : fallback || '')} />
}
