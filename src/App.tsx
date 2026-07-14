/* eslint-disable react-refresh/only-export-components -- this route module intentionally exports the router alongside route components. */
import { lazy, Suspense } from 'react'
import { createHashRouter, Outlet, Navigate, ScrollRestoration } from 'react-router-dom'
import { useKivaLensInit } from './lib/useKivaLensInit'
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
      {t('Loading…')}
    </div>
  )
}

function AppLayout() {
  useKivaLensInit()

  return (
    <div>
      <KLNav />
      <SetLenderIDModal />
      <DialogHost />
      <Suspense fallback={null}>
        <AskKivaLens />
      </Suspense>
      <AICallout />
      <Outlet />
      <KLFooter />
      <ScrollRestoration />
    </div>
  )
}

export const router = createHashRouter([
  {
    path: '/',
    element: <AppLayout />,
    errorElement: <RouteErrorBoundary />,
    // Shown during the brief initial chunk fetch for the matched lazy route.
    // Without it, the data router renders null during hydration and React
    // Router logs a (non-dev-gated) "No HydrateFallback" warning even in prod.
    hydrateFallbackElement: <RouteLoading />,
    children: [
      { index: true, element: <Navigate to="/search" replace /> },
      {
        path: 'search',
        lazy: () => import('./components/Search').then(m => ({ Component: m.default })),
      },
      {
        // Deep link renders the Search page with the loan pre-selected in
        // the right panel, like the old app's nested route.
        path: 'search/loan/:id',
        lazy: () => import('./components/Search').then(m => ({ Component: m.default })),
      },
      {
        path: 'basket',
        lazy: () => import('./components/Basket').then(m => ({ Component: m.default })),
      },
      {
        path: 'partners',
        lazy: () => import('./components/Partners'),
      },
      {
        // Deep link renders the Partners page with the partner pre-selected
        path: 'partners/:id',
        lazy: () => import('./components/Partners'),
      },
      {
        path: 'saved',
        lazy: () => import('./components/SavedSearches').then(m => ({ Component: m.default })),
      },
      {
        path: 'portfolio',
        lazy: () => import('./components/SnowStack'),
      },
      {
        path: 'autolend',
        lazy: () => import('./components/AutoLendSettings'),
      },
      { path: 'options', lazy: () => import('./components/Options').then(m => ({ Component: m.default })) },
      { path: 'about', lazy: () => import('./components/About').then(m => ({ Component: m.default })) },
      { path: 'privacy', lazy: () => import('./components/Privacy').then(m => ({ Component: m.default })) },
      { path: 'live', lazy: () => import('./components/Live').then(m => ({ Component: m.default })) },
      { path: 'on', lazy: () => import('./components/OnNow').then(m => ({ Component: m.default })) },
      { path: 'donate', lazy: () => import('./components/Donate').then(m => ({ Component: m.default })) },
      { path: 'teams', lazy: () => import('./components/Teams').then(m => ({ Component: m.default })) },
      { path: 'clear-basket', lazy: () => import('./components/ClearBasket').then(m => ({ Component: m.default })) },
      { path: 'outdated', lazy: () => import('./components/Outdated').then(m => ({ Component: m.default })) },
      { path: '*', element: <Navigate to="/search" replace /> },
    ],
  },
])
