import { describe, expect, it } from 'vitest'
// analyze_loans only PREVIEWS a filter — it never changes the live search. The
// model learns that from the note in the tool result, so the note is behavior,
// not decoration. Regression: a user asked for "countries in the middle east
// with women who are oppressed"; the model ran analyze_loans, drew the chart,
// reported 17 matches — and never applied it, so the results never moved and the
// user had to follow up with "set the criteria".
import { execTool } from '../../server/aiChat.mjs'

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

const state = {
  batch: 1,
  ready: true,
  // A fully-loaded server: the live refresh has published full loan objects, so
  // the shared filter can run. `ready` alone is the warm start, where allLoans
  // holds partials that filter to nothing.
  rssReady: true,
  filterableLoans: true,
  optionsGz: null,
  atheistListProcessed: true,
  activePartners: [{ id: 10, status: 'active', kl_regions: ['me'], kl_sp: [], countries: [{ iso_code: 'JO' }], rating: 5 }],
  allLoans: [
    mkLoan({ id: 1, partner_id: 10 }),
    mkLoan({ id: 2, partner_id: 10, sector: 'Retail' }),
    mkLoan({ id: 3, partner_id: 10, location: { country_code: 'PE', country: 'Peru' } }),
  ],
}

const emptyCriteria = () => ({ loan: {}, partner: {}, portfolio: {} })
const run = (args: Record<string, unknown>, applied = emptyCriteria()) =>
  execTool('analyze_loans', args, { state, lenderId: null, criteria: applied }, () => {})

describe('per-request readiness budget (council finding #2b)', () => {
  // Tool calls run serially, so per-tool 20s waits STACK: three cold tools held
  // the SSE stream silent for a minute. The budget lives on sctx and is shared.
  it('three serial cold tool calls spend ONE budget, not three', async () => {
    const cold = {
      ...state,
      ready: false,
      rssReady: false,
      filterableLoans: false,
      batches: new Map(),
      partnersGz: null,
      allLoans: [],
      rssReadyPromise: new Promise(() => {}), // never resolves
    }
    const sctx = { state: cold, lenderId: null, criteria: emptyCriteria(), readyDeadline: Date.now() + 300 }
    const t0 = Date.now()
    const r1 = await execTool('analyze_loans', { criteria: {} }, sctx, () => {})
    const r2 = await execTool('list_results', {}, sctx, () => {})
    const r3 = await execTool('analyze_loans', { criteria: {} }, sctx, () => {})
    const elapsed = Date.now() - t0

    expect(r1.ready).toBe(false)
    expect(r2.ready).toBe(false)
    expect(r3.ready).toBe(false)
    expect(elapsed).toBeLessThan(2000) // ~one 300ms budget, nowhere near 3×
  })

  // The shared budget must hold even for callers that never set the field:
  // execTool defaults it at entry, so an sctx built without readyDeadline
  // (a test, a future tool route) cannot silently reinstate per-tool stacking.
  it('execTool defaults readyDeadline on an sctx that lacks it', async () => {
    const cold = {
      ...state,
      ready: false,
      rssReady: false,
      filterableLoans: false,
      batches: new Map(),
      partnersGz: null,
      allLoans: [],
      rssReadyPromise: new Promise(() => {}), // never resolves
    }
    const sctx = { state: cold, lenderId: null, criteria: emptyCriteria() }
    // Force the shared window into the past so all three calls return at once.
    sctx.readyDeadline = Date.now() - 1
    const t0 = Date.now()
    const r1 = await execTool('analyze_loans', { criteria: {} }, sctx, () => {})
    const r2 = await execTool('list_results', {}, sctx, () => {})
    const r3 = await execTool('bulk_add_to_basket', {}, sctx, () => {})
    expect(Date.now() - t0).toBeLessThan(2000)
    expect(r1.ready).toBe(false)
    expect(r2.ready).toBe(false)
    expect(r3.ready).toBe(false)

    const bare = { state: cold, lenderId: null, criteria: emptyCriteria() }
    void execTool('analyze_loans', { criteria: {} }, bare, () => {}) // resolves later; only the default matters here
    expect(typeof bare.readyDeadline).toBe('number')
  })
})

