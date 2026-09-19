import { describe, expect, it } from 'vitest'
import { HEIGHT, WIDTH, barCentre, barEdges, barRect, binAt, histogramPaths } from './rangeHistogram'

const stops = { min: 1, max: 5, count: 5, discrete: true }
const spans = { min: 0, max: 100, count: 10, discrete: false }
const rects = (d: string) => d.split('Z').filter(Boolean).length

describe('histogramPaths', () => {
  it('draws nothing for an empty or mismatched histogram', () => {
    expect(histogramPaths([0, 0, 0, 0, 0], stops, 1, 5)).toBeNull()
    expect(histogramPaths([1, 2], stops, 1, 5)).toBeNull()
  })

  it('splits bars into the selected span and the rest, skipping empty bars', () => {
    const p = histogramPaths([4, 0, 9, 1, 1], stops, 3, 5)!
    expect(rects(p.inside)).toBe(3) // stops 3, 4, 5
    expect(rects(p.outside)).toBe(1) // stop 1 (stop 2 is empty)
  })

  it('with the handles at both ends every bar is inside, including the overflow bars', () => {
    const p = histogramPaths([1, 1, 1, 1, 1, 1, 1, 1, 1, 50], spans, 0, 100)!
    expect(rects(p.inside)).toBe(10)
    expect(p.outside).toBe('')
  })

  it('makes the tallest bar full height and keeps a one-loan bar visible', () => {
    const p = histogramPaths([1, 0, 0, 0, 10000], stops, 1, 5)!
    expect(p.inside).toContain(`V0H`) // tallest bar reaches the top
    const small = p.inside.split('Z')[0]
    const top = Number(small.match(/V([\d.]+)H/)![1])
    expect(HEIGHT - top).toBeGreaterThanOrEqual(7)
  })

  it('never draws past either end of the rail, for any kind of slider', () => {
    for (const spec of [stops, spans, { min: 1, max: 4, count: 4, discrete: true }]) {
      expect(barEdges(spec, 0)[0]).toBeGreaterThanOrEqual(0)
      expect(barEdges(spec, spec.count - 1)[1]).toBeLessThanOrEqual(WIDTH)
    }
  })

  it('keeps every stop of a few-stop slider over its own bar', () => {
    const four = { min: 1, max: 4, count: 4, discrete: true }
    for (let i = 0; i < four.count; i++) {
      const stopAt = (i / (four.count - 1)) * WIDTH
      const [from, to] = [(i / four.count) * WIDTH, ((i + 1) / four.count) * WIDTH]
      expect(stopAt).toBeGreaterThanOrEqual(from)
      expect(stopAt).toBeLessThanOrEqual(to)
    }
  })
})

describe('binAt', () => {
  it('finds the bar under the pointer and clamps past the ends', () => {
    expect(binAt(0.5, stops)).toBe(2)
    expect(binAt(0.19, stops)).toBe(0)
    expect(binAt(0.21, stops)).toBe(1)
    expect(binAt(1, stops)).toBe(4)
    expect(binAt(0.55, spans)).toBe(5)
    expect(binAt(-0.2, spans)).toBe(0)
    expect(binAt(1.4, spans)).toBe(9)
  })
})

describe('hover hint helpers', () => {
  const money = { min: 0, max: 10000, count: 50, discrete: false }

  it('anchors the hint at the middle of its bar and outlines the hovered bar only when it has loans', () => {
    expect(barCentre(stops, 2)).toBe(0.5)
    expect(barCentre(money, 0)).toBeCloseTo(0.01)
    expect(barRect([4, 0, 9, 1, 1], stops, 1)).toBeNull()
    const r = barRect([4, 0, 9, 1, 1], stops, 2)!
    expect(r.y).toBe(0) // the tallest bar
    expect(r.x).toBeGreaterThanOrEqual(0)
    expect(r.x + r.width).toBeLessThanOrEqual(WIDTH)
  })
})
