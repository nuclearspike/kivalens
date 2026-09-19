import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// Guards the colour tokens themselves: every text token must reach WCAG AA
// (4.5:1) on every fill it is drawn on, in the light and the dark theme. This
// covers states a page audit cannot hold still — hover, focus, active — because
// those states only swap one token for another.

type RGBA = [number, number, number, number]

const source = readFileSync(fileURLToPath(new URL('./base/_theme.scss', import.meta.url)), 'utf8')

function tokensOf(mixin: string): Record<string, string> {
  const block = source.match(new RegExp(`@mixin ${mixin} \\{([\\s\\S]*?)\\n\\}`))
  if (!block) throw new Error(`mixin ${mixin} not found`)
  const shared = source.match(/:root \{([\s\S]*?)@include kl-light-tokens;/)
  const out: Record<string, string> = {}
  for (const text of [shared?.[1] ?? '', block[1]]) {
    for (const m of text.matchAll(/--kl-([a-z0-9-]+):\s*([^;]+);/g)) out[m[1]] = m[2].trim()
  }
  return out
}

function parse(value: string): RGBA {
  const hex = value.match(/^#([0-9a-f]{6})$/i)
  if (hex) return [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16)).concat(1) as RGBA
  const rgba = value.match(/^rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\s*\)$/)
  if (rgba) return [Number(rgba[1]), Number(rgba[2]), Number(rgba[3]), rgba[4] === undefined ? 1 : Number(rgba[4])]
  throw new Error(`not a colour: ${value}`)
}

const over = (top: RGBA, bottom: RGBA): RGBA => {
  const a = top[3]
  return [0, 1, 2].map((i) => top[i] * a + bottom[i] * (1 - a)).concat(1) as RGBA
}

function luminance(c: RGBA): number {
  const f = (v: number) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2])
}

function contrast(a: RGBA, b: RGBA): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

// Plain surfaces any body text can land on.
const SURFACES = ['bg', 'surface', 'surface-raised', 'bg-subtle', 'fill', 'fill-hover']
// Text tokens that may appear on any of those surfaces.
const TEXT = ['text', 'text-strong', 'text-muted', 'green-text', 'green-text-hover', 'danger-text', 'secondary-text', 'dropdown-link', 'primary-outline', 'chart-text']

// [text token, fill token, optional base the fill is composited over]
const PAIRS: [string, string, string?][] = [
  ...TEXT.flatMap((t) => SURFACES.map((s) => [t, s] as [string, string])),
  ['text', 'input-bg'], ['text-strong', 'input-bg'], ['placeholder', 'input-bg'], ['placeholder', 'surface-raised'],
  ['addon-text', 'addon-bg'],
  // list rows: hover and state fills keep primary text; hover also keeps muted text
  ['text', 'row-hover'], ['text-muted', 'row-hover'], ['green-text', 'row-hover'],
  ['text', 'row-selected'], ['text', 'row-funded'], ['text', 'row-portfolio'],
  ['text', 'status-inactive'], ['text', 'status-paused'], ['text', 'status-closed'],
  ['text', 'green-light'], ['text-muted', 'green-light'], ['green-text', 'green-light'],
  // fills that carry their own "on" colour
  ['on-accent', 'green'], ['on-accent', 'green-hover'], ['on-accent', 'green-dark'], ['on-accent', 'primary'],
  ['on-accent', 'success'], ['on-accent', 'info'], ['on-accent', 'danger'],
  ['on-accent', 'secondary'], ['on-accent', 'secondary-hover'], ['on-warning', 'warning'],
  ['ink', 'paper'],
  // pills, chips, code
  ['female-text', 'female-bg'], ['male-text', 'male-bg'],
  ['pill-good-text', 'pill-good-bg'], ['pill-warn-text', 'pill-warn-bg'], ['pill-bad-text', 'pill-bad-bg'], ['pill-accent-text', 'pill-accent-bg'],
  ['chip-text', 'chip-bg', 'input-bg'], ['chip-text-hover', 'chip-bg', 'input-bg'],
  ['code-text', 'code-bg'],
]

// Graphics that must be told apart by tone alone (WCAG 1.4.11, 3:1): [a, b].
const GRAPHIC_PAIRS: [string, string][] = [['chart-bar', 'chart-area']]

describe.each([
  ['light', 'kl-light-tokens'],
  ['dark', 'kl-dark-tokens'],
])('%s theme tokens', (_name, mixin) => {
  const tokens = tokensOf(mixin)

  it('defines the same token names in both themes', () => {
    expect(Object.keys(tokensOf('kl-dark-tokens')).sort()).toEqual(Object.keys(tokensOf('kl-light-tokens')).sort())
  })

  it.each(GRAPHIC_PAIRS)('%s and %s are 3:1 apart in tone', (a, b) => {
    const ratio = contrast(parse(tokens[a]), parse(tokens[b]))
    expect(Math.round(ratio * 100) / 100, `--kl-${a} vs --kl-${b}`).toBeGreaterThanOrEqual(3)
  })

  it.each(PAIRS)('%s on %s reaches 4.5:1', (fg, bg, base) => {
    for (const name of [fg, bg, base].filter(Boolean) as string[]) expect(tokens[name], `token --kl-${name}`).toBeDefined()
    const backdrop = base ? parse(tokens[base]) : ([255, 255, 255, 1] as RGBA)
    const fill = over(parse(tokens[bg]), backdrop)
    const ratio = contrast(over(parse(tokens[fg]), fill), fill)
    expect(Math.round(ratio * 100) / 100, `--kl-${fg} on --kl-${bg}`).toBeGreaterThanOrEqual(4.5)
  })
})