describe('system prompt: live search + already-funded exclusion (digest 2026-08-22 / 08-19)', () => {
  // A user asked "how do I perform the search after setting the criteria" and
  // the model invented an apply step; another asked two days running how often
  // to screen out loans they already funded and was told "every time" — the
  // filter is on by default and persists. The prompt must carry both facts and
  // the filter's live state.
  it('states there is no apply step and that exclusion is automatic', async () => {
    const { buildSystemPrompt } = await import('../../server/aiChat.mjs')
    const p = buildSystemPrompt(state, 'lendiogives', { loan: {}, partner: {}, portfolio: { exclude_portfolio_loans: 'true' } })
    expect(p).toMatch(/NO search \/ apply \/ submit/)
    // The fix is not just "no button" — it is that nothing is required, ever,
    // because filtering is continuous. A one-shot "it already ran" framing left
    // room for the model to offer to re-apply.
    expect(p).toMatch(/NOTHING the user has to do/)
    expect(p).toMatch(/CONTINUOUSLY/)
    expect(p).toMatch(/the answer is NOTHING/)
    expect(p).toMatch(/NEVER offer to "apply" or "run" criteria that are already set/)
    expect(p).toMatch(/NEVER describe an apply step/)
    expect(p).toMatch(/exclude_portfolio_loans/)
    expect(p).toMatch(/ON by default/)
    expect(p).toMatch(/stays on across visits/)
    expect(p).toMatch(/Never tell them to re-filter every time/)
    expect(p).toContain('Exclude-funded filter is ON')
  })

  it('reports the exclusion filter OFF when the applied criteria turned it off or never set it', async () => {
    const { buildSystemPrompt } = await import('../../server/aiChat.mjs')
    expect(buildSystemPrompt(state, 'lendiogives', { loan: {}, partner: {}, portfolio: { exclude_portfolio_loans: 'false' } })).toContain('Exclude-funded filter is OFF')
    expect(buildSystemPrompt(state, null, emptyCriteria())).toContain('Exclude-funded filter is OFF')
  })

  it('flags the filter INERT when it is on but no lender id exists to resolve it', async () => {
    const { buildSystemPrompt } = await import('../../server/aiChat.mjs')
    const p = buildSystemPrompt(state, null, { loan: {}, partner: {}, portfolio: { exclude_portfolio_loans: 'true' } })
    expect(p).toContain('ON but INERT')
    expect(p).toContain('excludes NOTHING yet')
  })

  it('documents the exclusion key in the criteria schema the model reads', async () => {
    const { RESPONSES_TOOL_DEFS } = await import('../../server/aiChat.mjs')
    const setCriteria = RESPONSES_TOOL_DEFS.find((t) => t.name === 'set_criteria')
    expect(JSON.stringify(setCriteria)).toContain('exclude_portfolio_loans')
  })
})

describe('ready:false notes never contradict each other in one turn', () => {
  // set_criteria tells the model the filter is applied and visible and to
  // never send the user away; a sibling tool answering "ask the user to retry
  // shortly" in the same turn hands the model opposing directives. Every
  // gated read tool must carry the applied-and-visible framing, and the one
  // write tool must say its action did not run — not that anything is broken.
  const cold = () => ({
    ...state,
    ready: false,
    rssReady: false,
    filterableLoans: false,
    batches: new Map(),
    partnersGz: null,
    allLoans: [],
  })
  const sctx = () => ({ state: cold(), lenderId: null, criteria: emptyCriteria(), readyDeadline: Date.now() - 1 })

  it('read tools carry the applied-and-visible framing, never a retry ask', async () => {
    for (const [tool, args] of [['analyze_loans', { criteria: {} }], ['list_results', {}]]) {
      const r = await execTool(tool, args, sctx(), () => {})
      expect(r.ready).toBe(false)
      expect(r.note).not.toMatch(/retry shortly/i)
      expect(r.note).toMatch(/already visible/i)
      expect(r.note).toMatch(/do NOT ask them to come back/i)
    }
  })

  it('bulk_add_to_basket says the add did not run, without implying breakage', async () => {
    const r = await execTool('bulk_add_to_basket', {}, sctx(), () => {})
    expect(r.ready).toBe(false)
    expect(r.note).toMatch(/did NOT run/i)
    expect(r.note).not.toMatch(/retry shortly/i)
    expect(r.note).toMatch(/do NOT imply the search is broken/i)
  })
})

