import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { engine } from './audio/engine'
import './app.css'
import './mus-header.css'
import './mus-queue.css'
import './overrides.css'

;(window as unknown as { __sonoraEngine?: typeof engine }).__sonoraEngine = engine

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
