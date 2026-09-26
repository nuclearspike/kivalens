import { describe, expect, it } from 'vitest'
import { buildDigestHtml, bugReports, subjectSuffix, criteriaDiff, manualChange } from '../../server/digest.mjs'

/**
 * The daily digest emails real user chat turns to the operator. It embeds
 * user-supplied text, so escaping is a security property, not cosmetics.
 */

const turn = (o: Record<string, unknown> = {}) => ({
  at: '2026-08-13T10:00:00Z',
  clientId: 'c1',
  userMessage: 'find me vegan loans',
  response: 'Here you go.',
  tools: [],
  costUsd: 0.001,
  ...o,
})

describe('buildDigestHtml', () => {
  it('summarizes interaction, user and cost totals', () => {
    const html = buildDigestHtml('2026-08-13', [
      turn({ clientId: 'a', costUsd: 0.01 }),
      turn({ clientId: 'b', costUsd: 0.02 }),
      turn({ clientId: 'b', costUsd: 0.03 }),
    ])
    expect(html).toContain('3 interactions')
    expect(html).toContain('2 users')
    expect(html).toContain('$0.0600')
  })

  it('groups turns by user and labels the lender when known', () => {
    const html = buildDigestHtml('2026-08-13', [
      turn({ clientId: 'c1', lenderId: 'jmcgimpsey' }),
      turn({ clientId: 'c2' }),
    ])
    expect(html).toContain('lender jmcgimpsey')
    expect(html).toContain('User c1')
    expect(html).toContain('User c2')
  })

  it('falls back to anonymous when there is no id at all', () => {
    const html = buildDigestHtml('2026-08-13', [turn({ clientId: null, lenderId: null })])
    expect(html).toContain('anonymous')
  })

  it('escapes HTML in user-supplied text (no script injection)', () => {
    const html = buildDigestHtml('2026-08-13', [
      turn({ userMessage: '<script>alert(1)</script>', response: '<img src=x onerror=alert(2)>' }),
    ])
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;script&gt;')
  })

  it('escapes a hostile client id too', () => {
    const html = buildDigestHtml('2026-08-13', [turn({ clientId: '<b>bold</b>' })])
    expect(html).not.toContain('<b>bold</b>')
  })

  it('handles a day with no activity', () => {
    const html = buildDigestHtml('2026-08-13', [])
    expect(html).toContain('0 interactions')
    expect(html).toContain('$0.0000')
  })

  it('tolerates turns with no cost recorded', () => {
    const html = buildDigestHtml('2026-08-13', [turn({ costUsd: undefined })])
    expect(html).toContain('$0.0000')
  })

  it('lists the tools a turn used', () => {
    const html = buildDigestHtml('2026-08-13', [
      turn({ tools: [{ name: 'set_criteria' }, { name: 'analyze_loans' }] }),
    ])
    expect(html).toContain('set_criteria')
    expect(html).toContain('analyze_loans')
  })

  it('says how a turn ended when it did not simply complete, and counts the turns abandoned', () => {
    const html = buildDigestHtml('2026-08-13', [
      turn({ outcome: 'completed', estimated: false }),
      turn({ outcome: 'abandoned', estimated: true }),
      turn({ outcome: 'abandoned', estimated: false }),
      turn({ outcome: 'cut', estimated: true }),
      turn({ outcome: 'incomplete', incompleteReason: 'max_output_tokens', estimated: false }),
      turn({ outcome: 'incomplete', incompleteReason: 'content_filter', estimated: false }),
      turn({ outcome: 'incomplete', estimated: false }),
      turn({ outcome: 'failed', estimated: false }),
    ])
    // Two turns, one client: the count is of turns, beside "N interactions", never of users.
    expect(html).toContain('8 interactions · 1 users')
    expect(html).toContain('2 abandoned before the reply finished</p>')
    expect(html).toContain(' · left before the reply finished (cost estimated)</div>')
    expect(html).toContain(' · left before the reply finished</div>')
    expect(html).toContain(' · reply cut by KivaLens (cost estimated)</div>')
    expect(html).toContain(' · reply reached its length limit</div>')
    expect(html).toContain(" · reply stopped by OpenAI's content filter</div>")
    expect(html).toContain(' · reply stopped early by OpenAI</div>')
    expect(html).toContain(' · failed</div>')
    expect(html.match(/ · (left before|reply cut|reply reached|reply stopped|failed)/g)).toHaveLength(7) // not the completed turn
  })

  it('adds no count when every lender stayed, and no note to turns logged before outcomes were', () => {
    const html = buildDigestHtml('2026-08-13', [turn(), turn({ outcome: 'completed' })])
    expect(html).not.toContain('abandoned before the reply finished')
    expect(html).not.toContain('left before the reply finished')
    expect(html).not.toContain('cost estimated')
  })
})

