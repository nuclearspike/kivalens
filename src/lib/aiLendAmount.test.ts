import { describe, expect, it } from 'vitest'
// Paul, 2026-10-10: "We need to remove the dollar drop-downs now that kiva only
// accepts $25 as the default. it gives a false signal to the user". The assistant
// is the same control in words: it may not take, set or promise another amount.
import { buildSystemPrompt, execTool, RESPONSES_TOOL_DEFS } from '../../server/aiChat.mjs'
import { KIVA_LEND_AMOUNT, lendAmountFor } from '../../server/lendAmount.mjs'

const mkLoan = (o: Record<string, unknown>) => ({
  status: 'fundraising',
  funded_amount: 0,
  loan_amount: 1000,
  name: `Borrower ${o.id}`,
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

const state = {
  batch: 1,
  ready: true,
  rssReady: true,
  filterableLoans: true,
  optionsGz: null,
  atheistListProcessed: true,
  activePartners: [{ id: 10, status: 'active', kl_regions: ['me'], kl_sp: [], countries: [{ iso_code: 'JO' }], rating: 5 }],
  allLoans: [mkLoan({ id: 1, partner_id: 10 }), mkLoan({ id: 2, partner_id: 10 }), mkLoan({ id: 3, kl_still_needed: 10 })],
}

type Event = { type: string; loanId?: number; amount?: number; items?: Array<{ loanId: number; amount: number }> }
async function tool(name: string, args: Record<string, unknown>, basket: Array<{ loanId: number; amount: number }> = []) {
  const events: Event[] = []
  const sctx = { state, lenderId: null, criteria: { loan: {}, partner: { direct: 'both' }, portfolio: {} }, basket }
  const result = await execTool(name, args, sctx, (e: Event) => events.push(e))
  return { result, events }
}

const tools = RESPONSES_TOOL_DEFS as Array<{ name: string; description: string; parameters: { properties?: Record<string, unknown> } }>
const named = (name: string) => tools.find((t) => t.name === name)

describe('what one loan is added at', () => {
  it('is $25, or what the loan still needs when that is less', () => {
    expect([500, 25, 24.99, 10, 5].map(lendAmountFor)).toEqual([25, 25, 24.99, 10, 5])
  })

  it('is $25 for a loan whose need is unknown, met or not a number', () => {
    const odd = [undefined, null, 0, -0.1, -5, Number.NaN, Infinity, -Infinity, 'x', '10', true, [10], {}, Symbol('s'), () => 10]
    expect(odd.map(lendAmountFor)).toEqual(odd.map(() => 25))
  })
})

describe('the assistant and the amount a loan goes at', () => {
  it('has no tool that sets an amount', () => {
    expect(tools.map((t) => t.name)).not.toContain('set_lend_amount')
    expect(tools.map((t) => t.name)).not.toContain('set_all_lend_amounts')
    // No tool takes one either, under any name.
    for (const t of tools) {
      for (const param of Object.keys(t.parameters.properties ?? {})) expect(`${t.name}.${param}`).not.toMatch(/\.(amount|perLoan|per_loan)$/)
    }
  })

  it('adds a loan at $25 whatever amount it is handed, and is told an amount is Kiva’s to change', async () => {
    expect(KIVA_LEND_AMOUNT).toBe(25)
    const { result, events } = await tool('add_to_basket', { loanId: 1, amount: 100 })
    expect(events).toEqual([{ type: 'add_to_basket', loanId: 1 }])
    expect(result).toMatchObject({ ok: true, loanId: 1, amount: 25 })
    expect(result.note).toContain('$25')
    expect(result.note).toContain("Kiva's checkout page")
  })

  it('adds a loan with less than $25 left at what it still needs, and says so', async () => {
    const { result, events } = await tool('add_to_basket', { loanId: 3, amount: 100 })
    expect(events).toEqual([{ type: 'add_to_basket', loanId: 3 }])
    expect(result).toMatchObject({ ok: true, loanId: 3, amount: 10 })
    expect(result.note).toContain('Added at $10, all this loan still needs')
    expect(result.note).toContain('no other amount can be set in KivaLens')
  })

  it('answers the amount tools it once had as tools it does not have', async () => {
    for (const name of ['set_lend_amount', 'set_all_lend_amounts']) {
      const { result, events } = await tool(name, { loanId: 1, amount: 50 }, [{ loanId: 1, amount: 25 }])
      expect(result).toEqual({ error: 'unknown_tool' })
      expect(events).toEqual([])
    }
  })

  it('bulk-adds at $25 a loan whatever per-loan figure it is handed, and at what a loan still needs when that is less', async () => {
    const { result, events } = await tool('bulk_add_to_basket', { perLoan: 100, maxTotal: 1000 })
    expect(result.added).toBe(3)
    expect(result.totalUsd).toBe(60)
    expect(events[0].items).toEqual([{ loanId: 1, amount: 25 }, { loanId: 2, amount: 25 }, { loanId: 3, amount: 10 }])
  })

  it('stops a bulk add at the total asked for, counting $25 a loan', async () => {
    const { result } = await tool('bulk_add_to_basket', { maxTotal: 50 })
    expect(result.added).toBe(2)
  })

  it('bulk-adds a loan whole or not at all: a total with $15 of room does not take part of a $25 loan', async () => {
    const { result, events } = await tool('bulk_add_to_basket', { maxTotal: 40 }, [{ loanId: 1, amount: 25 }])
    expect(result).toMatchObject({ added: 0 })
    expect(events).toEqual([])
  })

  it('is told the rule: $25 a loan, no other amount here, changed at Kiva’s checkout', () => {
    const prompt = buildSystemPrompt(state, null, { loan: {}, partner: { direct: 'both' }, portfolio: {} })
    expect(prompt).toContain('LEND AMOUNT: every loan goes into the basket, and on to Kiva, at $25 (a loan with less than $25 left to raise goes in at what it still needs).')
    expect(prompt).toContain('KivaLens cannot set any other amount')
    expect(prompt).toContain('no page of KivaLens, the Basket page included, has an amount to choose or change')
    expect(prompt).toContain("a loan's amount is changed only at Kiva, on Kiva's own checkout page")
    expect(prompt).toContain('call no tool for it and navigate nowhere')
    expect(prompt).toContain('Never say an amount can be set, changed or adjusted in KivaLens.')
    expect(prompt).not.toMatch(/set_lend_amount|set_all_lend_amounts|perLoan/)
    expect(prompt).not.toMatch(/unless the user picks more/)
  })
})
