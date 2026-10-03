import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

// Paul, 2026-10-02, on the loan details' facts (Tags, Themes, Borrower, Posted...): "this section is
// hard to read. let's add just a little margin between each section. (not just the one's in green)".
// The space belongs to the stack (his rule 3), so a fact added later is spaced without anyone
// remembering to. The browser measurement is in analysis/loan-facts-spacing-2026-10-02.
const loan = readFileSync(path.join(process.cwd(), 'src/components/Loan.tsx'), 'utf8')
const scss = readFileSync(path.join(process.cwd(), 'src/styles/main.scss'), 'utf8')
const stack = loan.slice(loan.indexOf('className="kl-facts"'), loan.indexOf('Right detail column'))

describe("the loan details' facts", () => {
  it('are spaced by the stack that holds them', () => {
    const rule = scss.match(/\.kl-facts\s*\{([^}]*)\}/)?.[1] ?? ''
    expect(rule).toMatch(/display:\s*flex/)
    expect(rule).toMatch(/flex-direction:\s*column/)
    expect(rule).toMatch(/\bgap:\s*[1-9]\d*px/)
  })

  it('carry no margin of their own', () => {
    expect(stack.length).toBeGreaterThan(1000)
    expect(stack.match(/className="detail-label"/g)?.length).toBeGreaterThanOrEqual(12)
    expect(stack).not.toMatch(/margin(Top|Bottom|Block)/)
    expect(stack).not.toMatch(/className="[^"]*\b(?:mt|mb|my)-\d/)
  })
})
