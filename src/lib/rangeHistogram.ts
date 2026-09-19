// Geometry of the distribution histogram drawn behind a range slider. Pure, so
// the drawing can be tested without a browser. The SVG it feeds is stretched to
// the slider's rail (viewBox WIDTH x HEIGHT, preserveAspectRatio="none").
import type { BinSpec } from '../../server/loanFilter.mjs'
import { binRange } from './sliderConfig'

export const WIDTH = 1000
export const HEIGHT = 100
// A bar that stands for even one loan stays tall enough to see.
const MIN_BAR = 7

/** Left and right edge of bar `index`, in viewBox units. The bars tile the rail
 *  from end to end and never reach past it. They are NOT centred on their stops:
 *  that draws half of the first and last bar outside the slider. Tiling still
 *  keeps every stop over its own bar, because stop i sits at i / (count - 1),
 *  which always lies within [i / count, (i + 1) / count]. */
export function barEdges(spec: BinSpec, index: number): [number, number] {
  const width = WIDTH / spec.count
  const gap = Math.min(width * 0.1, 6)
  return [index * width + gap, (index + 1) * width - gap]
}

/** Bars inside the selected [lo, hi] and bars outside it, as two SVG paths.
 *  Heights are log scaled. Loan data is long-tailed (thousands of one-borrower
 *  loans, a few dozen groups of ten), and the slider's job is to show WHERE
 *  loans exist: on a linear or even square-root scale every bar but the tallest
 *  is a pixel high, and the tallest sits under a resting handle. Null when there
 *  is nothing to draw. */
export function histogramPaths(bins: readonly number[], spec: BinSpec, lo: number, hi: number): { inside: string; outside: string } | null {
  const peak = Math.max(0, ...bins)
  if (peak === 0 || bins.length !== spec.count) return null
  let inside = ''
  let outside = ''
  for (let i = 0; i < bins.length; i++) {
    if (!bins[i]) continue
    const [x0, x1] = barEdges(spec, i)
    const h = Math.max(MIN_BAR, (Math.log1p(bins[i]) / Math.log1p(peak)) * HEIGHT)
    const rect = `M${round(x0)} ${HEIGHT}V${round(HEIGHT - h)}H${round(x1)}V${HEIGHT}Z`
    const [from, to] = binRange(spec, i)
    const centre = (from + to) / 2
    if (centre >= lo && centre <= hi) inside += rect
    else outside += rect
  }
  return { inside, outside }
}

/** The rectangle of one bar (viewBox units), for highlighting it; null when the bar is empty. */
export function barRect(bins: readonly number[], spec: BinSpec, index: number): { x: number; y: number; width: number; height: number } | null {
  const peak = Math.max(0, ...bins)
  if (!bins[index] || peak === 0) return null
  const [x0, x1] = barEdges(spec, index)
  const h = Math.max(MIN_BAR, (Math.log1p(bins[index]) / Math.log1p(peak)) * HEIGHT)
  return { x: round(x0), y: round(HEIGHT - h), width: round(x1 - x0), height: round(h) }
}

/** Where along the rail (0..1) a bar's middle sits: the hover hint's anchor. */
export function barCentre(spec: BinSpec, index: number): number {
  return (index + 0.5) / spec.count
}

/** The bar under a pointer at `fraction` (0..1) of the rail's width: the bars
 *  tile the rail (see barEdges), whatever kind of slider it is. */
export function binAt(fraction: number, spec: BinSpec): number {
  return Math.min(spec.count - 1, Math.max(0, Math.floor(fraction * spec.count)))
}

const round = (n: number) => Math.round(n * 10) / 10

