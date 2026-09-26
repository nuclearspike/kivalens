// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useEffect, useState } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { I18nProvider } from '../i18n'
import { PortfolioCriteriaPanel } from './CriteriaTabs'
import type { Criteria } from '../types'

/**
 * Paul, 2026-09-26: turning on partner balancing ("balance partner risk") must switch
 * the search to MFI Only by itself; it only applies there, and a question in between
 * left it doing nothing. Direct Only was chosen on purpose, so there it still asks, and
 * a yes turns balancing on along with MFI Only.
 */

afterEach(cleanup)

type Update = (group: 'loan' | 'partner' | 'portfolio', key: string, value: unknown) => void
// The lender's answer to "switch to MFI Only?", applied the way CriteriaTabs applies it.
const answer = (yes: boolean) =>
  vi.fn(async (update: Update) => {
    if (yes) update('partner', 'direct', 'mfi')
    return yes
  })

let latest: Criteria
function Panel({ initial, ask }: { initial: Criteria; ask: (update: Update) => Promise<boolean> }) {
  const [criteria, setCriteria] = useState<Criteria>(initial)
  useEffect(() => {
    latest = criteria
  }, [criteria])
  // Functional, as CriteriaTabs' handleUpdate is: two updates in one step both land.
  const update: Update = (group, key, value) =>
    setCriteria((prev) => ({ ...prev, [group]: { ...prev[group], [key]: value } }) as Criteria)
  return (
    <I18nProvider>
      <MemoryRouter>
        <PortfolioCriteriaPanel criteria={criteria} onUpdate={update} onRequestMfiOnly={() => ask(update)} />
      </MemoryRouter>
    </I18nProvider>
  )
}

const withMode = (direct?: string, pbPartner?: object): Criteria =>
  ({ loan: {}, partner: direct ? { direct } : {}, portfolio: pbPartner ? { pb_partner: pbPartner } : {} }) as Criteria
// The balancers are listed partners first, then countries.
const partnersSwitch = () => screen.getAllByLabelText('Enable filter')[0]
const countriesSwitch = () => screen.getAllByLabelText('Enable filter')[1]
// A greyed section: its body is inert (a browser blocks clicks there; jsdom does not),
// and the section itself, named by its note, is what a click or a screen reader reaches.
const greyedSection = (note: RegExp) => screen.getByRole('button', { name: note })
// Whether a real click can reach the switch at all.
const reachable = (el: HTMLElement) => el.closest('[inert]') === null
const partner = () => latest.partner as Record<string, unknown>
const balancer = (key: string) => (latest.portfolio as Record<string, Record<string, unknown> | undefined>)[key]
// The lender's own settings; `values` is data the row refreshes from the portfolio.
const KEPT = { enabled: true, hideshow: 'show', ltgt: 'gt', percent: 25, allactive: 'active' }
const DEFAULTS = { enabled: true, hideshow: 'hide', ltgt: 'lt', percent: 10, allactive: 'all' }
// UnavailableSection awaits the answer before anything re-renders.
const settle = () => act(async () => {})

describe('balancing by partner', () => {
  it.each([
    ['Both chosen', withMode('both')],
    ['no mode stored', withMode()],
  ])('switches the search to MFI Only when turned on, without asking (%s)', async (_what, initial) => {
    const ask = answer(true)
    render(<Panel initial={initial} ask={ask} />)
    const hint = screen.getByText(/turning this on switches the search to MFI Only/)
    expect(partnersSwitch()).toHaveAccessibleDescription(hint.textContent!)
    // Under the switch, not above it: the hint goes once the search is MFI Only, and
    // going from above would pull the switch out from under the lender's click.
    expect(partnersSwitch().compareDocumentPosition(hint) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(reachable(partnersSwitch())).toBe(true)
    fireEvent.click(partnersSwitch())
    await settle()
    expect(balancer('pb_partner')).toMatchObject(DEFAULTS)
    expect(partner().direct).toBe('mfi')
    expect(ask).not.toHaveBeenCalled()
    expect(screen.queryByText(/turning this on switches the search to MFI Only/)).toBeNull()
  })

  it('asks from Direct Only, which was chosen on purpose; keeping Direct Only changes nothing', async () => {
    const ask = answer(false)
    render(<Panel initial={withMode('direct')} ask={ask} />)
    expect(reachable(partnersSwitch())).toBe(false)
    fireEvent.click(greyedSection(/Direct/))
    await settle()
    expect(ask).toHaveBeenCalledTimes(1)
    expect(partner().direct).toBe('direct')
    expect(balancer('pb_partner')?.enabled).not.toBe(true)
  })

  it('from Direct Only, a yes to MFI Only turns balancing on as well', async () => {
    const ask = answer(true)
    render(<Panel initial={withMode('direct')} ask={ask} />)
    fireEvent.click(greyedSection(/Direct/))
    await settle()
    expect(ask).toHaveBeenCalledTimes(1)
    expect(partner().direct).toBe('mfi')
    // The same settings the switch itself turns on with.
    expect(balancer('pb_partner')).toMatchObject(DEFAULTS)
    expect(reachable(partnersSwitch())).toBe(true)
    expect(partnersSwitch()).toBeChecked()
  })

  it('stays kept and greyed when the lender chose Both with balancing already on', async () => {
    const ask = answer(false)
    render(<Panel initial={withMode('both', KEPT)} ask={ask} />)
    expect(reachable(partnersSwitch())).toBe(false)
    fireEvent.click(greyedSection(/these apply when MFI Only is chosen above/))
    await settle()
    expect(ask).toHaveBeenCalledTimes(1)
    expect(partner().direct).toBe('both')
    expect(balancer('pb_partner')).toMatchObject(KEPT)
  })

  it('a kept balancer refreshing its data never changes the mode by itself', async () => {
    render(<Panel initial={withMode('both', KEPT)} ask={answer(true)} />)
    await settle()
    // The refresh did land (it writes the values it worked out)...
    expect(balancer('pb_partner')?.values).toEqual([])
    // ...and the lender's Both stands.
    expect(partner().direct).toBe('both')
  })

  it('kept balancing, once MFI Only is chosen, applies exactly as the lender set it', async () => {
    render(<Panel initial={withMode('both', KEPT)} ask={answer(true)} />)
    fireEvent.click(greyedSection(/these apply when MFI Only is chosen above/))
    await settle()
    expect(partner().direct).toBe('mfi')
    expect(balancer('pb_partner')).toMatchObject(KEPT)
  })

  it('turning balancing off again leaves MFI Only as it is', () => {
    render(<Panel initial={withMode('both')} ask={answer(true)} />)
    fireEvent.click(partnersSwitch())
    fireEvent.click(partnersSwitch())
    expect(balancer('pb_partner')?.enabled).toBe(false)
    expect(partner().direct).toBe('mfi')
  })

  it('leaves the mode alone for every other balancer', () => {
    render(<Panel initial={withMode('both')} ask={answer(true)} />)
    fireEvent.click(countriesSwitch())
    expect(balancer('pb_country')?.enabled).toBe(true)
    expect(partner().direct).toBe('both')
  })
})
