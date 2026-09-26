// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { I18nProvider } from '../i18n'
import BasketMix, { BasketSpreadLine } from './BasketMix'
import { buildBasketMix, concentrationWarnings, DEFAULT_LIMITS, type ActiveExposure, type MixFilter } from '../lib/basketMix'
import type { ExposureState } from '../lib/useActiveExposure'
import type { BasketEntry } from '../stores'
import type { KivaLoan, Partner } from '../types'

/**
 * Paul, 2026-09-26: beside the repayment chart, graphs of the basket by partner,
 * country, sector, activity and more — a graph only where there is more than one
 * value, otherwise one thin line saying so — and partner-heavy or country-heavy
 * baskets called out as dangerous.
 */

afterEach(cleanup)

const partners: Record<number, Partial<Partner>> = {
  10: { id: 10, name: 'Juhudi Kilimo', rating: '3.5' },
  20: { id: 20, name: 'Low Stars MFI', rating: '1.5' },
  30: { id: 30, name: 'Unrated MFI', rating: 'Not Rated' },
  40: { id: 40, name: 'Five Star', rating: '5.0' },
}
const partnerOf = (id: number) => (partners[id] ?? { id, name: `P${id}`, rating: '4.0' }) as Partner

let nextId = 1
const entry = (partnerId: number | null, country = 'Kenya', sector = 'Retail', activity = 'Clothing Sales'): BasketEntry => {
  const id = nextId++
  return { id, amount: 25, loan: { id, partner_id: partnerId, sector, activity, location: { country, country_code: 'XX' } } as unknown as KivaLoan }
}
const times = (n: number, make: () => BasketEntry) => Array.from({ length: n }, make)

const ready = (exposure: ActiveExposure = { partner: new Map(), country: new Map() }): ExposureState => ({ status: 'ready', exposure })

function show(
  entries: BasketEntry[],
  { exposure = ready(), filter = null, onFilter = vi.fn() }: { exposure?: ExposureState; filter?: MixFilter | null; onFilter?: (f: MixFilter | null) => void } = {},
) {
  const mix = buildBasketMix(entries, partnerOf)
  const warnings = concentrationWarnings(mix, exposure.status === 'ready' ? exposure.exposure : null, DEFAULT_LIMITS)
  render(
    <I18nProvider>
      <MemoryRouter>
        <BasketMix mix={mix} warnings={warnings} exposure={exposure} limits={DEFAULT_LIMITS} filter={filter} onFilter={onFilter} />
      </MemoryRouter>
    </I18nProvider>,
  )
  return { mix, warnings, onFilter }
}

const row = (name: RegExp) => screen.getByRole('button', { name })
// A sentence whose partner name is a link, matched as the paragraph reads.
const sentence = (text: string) => screen.getByText((_, el) => el?.tagName === 'P' && el.textContent === text)

