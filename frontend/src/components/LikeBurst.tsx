import { useEffect, useRef, useState } from 'react'

// Burst like (design V4/S3) : front montant false→true uniquement, 6 particules,
// démontage ≤ 600 ms, non monté si prefers-reduced-motion.
export function LikeBurst({ active }: { active: boolean }) {
  const [burst, setBurst] = useState(false)
  const prev = useRef(active)
  const timer = useRef<number | null>(null)
  useEffect(() => {
    const rising = active && !prev.current
    prev.current = active
    if (!rising) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    setBurst(true)
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setBurst(false), 600)
  }, [active])
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current) }, [])
  if (!burst) return null
  return (
    <span className="like-burst" aria-hidden="true">
      <i /><i /><i /><i /><i /><i />
    </span>
  )
}
