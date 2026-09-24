// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach } from 'vitest'
import Basket from './Basket'
import { useLoanStore } from '../stores'
import { matchRoute, ROUTES } from '../../server/routeMap.mjs'
import { PAGES } from '../App'

/**
 * Paul: "i want /basket to have /basket/:loan_id as well. i've always missed
 * that." The basket is a list with a loan open beside it, exactly as Search is,
 * so it gets the same kind of address.
 */

const basket = readFileSync(path.join(process.cwd(), 'src/components/Basket.tsx'), 'utf8')
const row = readFileSync(path.join(process.cwd(), 'src/components/BasketListItem.tsx'), 'utf8')

describe('a loan open in the basket has an address', () => {
  it('is /basket/:id, named like the loan and partner routes', () => {
    expect(ROUTES.find((r) => r.id === 'basketLoan')).toEqual({
      id: 'basketLoan',
      path: '/basket/:id',
      param: 'id',
    })
    expect(matchRoute('/basket/2549812')).toEqual({ id: 'basketLoan', param: '2549812' })
    expect(matchRoute('/basket')).toEqual({ id: 'basket', param: null })
  })

  it('renders the basket itself, so the list stays beside the loan', async () => {
    const [withLoan, plain] = await Promise.all([PAGES.basketLoan(), PAGES.basket()])
    expect(withLoan.Component).toBe(plain.Component)
  })

  it('takes which loan is open from the address, not from its own memory', () => {
    expect(basket).toMatch(/const \{ id: routeLoanId \} = useParams<\{ id: string \}>\(\)/)
    expect(basket).toMatch(/const selectedId = routeLoanId \? parseInt\(routeLoanId, 10\) : null/)
    // No second copy of the answer to drift from the address.
    expect(basket).not.toMatch(/setSelectedId/)
  })

  it('opens a row by going to its address, and closes without stacking history', () => {
    expect(basket).toMatch(/navigate\(id === null \? '\/basket' : `\/basket\/\$\{id\}`, \{ replace: id === null \}\)/)
    // Opening a loan is a place to come back to; closing one is not.
    for (const close of ['clearBasket()', 'removeFromBasket(selectedId)']) {
      const after = basket.slice(basket.indexOf(close), basket.indexOf(close) + 120)
      expect(after).toContain('showBasket(null)')
    }
  })

  it('reads which loan is open, and closes the panel, from the stored basket', () => {
    expect(basket).toMatch(/s\.basket\.some\(\(item\) => item\.loan_id === selectedId\)/)
    expect(basket).toMatch(/if \(selectedId != null && !inBasketIds\) showBasket\(null\)/)
  })
})

describe('the basket row', () => {
  it('stays a button, because it holds the amount select and the remove control', () => {
    // An anchor may not contain those, so the row cannot be a Link the way a
    // search result row is.
    expect(row).toContain('role="button"')
    expect(row).not.toMatch(/<Link/)
  })

  it('opens from the keyboard, as anything calling itself a button must', () => {
    expect(row).toMatch(/onKeyDown=/)
    expect(row).toMatch(/e\.key === 'Enter' \|\| e\.key === ' '/)
    // A key pressed inside the amount select is that control's, not the row's.
    expect(row).toMatch(/if \(e\.target !== e\.currentTarget\) return/)
  })
})

function Address() {
  return <output data-testid="address">{useLocation().pathname}</output>
}

const openBasketAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Address />
      <Routes>
        <Route path="/basket" element={<Basket />} />
        <Route path="/basket/:id" element={<Basket />} />
      </Routes>
    </MemoryRouter>,
  )

afterEach(() => {
  cleanup()
  useLoanStore.setState({ basket: [] })
})

describe('an address opened cold, before any loan has arrived', () => {
  it('stays open while its loan is still on the way', () => {
    // The basket is in the browser from the first render; the loans behind it
    // are not. Judged against the hydrated rows, a link someone was sent closed
    // itself before its loan ever loaded — the one case a link has to survive.
    useLoanStore.setState({ basket: [{ loan_id: 3227915, amount: 25 }], loans: [] })
    openBasketAt('/basket/3227915')
    expect(screen.getByTestId('address').textContent).toBe('/basket/3227915')
  })

  it('closes the panel when the open loan is taken out of the basket', () => {
    useLoanStore.setState({ basket: [{ loan_id: 3227915, amount: 25 }], loans: [] })
    openBasketAt('/basket/3227915')
    expect(screen.getByTestId('address').textContent).toBe('/basket/3227915')
    act(() => useLoanStore.setState({ basket: [] }))
    expect(screen.getByTestId('address').textContent).toBe('/basket')
  })

  it('still falls back when the loan really is not in the basket', () => {
    useLoanStore.setState({ basket: [{ loan_id: 111, amount: 25 }], loans: [] })
    openBasketAt('/basket/3227915')
    expect(screen.getByTestId('address').textContent).toBe('/basket')
  })
})