describe('the breakdown', () => {
  it('draws a dimension with several values as rows, and one with a single value as one line', () => {
    show([...times(3, () => entry(10, 'Kenya')), ...times(2, () => entry(40, 'Uganda'))])
    expect(screen.getByRole('group', { name: 'By Field Partner' })).toBeInTheDocument()
    // Read as one name by a screen reader, so its parts are spaced.
    expect(screen.getByRole('button', { name: 'Juhudi Kilimo 3.5 stars 3 loans · 60%' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Five Star 5 stars 2 loans · 40%' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'By Country' })).toBeInTheDocument()
    // All Retail and all Clothing Sales: a line each, not a graph of one bar.
    expect(screen.getByText('Sector: Retail, all 5 loans')).toBeInTheDocument()
    expect(screen.getByText('Activity: Clothing Sales, all 5 loans')).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'By Sector' })).toBeNull()
  })

  it('names partner ratings as stars, then partners Kiva has not rated, then direct loans', () => {
    show([entry(40), entry(20), entry(30), entry(null, 'United States')])
    const ratings = within(screen.getByRole('group', { name: 'By Partner Risk Rating' })).getAllByRole('button')
    expect(ratings.map((b) => b.querySelector('.kl-mix-name')?.textContent)).toEqual([
      '5 stars',
      '1.5 stars',
      'Not rated by Kiva',
      'Direct loans (no field partner)',
    ])
    // A partner row carries its rating beside the name.
    expect(row(/Low Stars MFI/)).toHaveTextContent('1.5 stars')
  })

  it('shows a one-star rating in the singular', () => {
    partners[50] = { id: 50, name: 'One Star', rating: '1.0' }
    show([entry(50), entry(40)])
    expect(row(/One Star/)).toHaveTextContent(/1 star(?!s)/)
  })

  it('narrows the basket list to a row’s loans, and lifts it when the row is chosen again', () => {
    const onFilter = vi.fn()
    show([entry(10), entry(40)], { onFilter })
    fireEvent.click(row(/Juhudi Kilimo/))
    expect(onFilter).toHaveBeenLastCalledWith({ dimension: 'partner', key: 'p10' })
    cleanup()
    const again = vi.fn()
    show([entry(10), entry(40)], { onFilter: again, filter: { dimension: 'partner', key: 'p10' } })
    expect(row(/Juhudi Kilimo/)).toHaveAttribute('aria-pressed', 'true')
    expect(row(/Five Star/)).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(row(/Juhudi Kilimo/))
    expect(again).toHaveBeenLastCalledWith(null)
  })

  it('shows the first eight rows and the rest on request', () => {
    show(Array.from({ length: 10 }, (_, i) => entry(10, `Country ${i}`)))
    const countries = () => screen.getByRole('group', { name: 'By Country' }).querySelectorAll('.kl-mix-row')
    expect(countries()).toHaveLength(8)
    fireEvent.click(screen.getByRole('button', { name: 'Show 2 more' }))
    expect(countries()).toHaveLength(10)
    fireEvent.click(screen.getByRole('button', { name: 'Show fewer' }))
    expect(countries()).toHaveLength(8)
  })

  it('has nothing to break down in a one-loan basket', () => {
    show([entry(10)])
    expect(screen.queryByText(/all 1 loans/)).toBeNull()
    expect(screen.queryByRole('group')).toBeNull()
  })

  it('says where the limits come from and links to changing them', () => {
    show([entry(10), entry(40)])
    expect(screen.getByText(/You’re warned past 5 loans with one field partner or 25 in one country/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Change this in Options' })).toHaveAttribute('href', '/options#basket-warnings')
  })
})

describe('the warnings', () => {
  it('calls out a field partner holding more than five of the basket’s loans', () => {
    show(times(6, () => entry(10)))
    expect(screen.getByText('Heavy on one field partner')).toBeInTheDocument()
    expect(sentence('Juhudi Kilimo: 6 loans in this basket.')).toBeInTheDocument()
    // The partner's name opens its page, to see why Kiva rates it as it does.
    expect(screen.getByRole('link', { name: 'Juhudi Kilimo' })).toHaveAttribute('href', '/partners/10')
    expect(screen.getByText(/If a field partner fails, repayments on all of its loans can stop at once\./)).toBeInTheDocument()
    // Amber: Kiva rates it 3.5 stars.
    expect(screen.getByText('Heavy on one field partner').closest('.alert')).toHaveClass('alert-warning')
    expect(screen.getByText('Heavy on one field partner').closest('.alert')).not.toHaveTextContent('Kiva rates it')
    // One partner: its breakdown is a single line, not a row.
    expect(screen.getByText('Field partner: Juhudi Kilimo, all 6 loans')).toBeInTheDocument()
  })

  it('is red, naming the rating, for a partner Kiva rates below 3 stars', () => {
    show([...times(6, () => entry(20)), entry(40)])
    const alert = screen.getByText('Heavy on one field partner').closest('.alert')!
    expect(alert).toHaveClass('alert-danger')
    expect(alert).toHaveTextContent('Kiva rates it 1.5 out of 5 stars, on the risky end of its scale.')
    // Its row is marked in the warning's own colour.
    expect(row(/Low Stars MFI/)).toHaveClass('is-warned', 'is-danger')
    expect(row(/Five Star/)).not.toHaveClass('is-warned')
  })

  it('is red, saying so, for a partner Kiva has not rated', () => {
    show(times(6, () => entry(30)))
    const alert = screen.getByText('Heavy on one field partner').closest('.alert')!
    expect(alert).toHaveClass('alert-danger')
    expect(alert).toHaveTextContent('Kiva has not rated it, so its risk is unknown.')
  })

  it('counts the loans the lender already has with that partner, and says so', () => {
    const exposure = ready({ partner: new Map([['10', 4]]), country: new Map() })
    show([entry(10), entry(10), entry(40)], { exposure })
    expect(sentence('Juhudi Kilimo: 2 in this basket and 4 you already have, 6 loans in all.')).toBeInTheDocument()
  })

  it('calls out a country holding more than 25 of the lender’s loans', () => {
    const exposure = ready({ partner: new Map(), country: new Map([['Kenya', 24]]) })
    show([entry(10, 'Kenya'), entry(40, 'Kenya'), entry(40, 'Uganda')], { exposure })
    expect(screen.getByText('Heavy on one country')).toBeInTheDocument()
    expect(sentence('Kenya: 2 in this basket and 24 you already have, 26 loans in all.')).toBeInTheDocument()
    // A country has no page of its own to open.
    expect(screen.queryByRole('link', { name: 'Kenya' })).toBeNull()
    expect(screen.getByText(/A political or economic crisis or a natural disaster there can hit all of them at once\./)).toBeInTheDocument()
  })

  it('never calls out a sector, however much of the basket it holds', () => {
    show(times(12, () => entry(null, 'United States', 'Retail')).map((e, i) => ({ ...e, loan: { ...e.loan!, partner_id: 100 + i } as KivaLoan })))
    expect(screen.queryByText(/Heavy on/)).toBeNull()
    expect(screen.getByText('Sector: Retail, all 12 loans')).toBeInTheDocument()
  })

  it('narrows the list to the warning’s loans', () => {
    const onFilter = vi.fn()
    show([...times(6, () => entry(20)), entry(40)], { onFilter })
    // The count says it is these six, not the whole basket.
    fireEvent.click(screen.getByRole('button', { name: 'Show these 6 loans' }))
    expect(onFilter).toHaveBeenCalledWith({ dimension: 'partner', key: 'p20' })
  })

  it('offers the one loan by itself when that is all the basket adds', () => {
    const exposure = ready({ partner: new Map([['20', 9]]), country: new Map() })
    show([entry(20), entry(40)], { exposure })
    expect(screen.getByRole('button', { name: 'Show this loan' })).toBeInTheDocument()
  })
})

describe('while the lender’s active loans are read from Kiva', () => {
  it('is one line until they arrive, so no warning lands above rows the lender may press', () => {
    show(times(6, () => entry(20)), { exposure: { status: 'loading' } })
    expect(screen.getByText('Checking your active loans on Kiva…')).toBeInTheDocument()
    expect(screen.queryByText(/Heavy on/)).toBeNull()
    expect(screen.queryByRole('group')).toBeNull()
    expect(screen.queryByText(/Field partner:/)).toBeNull()
  })

  it('says only the basket was counted when Kiva could not be read', () => {
    show([entry(10), entry(40)], { exposure: { status: 'failed' } })
    expect(screen.getByText('Couldn’t read your active loans from Kiva, so only this basket is counted.')).toBeInTheDocument()
  })

  it('without a lender ID, says only the basket is counted and offers to set one', () => {
    show([entry(10), entry(40)], { exposure: { status: 'none' } })
    expect(screen.getByText(/Only this basket is counted\./)).toHaveTextContent(
      'Only this basket is counted. Set your Lender ID to count the loans you already have too.',
    )
    expect(screen.getByRole('button', { name: 'Set your Lender ID' })).toBeInTheDocument()
  })

  it('says nothing about counting once they are in', () => {
    show([entry(10), entry(40)])
    expect(screen.queryByText(/only this basket is counted/i)).toBeNull()
  })
})

describe('the line under Checkout at Kiva', () => {
  function line(entries: BasketEntry[], exposure: ActiveExposure | null = null, onSeeWhy = vi.fn()) {
    const mix = buildBasketMix(entries, partnerOf)
    const warnings = concentrationWarnings(mix, exposure, DEFAULT_LIMITS)
    render(
      <I18nProvider>
        <BasketSpreadLine mix={mix} warnings={warnings} onSeeWhy={onSeeWhy} />
      </I18nProvider>,
    )
    return onSeeWhy
  }

  it('says how many field partners and countries the basket spans', () => {
    line([entry(10, 'Kenya'), entry(40, 'Uganda'), entry(40, 'Uganda')])
    expect(screen.getByText('2 field partners · 2 countries')).toBeInTheDocument()
  })

  it('uses the singular for one of each, and names direct-only baskets', () => {
    line([entry(10), entry(10)])
    expect(screen.getByText('1 field partner · 1 country')).toBeInTheDocument()
    cleanup()
    line([entry(null, 'United States'), entry(null, 'United States')])
    expect(screen.getByText('Direct loans · 1 country')).toBeInTheDocument()
  })

  it('names what the basket leans on once a warning stands, with a way down to it', () => {
    const exposure = { partner: new Map(), country: new Map([['Kenya', 30]]) }
    const onSeeWhy = line([...times(6, () => entry(20, 'Kenya')), entry(40, 'Uganda')], exposure)
    const text = screen.getByText(/Heavy on/)
    expect(text).toHaveTextContent('Heavy on Low Stars MFI and Kenya. See why')
    // Red when any of it is a low-rated or unrated partner.
    expect(text).toHaveClass('kl-spread-line-danger')
    fireEvent.click(screen.getByRole('button', { name: 'See why' }))
    expect(onSeeWhy).toHaveBeenCalled()
  })

  it('is amber when the warnings are only about well-rated partners or countries', () => {
    line(times(6, () => entry(10)))
    expect(screen.getByText(/Heavy on/)).toHaveClass('kl-spread-line-caution')
  })

  it('is absent for an empty basket', () => {
    line([])
    expect(document.querySelector('.kl-spread-line')).toBeNull()
  })
})

describe('in French', () => {
  it('follows French plural rules, singular below 2: 1,5 étoile, 5 étoiles, 1 prêt', async () => {
    window.localStorage.setItem('KivaLensLocale', 'fr')
    try {
      show([entry(20, 'Kenya'), entry(40, 'Uganda')])
      const ratings = await screen.findByRole('group', { name: 'Par cote de risque du partenaire' })
      expect([...ratings.querySelectorAll('.kl-mix-name')].map((n) => n.textContent)).toEqual(['5 étoiles', '1,5 étoile'])
      expect(ratings.querySelector('.kl-mix-figures')?.textContent).toMatch(/^1 prêt · 50/)
    } finally {
      window.localStorage.removeItem('KivaLensLocale')
    }
  })
})
