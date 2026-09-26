import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

/**
 * A status that appears and disappears in a second or two must not move the page.
 * Paul: "i hate the orange 'finishing loan filtering' it shows for so short and
 * causes a ton of layout shift … don't have status changes cause layout shift.
 * it's JARRING."
 */

const main = readFileSync(path.join(process.cwd(), 'src/styles/main.scss'), 'utf8')

function block(selector: string): string {
  const start = main.indexOf(`${selector} {`)
  expect(start).toBeGreaterThan(-1)
  let depth = 0
  for (let i = start; i < main.length; i++) {
    if (main[i] === '{') depth++
    else if (main[i] === '}' && --depth === 0) return main.slice(start, i + 1)
  }
  throw new Error(`unterminated ${selector}`)
}

/** The rule for `selector` that applies at every width: not inside a media query or another rule. */
function topLevelBlock(selector: string): string {
  for (let at = main.indexOf(`${selector} {`); at > -1; at = main.indexOf(`${selector} {`, at + 1)) {
    const before = main.slice(0, at)
    const depth = (before.match(/\{/g) ?? []).length - (before.match(/\}/g) ?? []).length
    // A rule of its own (its selector starts the line), outside any media query or rule.
    if (depth === 0 && (at === 0 || main[at - 1] === '\n')) {
      // Its closing brace is the first one at the start of a line.
      const end = main.indexOf('\n}', at)
      if (end < 0) throw new Error(`unterminated ${selector}`)
      return main.slice(at, end + 2)
    }
  }
  throw new Error(`no top-level ${selector} rule`)
}

describe('the filtering status takes no space from the results', () => {
  it('lies over the list rather than in it', () => {
    const rule = block('.kl-filter-status')
    expect(rule).toMatch(/position:\s*absolute/)
    expect(rule).toMatch(/top:\s*0/)
    expect(rule).toMatch(/left:\s*0/)
    expect(rule).toMatch(/right:\s*0/)
  })

  it('is positioned against the results column at every width, not the page', () => {
    // Below md the columns stack: against the page it sat at the top, half under
    // the navbar, with the results far below.
    expect(topLevelBlock('.results-col')).toMatch(/position:\s*relative/)
  })

  // Paul, 2026-09-25: "the orange float-over … is over the count (correct) but
  // under the loans that are showing in the list".
  it('lies over the loan rows as well as the count', () => {
    // The rows carry their own z-index (10; 12 when selected). The list keeps it to
    // itself, so any overlay on the results is above every row.
    expect(topLevelBlock('.loan_list_container')).toMatch(/isolation:\s*isolate/)
    const z = Number(block('.kl-filter-status').match(/z-index:\s*(\d+)/)?.[1])
    expect(z).toBeGreaterThan(0)
  })

  it('lets a click through to the list everywhere except the notice itself', () => {
    const rule = block('.kl-filter-status')
    expect(rule).toMatch(/pointer-events:\s*none/)
    expect(rule).toMatch(/pointer-events:\s*auto/)
  })
})
