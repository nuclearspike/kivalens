import { createHashRouter, Outlet, Navigate, ScrollRestoration } from 'react-router-dom'
import { useKivaLensInit } from './lib/useKivaLensInit'
import KLNav from './components/KLNav'
import KLFooter from './components/KLFooter'
import About from './components/About'
import ClearBasket from './components/ClearBasket'
import Outdated from './components/Outdated'
import Donate from './components/Donate'
import Options from './components/Options'
import Live from './components/Live'
import OnNow from './components/OnNow'
import Teams from './components/Teams'
import RouteErrorBoundary from './components/RouteErrorBoundary'
import SetLenderIDModal from './components/SetLenderIDModal'
import DialogHost from './components/DialogHost'

function AppLayout() {
  useKivaLensInit()

  return (
    <div>
      <KLNav />
      <SetLenderIDModal />
      <DialogHost />
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
      { path: 'options', element: <Options /> },
      { path: 'about', element: <About /> },
      { path: 'live', element: <Live /> },
      { path: 'on', element: <OnNow /> },
      { path: 'donate', element: <Donate /> },
      { path: 'teams', element: <Teams /> },
      { path: 'clear-basket', element: <ClearBasket /> },
      { path: 'outdated', element: <Outdated /> },
      { path: '*', element: <Navigate to="/search" replace /> },
    ],
  },
])
