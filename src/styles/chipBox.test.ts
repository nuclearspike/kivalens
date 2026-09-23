import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

/**
 * A chip that is `display: inline` sits in the line differently from one that is
 * `inline-block`: its vertical padding does not grow the line box, so it reads as
 * a different size beside its neighbours. The responsive display utilities carry
 * `!important`, so one on a padded chip quietly wins over the chip's own rule.
 */

const root = process.cwd()

function walk(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, found)
    else if (/\.tsx$/.test(full) && !/\.test\.tsx$/.test(full)) found.push(full)
  }
  return found
}

describe('a chip keeps the same box at every width', () => {
  it('never puts a responsive `inline` on a padded chip', () => {
    const offenders: string[] = []
    for (const file of walk(path.join(root, 'src'))) {
      const source = readFileSync(file, 'utf8')
      for (const m of source.matchAll(/className="([^"]*\b(?:loan-tag|kl-chip)\b[^"]*)"/g)) {
        if (/\bd-(?:sm|md|lg|xl)-inline(?!-block)\b/.test(m[1])) offenders.push(`${path.relative(root, file)}: ${m[1]}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('offers inline-block at every breakpoint that offers inline', () => {
    const utilities = readFileSync(path.join(root, 'src/styles/base/_utilities.scss'), 'utf8')
    for (const m of utilities.matchAll(/\.d-(sm|md|lg|xl)-inline \{/g)) {
      expect(utilities).toContain(`.d-${m[1]}-inline-block {`)
    }
  })
})
