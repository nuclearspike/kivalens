import { describe, expect, it } from 'vitest'
// The assistant reads and edits the lender's live search. In Both, partner values
// the lender kept are greyed and change nothing, on purpose. The assistant must
// leave them that way: only a partner filter the assistant itself sets or changes
// means "apply partner filters", which needs MFI Only. Otherwise a plain question
// ("break down my search") or a loan-only edit switched the lender to MFI Only and
// every Direct loan quietly left their results.
import { execTool, validateCriteria } from '../../server/aiChat.mjs'

const mkLoan = (o: Record<string, unknown>) => ({
  status: 'fundraising',
  funded_amount: 0,
  loan_amount: 1000,
  location: { country_code: 'JO', country: 'Jordan' },
  terms: { repayment_interval: 'monthly' },
  kls_tags: [],
  themes: [],
  borrower_count: 1,
  kl_percent_women: 100,
  kl_still_needed: 500,
  kl_percent_funded: 50,
  kl_name_arr: [],
  kls_use_or_descr_arr: [],
  kl_newest_sort: 0,
  posted_date: '2026-06-01',
  sector: 'Services',
  ...o,
})

// Partner 10 is in the Middle East. Loans 1 and 2 are through it; loan 3 is Direct.
const state = {
  batch: 1,
  ready: true,
  rssReady: true,
  filterableLoans: true,
  optionsGz: null,
  atheistListProcessed: true,
  activePartners: [{ id: 10, status: 'active', kl_regions: ['me'], kl_sp: [], countries: [{ iso_code: 'JO' }], rating: 5 }],
  allLoans: [
    mkLoan({ id: 1, partner_id: 10 }),
    mkLoan({ id: 2, partner_id: 10, sector: 'Retail' }),
    mkLoan({ id: 3 }),
  ],
}

type Crit = { loan: Record<string, unknown>; partner: Record<string, unknown>; portfolio: Record<string, unknown> }
// Both, with an Africa region filter kept from an earlier MFI Only search. Applied,
// it would match no loan at all (partner 10 is not in Africa); in Both it is inert.
const keptInBoth = (): Crit => ({ loan: {}, partner: { direct: 'both', region: 'af' }, portfolio: {} })

async function tool(name: string, args: Record<string, unknown>, lender: Crit) {
  const events: Array<{ type: string; criteria?: Crit; items?: unknown[] }> = []
  const sctx = { state, lenderId: null, criteria: lender, basket: [] }
  const result = await execTool(name, args, sctx, (e: { type: string }) => events.push(e))
  const applied = events.find((e) => e.type === 'apply_criteria')?.criteria
  return { result, applied }
}

describe('the assistant leaves kept partner values inert in Both', () => {
  it('a breakdown of the current search counts what the lender sees', async () => {
    const { result } = await tool('analyze_loans', { criteria: {} }, keptInBoth())
    expect(result.count).toBe(3)
    // …and is recognised as the applied search, so the model is not told to re-apply it.
    expect(result.applied_to_search).toBe(true)
  })

  it('a loan-only question merged onto kept values stays Both', async () => {
    const { result } = await tool('analyze_loans', { criteria: { loan: { sector: 'Services' } } }, keptInBoth())
    expect(result.count).toBe(2)
  })

  it('listing results counts every loan the lender sees', async () => {
    const { result } = await tool('list_results', {}, keptInBoth())
    expect(result.count).toBe(3)
  })

  it('"add them all to my basket" adds the loans on screen, Direct ones included', async () => {
    const { result } = await tool('bulk_add_to_basket', { perLoan: 25, maxTotal: 1000 }, keptInBoth())
    expect(result.matched).toBe(3)
    expect(result.added).toBe(3)
  })

  it('a loan-only edit keeps Both and keeps the kept values', async () => {
    const { applied } = await tool('set_criteria', { criteria: { loan: { sector: 'Services' } } }, keptInBoth())
    expect(applied?.partner).toEqual({ direct: 'both', region: 'af' })
  })

  it('repeating the kept value back is not asking for it', async () => {
    const { applied, result } = await tool('set_criteria', { criteria: { partner: { region: 'af' } } }, keptInBoth())
    expect(applied?.partner.direct).toBe('both')
    expect(result.count).toBe(3)
  })

  it('a wholesale replace that repeats the kept values keeps the lender\'s mode', async () => {
    const { applied } = await tool('set_criteria', { criteria: { loan: { sector: 'Services' }, partner: { region: 'af' } }, replace: true }, keptInBoth())
    expect(applied?.partner.direct).toBe('both')
  })

  it('validation alone never changes the mode', () => {
    expect(validateCriteria({ partner: { direct: 'both', region: 'af' } }, {}).partner.direct).toBe('both')
  })
})

