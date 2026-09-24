/* eslint-disable react-refresh/only-export-components -- this route module intentionally exports the router alongside route components. */
import { lazy, Suspense } from 'react'
import {
  createBrowserRouter,
  Outlet,
  Navigate,
  ScrollRestoration,
  useLocation,
} from 'react-router-dom'
import { ROUTES, HOME, resolveLegacyUrl, formatUrl, type RouteId } from '../server/routeMap.mjs'
import { useKivaLensInit } from './lib/useKivaLensInit'
import { usePageMeta } from './lib/usePageMeta'
import KLNav from './components/KLNav'
import KLFooter from './components/KLFooter'
import RouteErrorBoundary from './components/RouteErrorBoundary'
import SetLenderIDModal from './components/SetLenderIDModal'
import DialogHost from './components/DialogHost'
import AICallout from './components/AICallout'
import { useI18n } from './i18n'

// The assistant pulls in markdown and charting libraries. Load that feature only
// after the app shell so first paint is not coupled to the heaviest dependencies.
const AskKivaLens = lazy(() => import('./components/AskKivaLens/AskKivaLens'))

function RouteLoading() {
  const { t } = useI18n()
  return (
    <div className="d-flex align-items-center justify-content-center text-muted" style={{ height: '100vh' }}>
      {t('loading_ellipsis')}
    </div>
  )
}

function AppLayout() {
  useKivaLensInit()
  usePageMeta()

  return (
    <div>
      <KLNav />
      <SetLenderIDModal />
      <DialogHost />
      <Suspense fallback={null}>
        <AskKivaLens />
      </Suspense>
      <AICallout />
      <main className="kl-main">
        <Outlet />
      </main>
      <KLFooter />
      <ScrollRestoration />
    </div>
  )
}

/**
 * Anything the router does not recognise. A retired address is rewritten to
 * where it belongs — `/live` to `/stats`, `/search/loan/42` to `/loans/42` —
 * which catches a link followed after the app has already started, where
 * public/boot.js and the server's redirects no longer get a say. An address
 * naming nothing lands on Search.
 */
function LegacyRedirect() {
  const location = useLocation()
  const resolved = resolveLegacyUrl(location)
  return <Navigate to={resolved ? formatUrl(resolved) : HOME} replace />
}

type Loader = () => Promise<{ Component: React.ComponentType }>

const fromDefault = (load: () => Promise<{ default: React.ComponentType }>): Loader => () =>
  load().then((m) => ({ Component: m.default }))

/**
 * The page behind each route id. ROUTES (server/routeMap.mjs) owns the URLs;
 * this owns what renders at them, and src/App.test.tsx fails if the two ever
 * name a different set of pages.
 *
 * Search renders `loan` as well: a loan shows in the right-hand panel beside the
 * results, and the path is what selects it. Partners and the Basket pair with
 * `partner` and `basketLoan` the same way.
 */
export const PAGES: Record<RouteId, Loader> = {
  search: fromDefault(() => import('./components/Search')),
  loan: fromDefault(() => import('./components/Search')),
  partners: () => import('./components/Partners'),
  partner: () => import('./components/Partners'),
  basket: fromDefault(() => import('./components/Basket')),
  basketLoan: fromDefault(() => import('./components/Basket')),
  saved: fromDefault(() => import('./components/SavedSearches')),
  stats: fromDefault(() => import('./components/Stats')),
  wall: () => import('./components/SnowStack'),
  teams: fromDefault(() => import('./components/Teams')),
  options: fromDefault(() => import('./components/Options')),
  about: fromDefault(() => import('./components/About')),
  privacy: fromDefault(() => import('./components/Privacy')),
  autolend: () => import('./components/AutoLendSettings'),
  donate: fromDefault(() => import('./components/Donate')),
  outdated: fromDefault(() => import('./components/Outdated')),
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    errorElement: <RouteErrorBoundary />,
    // Shown during the brief initial chunk fetch for the matched lazy route.
    // Without it, the data router renders null during hydration and React
    // Router logs a (non-dev-gated) "No HydrateFallback" warning even in prod.
    hydrateFallbackElement: <RouteLoading />,
    children: [
      { index: true, element: <Navigate to={HOME} replace /> },
      ...ROUTES.map((route) => ({
        path: route.path.replace(/^\//, ''),
        lazy: PAGES[route.id],
      })),
      { path: '*', element: <LegacyRedirect /> },
    ],
  },
])
