import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

/**
 * Paul: "If I had been on the partner tab but now the page refreshes and it's
 * showing a direct loan (without partner tab) then NOTHING shows except the
 * other tab headers."
 *
 * The remembered tab is read before any loan is known, so the check cannot live
 * in the reading of it: the tab that is SHOWN is worked out from the loan in
 * hand, while the lender's choice is left as it was.
 */

const source = readFileSync(path.join(process.cwd(), 'src/components/Loan.tsx'), 'utf8')

describe('the loan panel always has something to show', () => {
  it('falls back to Details when the loan has no field partner', () => {
    expect(source).toMatch(
      /const shownTab =\s*activeTab === PARTNER_TAB && !loan\.partner_id \? DETAILS_TAB : activeTab/,
    )
  })

  it('decides while rendering, so an empty panel never flashes first', () => {
    // An effect would paint the empty panel once before correcting it.
    const effects = source.slice(0, source.indexOf('const shownTab'))
    expect(effects).not.toMatch(/setActiveTab\(DETAILS_TAB\)/)
  })

  it('renders every tab and its content from the shown tab, not the stored one', () => {
    for (const tab of ['IMAGE_TAB', 'DETAILS_TAB', 'PARTNER_TAB']) {
      expect(source).toContain(`shownTab === ${tab}`)
    }
    // activeTab survives only as what was remembered and what gets written down.
    const uses = source.match(/\bactiveTab\b/g) ?? []
    expect(uses.length).toBeLessThanOrEqual(4)
  })

  it('leaves the remembered choice alone, so Partner returns on the next loan that has one', () => {
    // Exactly one place writes the tab down, and it is the lender picking one.
    const writes = source.match(/localStorage\.setItem\('loan_active_tab'/g) ?? []
    expect(writes.length).toBe(1)
    const handler = source.slice(source.indexOf('const handleTabSelect'))
    expect(handler.slice(0, 200)).toContain("localStorage.setItem('loan_active_tab'")
  })

  it('only writes the tab down when the lender picks one', () => {
    expect(source).toMatch(
      /const handleTabSelect = \(tab: number\) => \{\s*setActiveTab\(tab\)\s*localStorage\.setItem\('loan_active_tab', String\(tab\)\)/,
    )
  })
})
