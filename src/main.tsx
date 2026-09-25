import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from './App'
import { I18nProvider } from './i18n'
import { applyThemeChoice, readThemeChoice } from './lib/theme'
import { installGlassLens } from './lib/glassLens'
import { COLLECTOR_URL, routeLabel, shouldMeasure } from './lib/rum/config'
import { installErrorReporting, takeErrors } from './lib/rum/errors'
import { makeViewId } from './lib/rum/payload'
import { send } from './lib/rum/send'
import 'rc-slider/assets/index.css'
import './styles/base/index.scss'
import './styles/main.scss'

// Real-user measurement (src/lib/rum): errors are caught from the very start, and
// the timing module loads once the page has painted. Only the public hosts report.
if (shouldMeasure()) {
  // Room for this site's own API requests among the loan photos until the timing
  // module starts observing (the browser's default holds 250 entries).
  try {
    performance.setResourceTimingBufferSize(1000)
  } catch {
    // not supported: some API timings may be missing
  }
  const view = makeViewId()
  const landing = routeLabel(location.pathname)
  installErrorReporting({
    route: () => routeLabel(location.pathname),
    flush: () => {
      const errors = takeErrors()
      if (errors.length) {
        send(COLLECTOR_URL, { v: 1, view, host: location.host, route: landing, version: __KL_VERSION__, final: false, errors })
      }
    },
  })
  const startMeasuring = () => {
    const idle = (cb: () => void) =>
      typeof requestIdleCallback === 'function' ? requestIdleCallback(cb, { timeout: 5000 }) : setTimeout(cb, 2000)
    idle(() => {
      void import('./lib/rum')
        .then((rum) => rum.startRum({ view, route: landing, version: __KL_VERSION__, collector: COLLECTOR_URL }))
        .catch(() => {})
    })
  }
  if (document.readyState === 'complete') startMeasuring()
  else addEventListener('load', startMeasuring, { once: true })
}

// public/theme-init.js already set <html data-theme> before first paint; this
// also brings the browser-chrome colour in line with a forced theme.
applyThemeChoice(readThemeChoice())
// Glass slider handles refract at the rim where the browser can render it.
installGlassLens()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <RouterProvider router={router} />
    </I18nProvider>
  </StrictMode>,
)
