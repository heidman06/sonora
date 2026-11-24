import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { engine } from './audio/engine'
import { registerSw } from './lib/sw'
import './app.css'
import './mus-header.css'
import './mus-queue.css'
import './overrides.css'

;(window as unknown as { __sonoraEngine?: typeof engine }).__sonoraEngine = engine
registerSw(() => engine.setSwUpdate(true))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
