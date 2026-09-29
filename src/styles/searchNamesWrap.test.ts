import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Paul, 2026-09-28: a search's name is shown whole wherever searches are listed. A
 * cut-off name ("Pays Back Fast (ex: Short term, pre-disbursed, posted awh…")
 * hides which search it is, and German names run about a third longer. The names
 * wrap: on the Search welcome panel, on the Saved tab, and in the Saved Searches
 * menu, which wraps within a width a phone can hold instead of running off screen.
 */

const here = fileURLToPath(new URL('.', import.meta.url))
const scss = readFileSync(join(here, 'main.scss'), 'utf8')
const saved = readFileSync(join(here, '../components/SavedSearches.tsx'), 'utf8')
const switcher = readFileSync(join(here, '../components/Criteria.tsx'), 'utf8')

/** The declarations of the first rule for a selector, nested rules included. */
function rule(selector: string): string {
  const start = scss.indexOf(`${selector} {`)
  expect(start, `${selector} in main.scss`).toBeGreaterThan(-1)
  let depth = 0
  for (let i = scss.indexOf('{', start); i < scss.length; i++) {
    if (scss[i] === '{') depth++
    if (scss[i] === '}' && --depth === 0) return scss.slice(start, i + 1)
  }
  throw new Error(`unclosed ${selector}`)
}
const truncates = (css: string) => /white-space:\s*nowrap|text-overflow:\s*ellipsis/.test(css)

describe('search names are shown whole, wrapping', () => {
  it('on the Search welcome panel', () => {
    expect(truncates(rule('.kl-home-row-name'))).toBe(false)
    expect(rule('.kl-home-row-name')).toMatch(/overflow-wrap:\s*anywhere/)
  })

  it('on the Saved tab', () => {
    expect(saved).toContain('className="kl-saved-search-name"')
    expect(saved).not.toMatch(/textOverflow:\s*'ellipsis'|whiteSpace:\s*'nowrap'/)
    expect(rule('.kl-saved-search-name')).toMatch(/overflow-wrap:\s*anywhere/)
  })

  it('in the Saved Searches menu, within a width a phone can hold', () => {
    expect(switcher).toContain('className="kl-saved-switcher-menu"')
    const menu = rule('.kl-saved-switcher-menu')
    expect(menu).toMatch(/max-width:\s*min\([^;]*100vw/)
    expect(menu).toMatch(/\.dropdown-item\s*\{[^}]*white-space:\s*normal/)
  })
})
