import { useEffect, useState } from 'react'

type BIP = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }
let evenement: BIP | null = null

export function useInstallPrompt(): { canInstall: boolean; promptInstall: () => Promise<boolean> } {
  const [canInstall, setCan] = useState(false)
  useEffect(() => {
    const onBip = (e: Event) => { e.preventDefault(); evenement = e as BIP; setCan(true) }
    const onInstalled = () => { evenement = null; setCan(false) }
    window.addEventListener('beforeinstallprompt', onBip)
    window.addEventListener('appinstalled', onInstalled)
    if (evenement) setCan(true)
    return () => { window.removeEventListener('beforeinstallprompt', onBip); window.removeEventListener('appinstalled', onInstalled) }
  }, [])
  const promptInstall = async () => {
    if (!evenement) return false
    try { await evenement.prompt(); const c = await evenement.userChoice; evenement = null; setCan(false); return c.outcome === 'accepted' }
    catch (e) { return false }
  }
  return { canInstall, promptInstall }
}
