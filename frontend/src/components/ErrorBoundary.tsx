import { Component, type ErrorInfo, type ReactNode } from 'react'
import { storage } from '../lib/storage'
import { tr } from '../lib/i18n'
import type { Lang } from '../lib/types'

interface Props { children: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State { return { error } }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Sonora UI error', error, info.componentStack)
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children
    const lang = storage.get('lang', 'en') as Lang
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24, textAlign: 'center', color: '#f5f5f7', background: '#08080a', fontFamily: '-apple-system,BlinkMacSystemFont,sans-serif' }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>{tr(lang, 'errorTitle')}</div>
        <div style={{ opacity: 0.65, fontSize: 13, maxWidth: 320 }}>{String(this.state.error.message || tr(lang, 'errorUnknown')).slice(0, 200)}</div>
        <button onClick={() => location.reload()} style={{ background: '#fff', color: '#000', border: 0, borderRadius: 999, padding: '12px 22px', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>{tr(lang, 'reload')}</button>
      </div>
    )
  }
}