describe('system prompt during the warm window (council finding #3)', () => {
  it('never states Direct/MFI counts computed from partial stubs', async () => {
    const { buildSystemPrompt } = await import('../../server/aiChat.mjs')
    const warmPartial = {
      ...state,
      ready: true,
      rssReady: false,
      filterableLoans: false,
      // partial warm details: no partner_id — the old prompt counted these all as Direct
      allLoans: [{ id: 1, description: { texts: { en: 'x' } } }, { id: 2, description: { texts: { en: 'y' } } }],
    }
    const prompt = buildSystemPrompt(warmPartial, null, emptyCriteria())
    expect(prompt).toContain('per-mode counts are NOT available')
    expect(prompt).not.toMatch(/currently \d+ Direct loans/)

    const loaded = buildSystemPrompt(state, null, emptyCriteria())
    expect(loaded).toMatch(/currently \d+ Direct loans and \d+ MFI loans/)
  })
})

describe('AI tools during the warm start', () => {
  // state.ready is true and allLoans holds PARTIAL detail objects that filter to
  // nothing. The tools must report "still loading", never "nothing matches" — in
  // production this told every user there were no loans for ~3 minutes after
  // each deploy.
  const warm = () => ({
    ...state,
    ready: true,
    rssReady: false,
    filterableLoans: false,
    // No cached pages here, so the on-demand expand cannot rescue it — this is
    // the genuinely-cold case that must report “still loading”.
    batches: new Map(),
    partnersGz: null,
    allLoans: [{ id: 1, description: { texts: { en: 'hi' } } }],
  })

  it('analyze_loans says loading, not “no loans match”', async () => {
    const r = await execTool('analyze_loans', { criteria: { loan: { country_code: 'KE' } } }, { state: warm(), lenderId: null, criteria: emptyCriteria() }, () => {})
    expect(r.ready).toBe(false)
    expect(r.note).toMatch(/still loading/i)
    expect(r.note).toMatch(/do NOT tell them nothing matches/i)
    expect(r.count).toBeUndefined()
  })

  it('set_criteria still applies the filter but reports no count yet', async () => {
    const r = await execTool('set_criteria', { criteria: { loan: { country_code: 'KE' } } }, { state: warm(), lenderId: null, criteria: emptyCriteria() }, () => {})
    expect(r.ok).toBe(true)
    expect(r.count).toBeNull() // NOT 0 — zero would read as “nothing matches”
    expect(r.note).toMatch(/do NOT say nothing matches/i)
  })

  it('reports a real count once the live data is published', async () => {
    const r = await execTool('set_criteria', { criteria: { loan: { country_code: 'JO' } } }, { state, lenderId: null, criteria: emptyCriteria() }, () => {})
    expect(r.count).toBeGreaterThan(0)
  })
})

describe('set_criteria — broadening guard', () => {
  // A user went 271 -> 243 -> 1,245 loans while ADDING filters and was told each
  // step had "narrowed" it. replace:true and empty-string clears both drop
  // filters silently, so the tool result has to call the widening out.
  const apply = (args: Record<string, unknown>, applied = emptyCriteria()) =>
    execTool('set_criteria', args, { state, lenderId: null, criteria: applied }, () => {})

  it('warns when a call makes the search broader', async () => {
    const narrow = { loan: { country_code: 'JO', sector: 'Services' }, partner: {}, portfolio: {} }
    // replace:true wipes the country filter, widening the result set.
    const r = await apply({ criteria: { loan: { sector: 'Services' } }, replace: true }, narrow)

    expect(r.count).toBeGreaterThan(r.countBefore)
    expect(r.note).toMatch(/BROADER, not narrower/)
    expect(r.note).toMatch(/NEVER call this "narrowed"/)
  })

  it('reports the before and after counts so the model can quote them', async () => {
    const narrow = { loan: { country_code: 'JO' }, partner: {}, portfolio: {} }
    const r = await apply({ criteria: {}, replace: true }, narrow)
    expect(r.note).toContain(`${r.countBefore} -> ${r.count}`)
  })

  it('stays quiet when the call actually narrows', async () => {
    const r = await apply({ criteria: { loan: { country_code: 'JO' } } })
    expect(r.count).toBeLessThanOrEqual(r.countBefore)
    expect(r.note).not.toMatch(/BROADER/)
  })

  it('stays quiet when nothing changed', async () => {
    const same = { loan: { country_code: 'JO' }, partner: {}, portfolio: {} }
    const r = await apply({ criteria: { loan: { country_code: 'JO' } } }, same)
    expect(r.note).not.toMatch(/BROADER/)
  })
})

