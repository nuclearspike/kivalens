// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GLASS_LENS_ID, GLASS_LENS_SIZE, glassLensMap, glassLensSupported, installGlassLens } from './glassLens'

const asChromium = (supportsUrl = true) => {
  vi.stubGlobal('navigator', { userAgentData: { brands: [{ brand: 'Not A;Brand' }, { brand: 'Chromium' }] } })
  vi.stubGlobal('CSS', { supports: (prop: string, value: string) => supportsUrl && prop === 'backdrop-filter' && value.startsWith('url(') })
}

afterEach(() => {
  vi.unstubAllGlobals()
  document.getElementById(GLASS_LENS_ID)?.closest('svg')?.remove()
  document.documentElement.removeAttribute('data-glass-lens')
})

describe('glass lens', () => {
  it('does nothing outside Chromium, so other browsers keep the plain glass', () => {
    vi.stubGlobal('navigator', { userAgent: 'Safari' })
    vi.stubGlobal('CSS', { supports: () => true })
    expect(glassLensSupported()).toBe(false)
    expect(installGlassLens()).toBe(false)
    expect(document.getElementById(GLASS_LENS_ID)).toBeNull()
    expect(document.documentElement.hasAttribute('data-glass-lens')).toBe(false)
  })

  it('does nothing where a url() backdrop-filter is not supported, or CSS.supports is missing', () => {
    asChromium(false)
    expect(installGlassLens()).toBe(false)
    vi.stubGlobal('CSS', undefined)
    expect(installGlassLens()).toBe(false)
    expect(document.documentElement.hasAttribute('data-glass-lens')).toBe(false)
  })

  it('adds one filter and marks the page, however often it is called', () => {
    asChromium()
    expect(installGlassLens()).toBe(true)
    expect(installGlassLens()).toBe(true)
    expect(document.querySelectorAll(`#${GLASS_LENS_ID}`)).toHaveLength(1)
    expect(document.documentElement.hasAttribute('data-glass-lens')).toBe(true)
    const filter = document.getElementById(GLASS_LENS_ID)!
    // 128 in the map must mean "no bend": that needs sRGB, not the default linearRGB.
    expect(filter.getAttribute('color-interpolation-filters')).toBe('sRGB')
    expect(filter.querySelector('feDisplacementMap')?.getAttribute('in2')).toBe(filter.querySelector('feImage')?.getAttribute('result'))
    // An undisplayed svg would switch the filter off.
    expect((filter.closest('svg') as SVGElement).style.display).not.toBe('none')
  })

  it('bends only the rim: neutral across the middle, strongest at the edges, inward on both sides', () => {
    const map = glassLensMap()
    const stopsOf = (id: string) => {
      const gradient = map.match(new RegExp(`<linearGradient id='${id}'[^>]*>(.*?)</linearGradient>`))![1]
      return [...gradient.matchAll(/<stop offset='([\d.]+)%' stop-color='#([0-9a-f]{6})'\/>/g)].map((m) => {
        const channel = id === 'x' ? m[2].slice(0, 2) : m[2].slice(2, 4)
        return [Number(m[1]), parseInt(channel, 16)]
      })
    }
    const red = stopsOf('x')
    const green = stopsOf('y')
    expect(green).toEqual(red)
    expect(red[0]).toEqual([0, 255])
    expect(red.at(-1)).toEqual([100, 0])
    const neutral = red.filter(([, value]) => value === 128).map(([offset]) => offset)
    expect(neutral).toHaveLength(2)
    expect(neutral[1] - neutral[0]).toBeGreaterThan(25) // a true centre at least a quarter of the handle wide
    const values = red.map(([, value]) => value)
    expect([...values].sort((a, b) => b - a)).toEqual(values) // falls monotonically from one edge to the other
  })

  it("is sized to the slider handle in main.scss, because the filter works in the handle's pixels", () => {
    const scss = readFileSync(resolve(process.cwd(), 'src/styles/main.scss'), 'utf8')
    const handle = scss.match(/\.rc-slider-handle \{\s*width: (\d+)px;\s*height: (\d+)px;/)
    expect(handle?.slice(1).map(Number)).toEqual([GLASS_LENS_SIZE, GLASS_LENS_SIZE])
    expect(glassLensMap()).toContain(`width='${GLASS_LENS_SIZE}' height='${GLASS_LENS_SIZE}'`)
    expect(scss).toContain(`url(#${GLASS_LENS_ID})`)
  })
})
