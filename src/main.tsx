import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from './App'
import { I18nProvider } from './i18n'
import { applyThemeChoice, readThemeChoice } from './lib/theme'
import 'rc-slider/assets/index.css'
import './styles/base/index.scss'
import './styles/main.scss'

// public/theme-init.js already set <html data-theme> before first paint; this
// also brings the browser-chrome colour in line with a forced theme.
applyThemeChoice(readThemeChoice())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <RouterProvider router={router} />
    </I18nProvider>
  </StrictMode>,
)