describe('report_bug', () => {
  // Most users have no GitHub account, so this chat is the only channel they
  // have. The tool CALL is what makes the report machine-visible to the digest.
  const report = (args: Record<string, unknown>) =>
    execTool('report_bug', args, { state, lenderId: null, criteria: emptyCriteria() }, () => {})

  it('records what the user described', async () => {
    const r = await report({
      summary: 'saved searches vanished',
      expected: 'my 6 searches',
      actual: 'the list is empty',
      where: 'Saved page',
    })
    expect(r.ok).toBe(true)
    expect(r.recorded).toMatchObject({
      summary: 'saved searches vanished',
      actual: 'the list is empty',
      where: 'Saved page',
    })
  })

  it('accepts a partial report rather than demanding every field', async () => {
    const r = await report({ summary: 'basket keeps emptying' })
    expect(r.ok).toBe(true)
    expect(r.recorded.summary).toBe('basket keeps emptying')
  })

  it('asks for one detail instead of filing an empty report', async () => {
    const r = await report({})
    expect(r.ok).toBeUndefined()
    expect(r.error).toBe('summary_required')
  })

  it('tells the model to confirm receipt WITHOUT promising a fix or a timeline', async () => {
    const r = await report({ summary: 'x' })
    expect(r.note).toMatch(/do NOT\s+promise a fix or a timeline/i)
    expect(r.note).toMatch(/not ask them to file it anywhere else/i)
  })

  it('clips hostile-length input so one report cannot bloat the digest', async () => {
    const r = await report({ summary: 'x'.repeat(5000), actual: 'y'.repeat(5000) })
    expect(r.recorded.summary.length).toBeLessThanOrEqual(300)
    expect(r.recorded.actual.length).toBeLessThanOrEqual(300)
  })
})

describe('analyze_loans preview directive', () => {
  it('tells the model the search was NOT changed when it previews new criteria', async () => {
    const result = await run({ criteria: { loan: { country_code: 'JO' } } })
    expect(result.applied_to_search).toBe(false)
    // Must say it did not change the search, and demand set_criteria this turn.
    expect(result.note).toMatch(/did NOT change/i)
    expect(result.note).toContain('set_criteria')
    expect(result.note).toMatch(/THIS SAME TURN/i)
  })

  it('does not nag when the analysis matches the already-applied criteria', async () => {
    const applied = { loan: { country_code: 'JO' }, partner: {}, portfolio: {} }
    // Same filter, just asking for a breakdown of the current search.
    const result = await run({ criteria: { loan: { country_code: 'JO' } } }, applied)
    expect(result.applied_to_search).toBe(true)
    expect(result.note).not.toMatch(/did NOT change/i)
  })

  it('recognises the applied search when a portfolio balancer is on', async () => {
    // The browser fills a balancer's list from the lender's portfolio and validation
    // drops that list, so a breakdown of the live search must not read as a preview.
    const balanced = {
      loan: {},
      partner: {},
      portfolio: { pb_sector: { enabled: true, hideshow: 'hide', ltgt: 'gt', percent: 10, allactive: 'all', values: ['Retail'] } },
    }
    const result = await run({ criteria: {} }, balanced)
    expect(result.applied_to_search).toBe(true)
    expect(result.note).not.toMatch(/did NOT change/i)
  })

  it('still counts correctly while previewing (count comes from the merged filter)', async () => {
    const result = await run({ criteria: { loan: { country_code: 'JO' } } })
    expect(result.count).toBe(2)
    expect(result.applied_to_search).toBe(false)
  })
})
