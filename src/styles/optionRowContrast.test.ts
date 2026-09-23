import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// A row that can turn dark under the count it carries: the selected option of a
// select, and a hovered, focused or active dropdown row, all paint white text on a
// dark background. A fixed muted grey count measured 2.1:1 there (Paul reported the
// MFI Only row). The count takes the row's own colour instead — at full strength on
// those rows — and the bar darkens the row rather than tinting it green, which would
// lighten the row under its own white text. jsdom does no layout or colour
// compositing, so this guards the rules; the ratios are measured in a real browser.

const main = readFileSync(fileURLToPath(new URL('./main.scss', import.meta.url)), 'utf8')
const rulesFor = (selector: string) =>
  [...main.matchAll(new RegExp(`(^|\\n)${selector}\\s*\\{([^}]*)\\}`, 'g'))].map((m) => m[2]).join('\n')

describe('counts stay readable on every row state', () => {
  it('a count takes the colour of the row it sits on, never a fixed one', () => {
    const count = rulesFor('\\.kl-opt-count')
    expect(count).toMatch(/color:\s*inherit;/)
    expect(count).not.toMatch(/color:\s*var\(--kl-text-muted\)/)
  })

  it('on rows that turn dark, the count is at full strength and the bar darkens', () => {
    const darkRows = main.slice(main.indexOf('.Select__option--is-selected,'))
    const block = darkRows.slice(0, darkRows.indexOf('\n}\n') + 3)
    for (const selector of ['.Select__option--is-selected', '.dropdown-item:hover', '.dropdown-item:focus', '.dropdown-item.active']) {
      expect(block).toContain(selector)
    }
    expect(block).toMatch(/\.kl-opt-count\s*\{\s*opacity:\s*1;/)
    expect(block).toMatch(/--kl-opt-bar-color:\s*rgba\(0,\s*0,\s*0,\s*0?\.\d+\)/) // darkens, never lightens
  })
})

// The count bar's second line (what a setting leaves out) is secondary to the count
// above it, so it must never be set larger. It carries no size of its own: it inherits
// the bar. (It was 12px inside an 11px bar — Paul: "these fonts should either be the
// same or have the top one bigger".)
describe('the count bar reads top-down', () => {
  it('the gap line inherits the bar size instead of setting its own', () => {
    expect(rulesFor('\\.kl-count-gaps')).not.toMatch(/font-size/)
    expect(rulesFor('\\.loan-count-bar')).toMatch(/font-size:\s*\$kl-font-size-sm;/)
  })
})
