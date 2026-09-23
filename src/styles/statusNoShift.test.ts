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

describe('the filtering status takes no space from the results', () => {
  it('lies over the list rather than in it', () => {
    const rule = block('.kl-filter-status')
    expect(rule).toMatch(/position:\s*absolute/)
    expect(rule).toMatch(/top:\s*0/)
    expect(rule).toMatch(/left:\s*0/)
    expect(rule).toMatch(/right:\s*0/)
  })

  it('is positioned against the results column, not the page', () => {
    expect(block('.results-col')).toMatch(/position:\s*relative/)
  })

  it('lets a click through to the list everywhere except the notice itself', () => {
    const rule = block('.kl-filter-status')
    expect(rule).toMatch(/pointer-events:\s*none/)
    expect(rule).toMatch(/pointer-events:\s*auto/)
  })
})