describe('a partner filter the assistant asks for is applied (MFI Only)', () => {
  it('setting a new partner filter switches to MFI Only', async () => {
    const { applied, result } = await tool('set_criteria', { criteria: { partner: { region: 'me' } } }, keptInBoth())
    expect(applied?.partner.direct).toBe('mfi')
    expect(result.count).toBe(2)
  })

  it('a preview of a new partner filter counts it applied', async () => {
    const empty: Crit = { loan: {}, partner: { direct: 'both' }, portfolio: {} }
    const { result } = await tool('analyze_loans', { criteria: { partner: { region: 'me' } } }, empty)
    expect(result.count).toBe(2)
    expect(result.applied_to_search).toBe(false)
  })

  it('changing Any/All/None on a kept filter asks for that filter', async () => {
    const { applied, result } = await tool('set_criteria', { criteria: { partner: { region_all_any_none: 'none' } } }, keptInBoth())
    expect(applied?.partner.direct).toBe('mfi')
    expect(result.count).toBe(2) // partner 10 is not in Africa, so "none of Africa" keeps it
  })

  it('turning on balance-by-partner asks for a partner-side filter', async () => {
    const empty: Crit = { loan: {}, partner: { direct: 'both' }, portfolio: {} }
    const pb = { enabled: true, hideshow: 'hide', ltgt: 'gt', percent: 10, allactive: 'all' }
    const { applied } = await tool('set_criteria', { criteria: { portfolio: { pb_partner: pb } } }, empty)
    expect(applied?.partner.direct).toBe('mfi')
  })

  it('repeating a balance-by-partner the lender already has is not asking', async () => {
    const pb = { enabled: true, hideshow: 'hide', ltgt: 'gt', percent: 10, allactive: 'all', values: [10] }
    const lender: Crit = { loan: {}, partner: { direct: 'both' }, portfolio: { pb_partner: pb } }
    const { applied } = await tool('set_criteria', { criteria: { portfolio: { pb_partner: { ...pb, values: undefined } } } }, lender)
    expect(applied?.partner.direct).toBe('both')
  })

  it('an explicit Direct Only is left alone', async () => {
    const { applied } = await tool('set_criteria', { criteria: { partner: { direct: 'direct', region: 'me' } } }, keptInBoth())
    expect(applied?.partner.direct).toBe('direct')
  })
})

describe('a search saved before the modes existed keeps its partner filters', () => {
  // No mode, one partner filter: the engine reads it as MFI Only (resolvePartnerMode),
  // so the Africa filter applies and matches nothing here. Read as Both, the filter
  // would be inert and all 3 loans would come back.
  const legacy = (): Crit => ({ loan: {}, partner: { region: 'af' }, portfolio: {} })

  it('a breakdown applies them', async () => {
    const { result } = await tool('analyze_loans', { criteria: {} }, legacy())
    expect(result.count).toBe(0)
    expect(result.applied_to_search).toBe(true)
  })

  it('a list applies them', async () => {
    const { result } = await tool('list_results', {}, legacy())
    expect(result.count).toBe(0)
  })

  it('a loan-only edit keeps applying them', async () => {
    const { result, applied } = await tool('set_criteria', { criteria: { loan: { sector: 'Services' } } }, legacy())
    expect(result.count).toBe(0)
    expect(applied?.partner.region).toBe('af')
  })

  it('a feed carries them as MFI Only', async () => {
    const { result } = await tool('generate_rss_feed', {}, legacy())
    expect(JSON.parse(decodeURIComponent(String(result.url).split('/rss/')[1])).partner).toEqual({ region: 'af', direct: 'mfi' })
  })
})

describe('an RSS feed made by the assistant carries partner filters only in MFI Only', () => {
  const feedPartner = async (lender: Crit, args: Record<string, unknown> = {}) => {
    const { result } = await tool('generate_rss_feed', args, lender)
    return JSON.parse(decodeURIComponent(String(result.url).split('/rss/')[1])).partner
  }

  it('Both: the kept values stay out and the mode is written, so the feed cannot turn MFI-only', async () => {
    expect(await feedPartner(keptInBoth())).toEqual({ direct: 'both' })
  })

  it('MFI Only: the partner filters go in', async () => {
    expect(await feedPartner({ loan: {}, partner: { direct: 'mfi', region: 'me' }, portfolio: {} })).toEqual({ direct: 'mfi', region: 'me' })
  })

  it('Direct Only: just the mode', async () => {
    expect(await feedPartner({ loan: {}, partner: { direct: 'direct', region: 'me' }, portfolio: {} })).toEqual({ direct: 'direct' })
  })

  it('a feed the assistant describes with a new partner filter is MFI Only', async () => {
    expect(await feedPartner(keptInBoth(), { criteria: { partner: { region: 'me' } } })).toEqual({ direct: 'mfi', region: 'me' })
  })
})
