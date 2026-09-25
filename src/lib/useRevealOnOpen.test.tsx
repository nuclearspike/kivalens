// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StrictMode } from 'react'
import { act, cleanup, render } from '@testing-library/react'
import { createMemoryRouter, Outlet, RouterProvider, ScrollRestoration } from 'react-router-dom'
import {
  OPEN_INTENT_MS,
  SETTLE_MS,
  markOpenIntent,
  takeOpenIntent,
  takeOpenIntentFor,
  useRevealOnOpen,
} from './useRevealOnOpen'
import { scrollKeyFor } from '../App'
import { pageOf } from '../../server/routeMap.mjs'

describe('an open the lender made', () => {
  it('counts while fresh, and only once', () => {
    markOpenIntent(1000)
    expect(takeOpenIntent(1000 + OPEN_INTENT_MS)).toBe(true)
    expect(takeOpenIntent(1000 + OPEN_INTENT_MS)).toBe(false)
  })

  it('does not reach a move made later some other way', () => {
    markOpenIntent(1000)
    expect(takeOpenIntent(1001 + OPEN_INTENT_MS)).toBe(false)
  })

  it('is nothing until one is made', () => {
    expect(takeOpenIntent()).toBe(false)
  })

  it('answers the same for one history entry asked twice at once, as StrictMode does', () => {
    markOpenIntent(1000)
    expect(takeOpenIntentFor('entry-a', 1000)).toBe(true)
    expect(takeOpenIntentFor('entry-a', 1001)).toBe(true)
    // Another entry does not inherit it.
    expect(takeOpenIntentFor('entry-b', 1002)).toBe(false)
  })

  it('does not say yes again for an entry revisited later', () => {
    markOpenIntent(1000)
    expect(takeOpenIntentFor('entry-c', 1000)).toBe(true)
    expect(takeOpenIntentFor('entry-c', 1001 + OPEN_INTENT_MS)).toBe(false)
  })
})

/**
 * A page with a panel whose top sits at `panelTop` in an 800px window: the
 * stacked phone layout puts it below the list, near or past the bottom edge.
 */
function renderPanelPage(initialTop: number) {
  let panelTop = initialTop
  function Page() {
    const ref = useRevealOnOpen<HTMLDivElement>()
    return (
      <div
        ref={(el) => {
          ref.current = el
          if (el) el.getBoundingClientRect = () => ({ top: panelTop }) as DOMRect
        }}
      />
    )
  }
  const router = createMemoryRouter([{ path: '/basket/:id?', element: <Page /> }], {
    initialEntries: ['/basket'],
  })
  render(<RouterProvider router={router} />)
  return Object.assign(router, { movePanel: (top: number) => (panelTop = top) })
}

