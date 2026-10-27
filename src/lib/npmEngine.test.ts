import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { checkNpm } from '../../scripts/npm-engine.mjs'

describe("the gate's npm check", () => {
  it('passes an npm inside the pin', () => {
    expect(checkNpm('11.x', '11.12.1').ok).toBe(true)
    expect(checkNpm('11', '11.21.1\n').ok).toBe(true)
    expect(checkNpm('11.x.x', '11.0.0').ok).toBe(true)
    expect(checkNpm('11.12.x', '11.12.1').ok).toBe(true)
    expect(checkNpm('11.12', '11.12.9').ok).toBe(true)
    expect(checkNpm('11.12.1', '11.12.1').ok).toBe(true)
  })

  it('fails an npm outside the pin', () => {
    const r = checkNpm('11.x', '10.9.9')
    expect(r.ok).toBe(false)
    expect(r.detail).toBe('npm 10.9.9, but Heroku builds with npm 11.x (engines.npm)')
    expect(checkNpm('11.x', '12.2.1').ok).toBe(false)
    expect(checkNpm('11.12.x', '11.13.0').ok).toBe(false)
    expect(checkNpm('11.12.1', '11.12.2').ok).toBe(false)
  })

  it('fails when package.json pins no npm', () => {
    expect(checkNpm(undefined, '11.12.1')).toEqual({
      ok: false,
      detail: 'package.json sets no engines.npm, so Heroku builds with its own default npm, which the gate cannot match',
    })
    expect(checkNpm('', '11.12.1').ok).toBe(false)
  })

  it('fails a range rather than guess what Heroku picks from it', () => {
    for (const pin of ['>=11', '^11.0.0', '~11.12.0', '11.x.5', '11 || 12', 'latest']) {
      expect(checkNpm(pin, '11.12.1'), pin).toEqual({ ok: false, detail: `engines.npm "${pin}" is not a pin the gate reads (11.x, 11.6.x or 11.6.2)` })
    }
  })

  it('fails when npm prints no version', () => {
    expect(checkNpm('11.x', '').ok).toBe(false)
    expect(checkNpm('11.x', undefined).ok).toBe(false)
  })

  it("reads this repo's own pin", () => {
    const pkg = JSON.parse(readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'))
    expect(pkg.engines.npm).toBe('11.x')
    expect(checkNpm(pkg.engines.npm, '11.0.0').ok).toBe(true)
  })
})
