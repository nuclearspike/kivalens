import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// UX rule 44 (Paul, 2026-09-25: "i'm not fond of hover over color being the same as
// the selected color. it's confusing UX"). In a pick-one row, the option pointed at
// is tinted, never filled like the chosen one. jsdom has no :hover, so this guards
// the style; the rendered colours are measured in a real browser.

const here = fileURLToPath(new URL('.', import.meta.url))
const buttons = readFileSync(join(here, 'base/_buttons.scss'), 'utf8')

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return name === 'node_modules' ? [] : sources(path)
    return /\.tsx$/.test(name) && !/\.test\./.test(name) ? [path] : []
  })
}

describe('pick-one rows: hover never looks chosen', () => {
  const block = buttons.slice(buttons.indexOf(".kl-segmented .btn[aria-checked='false']"))
  const hover = block.slice(0, block.indexOf('&:focus-visible'))

  it('tints an unchosen option on hover and focus, keeping its own text and border', () => {
    expect(block.length).toBeGreaterThan(0)
    expect(hover).toMatch(/&:hover,\s*&:focus\s*\{/)
    expect(hover).toMatch(/background-color:\s*color-mix\(in srgb, var\(--kl-primary-outline\) \d+%, transparent\)/)
    expect(hover).toMatch(/color:\s*var\(--kl-primary-outline\)/)
  })

  it('never gives it the chosen fill', () => {
    expect(hover).not.toMatch(/\$flatly-primary/)
    expect(hover).not.toMatch(/--kl-on-accent/)
  })

  it('is the only way the app builds a pick-one row of buttons', () => {
    // A hand-built role="radio" button beside src/ui/Segmented.tsx would miss the rule.
    const src = join(here, '..')
    const handBuilt = sources(src).filter((path) => !path.endsWith('ui/Segmented.tsx') && /role="radio"/.test(readFileSync(path, 'utf8')))
    expect(handBuilt).toEqual([])
  })
})