describe('a panel the lender opens something into', () => {
  let scrollTo: ReturnType<typeof vi.fn>

  beforeEach(() => {
    scrollTo = vi.fn()
    vi.stubGlobal('scrollTo', scrollTo)
    vi.stubGlobal('innerHeight', 800)
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    takeOpenIntent()
  })

  it('comes into view after their own open', async () => {
    const router = renderPanelPage(700)
    markOpenIntent()
    await act(() => router.navigate('/basket/7'))
    expect(scrollTo).toHaveBeenCalledTimes(1)
    expect(scrollTo.mock.calls[0][0]).toMatchObject({ top: 700 })
  })

  it('stays put when the address changed under them', async () => {
    const router = renderPanelPage(700)
    await act(() => router.navigate('/basket/7'))
    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('stays put when it is already in view', async () => {
    const router = renderPanelPage(40)
    markOpenIntent()
    await act(() => router.navigate('/basket/7'))
    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('still shows the loan when the one opened is the one already open', async () => {
    const router = renderPanelPage(700)
    await act(() => router.navigate('/basket/7'))
    markOpenIntent()
    await act(() => router.navigate('/basket/7'))
    expect(scrollTo).toHaveBeenCalledTimes(1)
  })
})

describe('a panel still filling in when it opens', () => {
  // The loan renders a moment after its address changes; until then the page
  // can be too short for the first scroll to lift the panel all the way.
  let scrollTo: ReturnType<typeof vi.fn>
  let resized: (() => void) | null
  let disconnected: boolean

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    scrollTo = vi.fn()
    resized = null
    disconnected = false
    vi.stubGlobal('scrollTo', scrollTo)
    vi.stubGlobal('innerHeight', 800)
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(cb: () => void) {
          resized = cb
        }
        observe() {}
        disconnect() {
          disconnected = true
        }
      },
    )
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.unstubAllGlobals()
    takeOpenIntent()
  })

  it('keeps lifting it while it grows, then lets go', async () => {
    const router = renderPanelPage(700)
    markOpenIntent()
    await act(() => router.navigate('/basket/7'))
    expect(scrollTo).toHaveBeenCalledTimes(1)
    // The first scroll stopped short: the panel is still in the lower half.
    router.movePanel(600)
    resized?.()
    expect(scrollTo).toHaveBeenCalledTimes(2)
    vi.advanceTimersByTime(SETTLE_MS)
    expect(disconnected).toBe(true)
  })

  it('still follows under StrictMode, which runs a mounting effect twice', async () => {
    let live = 0
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {
          live += 1
        }
        disconnect() {
          live -= 1
        }
      },
    )
    function Page() {
      const ref = useRevealOnOpen<HTMLDivElement>()
      return <div ref={ref} />
    }
    const router = createMemoryRouter([{ path: '/basket/:id?', element: <Page /> }], {
      initialEntries: ['/basket/7'],
    })
    markOpenIntent()
    render(
      <StrictMode>
        <RouterProvider router={router} />
      </StrictMode>,
    )
    expect(live).toBe(1)
  })

  it('stops the moment the lender scrolls for themselves', async () => {
    const router = renderPanelPage(700)
    markOpenIntent()
    await act(() => router.navigate('/basket/7'))
    window.dispatchEvent(new Event('wheel'))
    expect(disconnected).toBe(true)
  })

  it('follows nothing when the address changed under them', async () => {
    const router = renderPanelPage(700)
    await act(() => router.navigate('/basket/7'))
    expect(resized).toBeNull()
  })
})

describe('scroll position belongs to a page', () => {
  it('names the page each address shows', () => {
    expect(pageOf('/loans/42')).toBe('search')
    expect(pageOf('/search')).toBe('search')
    expect(pageOf('/partners/9')).toBe('partners')
    expect(pageOf('/basket/7')).toBe('basket')
    expect(pageOf('/stats')).toBe('stats')
    expect(pageOf('/nowhere')).toBeNull()
  })

  it('keys an address no route claims on its own history entry', () => {
    expect(scrollKeyFor({ pathname: '/loans/42', key: 'abc' })).toBe('search')
    expect(scrollKeyFor({ pathname: '/nowhere', key: 'abc' })).toBe('abc')
  })

  describe('through the router', () => {
    let scrollTo: ReturnType<typeof vi.fn>
    let y = 0

    beforeEach(() => {
      y = 0
      scrollTo = vi.fn((_x: number, top: number) => {
        y = top
      })
      vi.stubGlobal('scrollTo', scrollTo)
      Object.defineProperty(window, 'scrollY', { configurable: true, get: () => y })
      sessionStorage.clear()
    })
    afterEach(() => {
      cleanup()
      vi.unstubAllGlobals()
    })

    function renderApp() {
      function Layout() {
        return (
          <>
            <Outlet />
            <ScrollRestoration getKey={scrollKeyFor} />
          </>
        )
      }
      const page = () => <div />
      const router = createMemoryRouter(
        [
          {
            path: '/',
            element: <Layout />,
            children: [
              { path: 'search', Component: page },
              { path: 'loans/:id', Component: page },
              { path: 'stats', Component: page },
            ],
          },
        ],
        { initialEntries: ['/search'] },
      )
      render(<RouterProvider router={router} />)
      return router
    }

    it('stays where the lender was reading when a loan opens beside the results', async () => {
      const router = renderApp()
      y = 900
      scrollTo.mockClear()
      await act(() => router.navigate('/loans/42'))
      await act(() => router.navigate('/loans/43'))
      await act(() => router.navigate('/search?sector=Food'))
      expect(y).toBe(900)
      expect(scrollTo).not.toHaveBeenCalledWith(0, 0)
    })

    it('starts another page at its top', async () => {
      const router = renderApp()
      y = 900
      await act(() => router.navigate('/stats'))
      expect(y).toBe(0)
    })

    it('comes back to a page where the lender left it', async () => {
      const router = renderApp()
      y = 900
      await act(() => router.navigate('/stats'))
      await act(() => router.navigate('/loans/42'))
      expect(y).toBe(900)
    })
  })
})