/**
 * Most users have no GitHub account, so the chat is their only way to report a
 * problem. A report rendered like every other turn gets missed — one "my saved
 * searches are gone" report sat inside a 103-chat digest looking exactly like
 * "can you make them pink". These pin that it is hoisted and counted.
 */
const bug = (args: unknown, o: Record<string, unknown> = {}) =>
  turn({
    userMessage: 'my saved searches are gone',
    // The pipeline stores tool args as a JSON STRING, truncated to 300 chars.
    tools: [{ name: 'report_bug', args: typeof args === 'string' ? args : JSON.stringify(args) }],
    ...o,
  })

describe('digest — bug reports', () => {
  it('finds turns where a report was filed', () => {
    const logs = [turn(), bug({ summary: 'saved searches vanished' }), turn()]
    expect(bugReports(logs)).toHaveLength(1)
  })

  it('ignores ordinary turns', () => {
    expect(bugReports([turn(), turn({ tools: [{ name: 'set_criteria' }] })])).toHaveLength(0)
  })

  it('hoists a report into its own section with the details', () => {
    const html = buildDigestHtml('2026-08-13', [
      bug({ summary: 'saved searches vanished', actual: 'list is empty', expected: 'my 6 searches', where: 'Saved page' }),
    ])
    expect(html).toContain('1 bug report(s)')
    expect(html).toContain('saved searches vanished')
    expect(html).toContain('list is empty')
    expect(html).toContain('Saved page')
  })

  it('puts the section ABOVE the per-user log so it cannot be missed', () => {
    const html = buildDigestHtml('2026-08-13', [
      turn({ clientId: 'zzz', userMessage: 'find me vegan loans' }),
      bug({ summary: 'basket cleared itself' }, { clientId: 'aaa' }),
    ])
    expect(html.indexOf('bug report(s)')).toBeLessThan(html.indexOf('User zzz'))
  })

  it('labels the reporter by lender when known', () => {
    const html = buildDigestHtml('2026-08-13', [bug({ summary: 'x' }, { lenderId: 'david89779370' })])
    expect(html).toContain('lender david89779370')
  })

  it('falls back to the user’s own words when the args were truncated mid-JSON', () => {
    // 300-char truncation can leave unparseable JSON; the report must still show.
    const html = buildDigestHtml('2026-08-13', [bug('{"summary":"the basket lost my loa')])
    expect(html).toContain('1 bug report(s)')
    expect(html).toContain('my saved searches are gone')
  })

  it('escapes hostile text inside a report', () => {
    const html = buildDigestHtml('2026-08-13', [bug({ summary: '<script>alert(1)</script>' })])
    expect(html).not.toContain('<script>')
  })

  it('adds nothing when there are no reports', () => {
    const html = buildDigestHtml('2026-08-13', [turn()])
    expect(html).not.toContain('bug report(s)')
  })

  it.each([
    [0, ''],
    [1, ', 1 bug report'],
    [2, ', 2 bug reports'],
  ])('subject suffix for %i report(s)', (n, expected) => {
    const logs = [turn(), ...Array.from({ length: n as number }, () => bug({ summary: 's' }))]
    expect(subjectSuffix(logs)).toBe(expected)
  })
})

/**
 * A user went 271 -> 243 -> 1,245 loans while ADDING filters, and was told each
 * step "narrowed" it. The counts alone could not show which filter had been
 * dropped, and criteriaIn/criteriaOut were logged but never rendered — so the
 * evidence was wiped with the logs. These pin that a turn shows what it changed.
 */
const withCriteria = (before: unknown, after: unknown, o: Record<string, unknown> = {}) =>
  turn({ criteriaIn: JSON.stringify(before), criteriaOut: JSON.stringify(after), ...o })