describe('the repayment breakdown', () => {
  it('names the band under the pointer and opens that same loan', () => {
    // One series object supplies both, so the hint and the click can never name
    // different loans.
    const start = basket.indexOf('series.map((s) => (')
    const bar = basket.slice(start, basket.indexOf('/>', basket.indexOf('onClick={() => onSelectLoan')))
    for (const fromTheSameSeries of [
      'dataKey={`byLoan.${s.key}`}',
      'fill={s.color}',
      'name={s.name}',
      'key: s.key,',
      'onClick={() => onSelectLoan(s.id)}',
    ]) {
      expect(bar).toContain(fromTheSameSeries)
    }
  })

  it('opens the loan at its own address, so the band is a link in every way but shape', () => {
    expect(basket).toContain('onSelectLoan={showBasket}')
  })

  it('is off until asked for, and then remembered', () => {
    expect(basket).toContain("localStorage.getItem(BREAK_DOWN_KEY) === 'true'")
    expect(basket).toContain("localStorage.setItem(BREAK_DOWN_KEY, String(next))")
  })

  it('keeps thirty loans out of the legend', () => {
    // Thirty legend entries would bury the chart; the hint names one at a time.
    expect(basket).toContain('legendType="none"')
  })

  it('leaves the single-bar chart exactly as it was when the box is unchecked', () => {
    const plain = basket.slice(basket.indexOf('/* no barSize'))
    expect(plain.slice(0, 500)).toContain('dataKey="amount"')
    expect(plain.slice(0, 500)).toContain('fill="#e8871a"')
  })
})

describe('the breakdown hint', () => {
  it('lets go of a band when the pointer leaves it, not only the chart', () => {
    // Clearing only on the chart's own mouse leave left the hint naming a band
    // the pointer had already moved off, with that band's month and amount.
    const bar = basket.slice(basket.indexOf('series.map((s) => ('), basket.indexOf('onClick={() => onSelectLoan'))
    expect(bar).toContain('onMouseLeave={() => hoverStore.set(null)}')
  })

  it('still shows the month and the running total when no band is under the pointer', () => {
    // Reading the cumulative line was possible before the breakdown existed and
    // the breakdown must not cost it.
    const hint = basket.slice(basket.indexOf('function StackHint'), basket.indexOf('function BasketRepaymentChart'))
    // The month branch has to be REACHABLE: the only way out before it is the
    // one guard for a row that does not exist.
    const afterBand = hint.slice(hint.indexOf('// Off a band'))
    expect(afterBand.match(/return null/g)).toEqual(['return null'])
    expect(afterBand).toMatch(/if \(!row\) return null/)
    expect(afterBand).toContain('kl-stack-hint-month')
    expect(afterBand).toContain('currency(row.amount, 2)')
    expect(afterBand).toContain('currency(row.cumulativeAmount, 2)')
  })
})

describe('pressing a band opens its loan, however the pointer got there', () => {
  // Paul: "clicking it doesn't select the loan." The band under the pointer was
  // kept in React state, so entering one re-rendered the chart, and Recharts
  // replaces its bar elements when it re-renders (measured: 13 of 17). The
  // pointer came onto the chart and pressed in one motion, the bar was swapped
  // between mousedown and mouseup, and the browser — which only delivers a
  // click when both land on the same element — delivered nothing. Measured in
  // a real browser, pointer coming from elsewhere on the page: before 5 of 5
  // presses dropped, after 5 of 5 opened the right loan.
  const chart = basket.slice(
    basket.indexOf('function BasketRepaymentChart'),
    basket.indexOf('export default function Basket'),
  )

  it('keeps the band under the pointer out of the chart’s own state', () => {
    expect(chart).not.toMatch(/useState<[^>]*(key|month|amount)[^>]*>\(null\)/)
    expect(chart).not.toContain('setHovered')
    expect(chart).toContain('createPointerStore<HoveredBand>')
    // Compared on the amount too, so a refresh under a still pointer shows.
    expect(chart).toContain('a.amount === b.amount')
  })

  it('writes the band from the bars to the store, never to state', () => {
    const bar = chart.slice(chart.indexOf('series.map((s) => ('), chart.indexOf('onClick={() => onSelectLoan'))
    expect(bar).toContain('hoverStore.set({')
    expect(bar).toContain('onMouseLeave={() => hoverStore.set(null)}')
  })

  it('lets only the hint read the band, so only the hint re-renders', () => {
    const hint = basket.slice(basket.indexOf('function StackHint'), basket.indexOf('function BasketRepaymentChart'))
    expect(hint).toContain('usePointerValue(store)')
    expect(chart).toContain('store={hoverStore}')
  })
})
