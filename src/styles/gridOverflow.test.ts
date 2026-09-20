import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// Guards the rule that keeps pages from scrolling sideways. The app's full-width
// container has less side padding than the grid's rows have negative margin, so a
// row overhangs the container (and the screen) unless the container clips it.
// scripts/overflow-audit.browser.js measures the rendered pages; this only makes
// sure the rule the pages depend on is not dropped or weakened.

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8')
const px = (source: string, name: string) => {
  const m = source.match(new RegExp(`\\$${name}:\\s*(\\d+)px`))
  if (!m) throw new Error(`$${name} not found`)
  return Number(m[1])
}
const grid = read('./base/_grid.scss')
const fluidRules = [...grid.matchAll(/(^|\n)\.container-fluid\s*\{([^}]*)\}/g)].map((m) => m[2]).join('\n')

describe('grid: a row never widens the page', () => {
  it('has a full-width container tighter than the row gutter, which is why the clip is needed', () => {
    const gutter = px(read('./base/_tokens.scss'), 'gutter')
    const fluidPadding = px(read('./_variables.scss'), 'kl-spacing-md')
    expect(read('./main.scss')).toMatch(/\.container-fluid\s*\{\s*padding-left:\s*\$kl-spacing-md;\s*padding-right:\s*\$kl-spacing-md;/)
    expect(fluidPadding).toBeLessThan(gutter)
  })

  it('clips the overhang at the full-width container', () => {
    expect(fluidRules).toMatch(/overflow-x:\s*clip;/)
  })

  it('does not use hidden or auto there, which would make the container a scroll box and break sticky children', () => {
    expect(fluidRules).not.toMatch(/overflow(-x)?:\s*(hidden|auto|scroll)/)
  })
})