describe('digest — criteria diff', () => {
  it('reports an added filter', () => {
    const d = criteriaDiff(withCriteria({ loan: {} }, { loan: { sector: 'Food' } }))
    expect(d.added).toEqual(['loan.sector=Food'])
    expect(d.removed).toEqual([])
  })

  it('reports a REMOVED filter — the case that widens a search', () => {
    const d = criteriaDiff(withCriteria(
      { loan: { sector: 'Food', country_code: 'PE' } },
      { loan: { sector: 'Food' } },
    ))
    expect(d.removed).toEqual(['loan.country_code=PE'])
  })

  it('reports a changed value', () => {
    const d = criteriaDiff(withCriteria({ loan: { sector: 'Food' } }, { loan: { sector: 'Retail' } }))
    expect(d.changed).toEqual(['loan.sector: Food → Retail'])
  })

  it('spans all three criteria groups', () => {
    const d = criteriaDiff(withCriteria(
      {},
      { loan: { sector: 'Food' }, partner: { region: 'me' }, portfolio: { exclude_portfolio_loans: 'true' } },
    ))
    expect(d.added).toHaveLength(3)
  })

  it('renders removals in the turn so a dropped filter is visible', () => {
    const html = buildDigestHtml('2026-08-15', [
      withCriteria({ loan: { country_code: 'PE', percent_female_min: 50 } }, { loan: { sector: 'Food' } }),
    ])
    expect(html).toContain('loan.country_code=PE')
    expect(html).toContain('loan.sector=Food')
  })

  it('adds no line when the turn did not touch the filter', () => {
    const html = buildDigestHtml('2026-08-15', [withCriteria({ loan: { sector: 'Food' } }, { loan: { sector: 'Food' } })])
    expect(html).not.toContain('loan.sector')
  })

  it('survives unparseable/truncated criteria without throwing', () => {
    expect(() => criteriaDiff(turn({ criteriaIn: '{"loan":{"sec', criteriaOut: null }))).not.toThrow()
    expect(criteriaDiff(turn({ criteriaIn: '{"loan":{"sec', criteriaOut: null })).added).toEqual([])
  })

  it('escapes hostile criteria values', () => {
    const html = buildDigestHtml('2026-08-15', [withCriteria({}, { loan: { name: '<script>x</script>' } })])
    expect(html).not.toContain('<script>')
  })
})

/**
 * The user can edit the criteria panel by hand between turns, so a count that
 * jumps mid-conversation is not necessarily the assistant's doing. The client
 * sends its live criteria every turn, so comparing the previous turn's RESULT
 * with this turn's STARTING state reveals edits made outside the chat.
 */
describe('digest — edits made outside the conversation', () => {
  const t = (inC: unknown, outC: unknown, at: string) =>
    turn({ at, criteriaIn: JSON.stringify(inC), criteriaOut: JSON.stringify(outC) })

  it('detects a filter the user removed between turns', () => {
    const prev = t({}, { loan: { country_code: 'PE', sector: 'Food' } }, '2026-08-15T10:00:00Z')
    const next = t({ loan: { sector: 'Food' } }, { loan: { sector: 'Food' } }, '2026-08-15T10:05:00Z')
    expect(manualChange(prev, next)).toMatchObject({ removed: ['loan.country_code=PE'] })
  })

  it('detects a filter the user added between turns', () => {
    const prev = t({}, { loan: { sector: 'Food' } }, '2026-08-15T10:00:00Z')
    const next = t({ loan: { sector: 'Food', country_code: 'KE' } }, {}, '2026-08-15T10:05:00Z')
    expect(manualChange(prev, next)).toMatchObject({ added: ['loan.country_code=KE'] })
  })

  it('returns null when the user did not touch anything', () => {
    const prev = t({}, { loan: { sector: 'Food' } }, '2026-08-15T10:00:00Z')
    const next = t({ loan: { sector: 'Food' } }, {}, '2026-08-15T10:05:00Z')
    expect(manualChange(prev, next)).toBeNull()
  })

  it('renders a marker between the turns so the jump is explained', () => {
    const html = buildDigestHtml('2026-08-15', [
      t({}, { loan: { country_code: 'PE', percent_female_min: 50 } }, '2026-08-15T10:00:00Z'),
      t({ loan: { percent_female_min: 50 } }, { loan: { percent_female_min: 50, sector: 'Food' } }, '2026-08-15T10:05:00Z'),
    ])
    expect(html).toContain('user edited the filters directly')
    expect(html).toContain('loan.country_code=PE')
  })

  it('does not mark the first turn of a conversation', () => {
    const html = buildDigestHtml('2026-08-15', [t({ loan: { sector: 'Food' } }, { loan: { sector: 'Food' } }, '2026-08-15T10:00:00Z')])
    expect(html).not.toContain('user edited the filters directly')
  })

  it('does not attribute one user’s edits to another user', () => {
    const html = buildDigestHtml('2026-08-15', [
      turn({ clientId: 'a', criteriaIn: '{}', criteriaOut: JSON.stringify({ loan: { sector: 'Food' } }), at: '2026-08-15T10:00:00Z' }),
      turn({ clientId: 'b', criteriaIn: '{}', criteriaOut: '{}', at: '2026-08-15T10:05:00Z' }),
    ])
    expect(html).not.toContain('user edited the filters directly')
  })
})
