import { useEffect, useRef, useState } from 'react'
import { binIndex, type BinSpec } from '../../server/loanFilter.mjs'
import { barCentre } from '../lib/rangeHistogram'
import { hintRangeText, hintSpanText, type RangeHint } from '../lib/rangeHints'
import { pluralCategory } from '../lib/pluralCategory'
import { useI18n } from '../i18n'
import { useHistogramHover } from './useHistogramHover'

// How long the two-line tip stays after a handle is let go (or a key is released),
// so the total it settled on can be read. A pointer drag shows it throughout; a
// keyboard step would otherwise flash it for a single frame.
const LINGER_MS = 1400

export interface RangeReadoutOptions {
  bins?: readonly number[]
  spec: BinSpec
  min: number
  max: number
  step: number
  /** The handles' live values. */
  lo: number
  hi: number
  hint?: RangeHint
  /** What the counts are counts of: picks "… loans" or "… partners". */
  unit: 'loans' | 'partners'
  /** Exact total for a candidate range (null = no limit at that end); omit to show the first line only. */
  totalFor?: (min: number | null, max: number | null) => number | null
}

/**
 * The hint above a range slider's histogram.
 *
 * Pointing at a bar: one line, that bar's values and count ("3 stars: 212 loans").
 * Moving a handle: the tip follows the handle. Line one is the bar the handle is
 * on; line two is what the whole range would return ("3.5–5 stars: 4,032 loans"),
 * so the effect of the move is known before it is let go.
 */
export function useRangeReadout({ bins, spec, min, max, step, lo, hi, hint, unit, totalFor }: RangeReadoutOptions) {
  const { t, number, currency, percent, locale } = useI18n()
  const { hoverBin, trackProps } = useHistogramHover(bins, spec)
  // Which handle is moving, and what its range would return: worked out in the
  // slider's change event, not while rendering.
  const [moving, setMoving] = useState<{ handle: 'min' | 'max'; total: number | null } | null>(null)
  const linger = useRef(0)
  useEffect(() => () => window.clearTimeout(linger.current), [])

  const formatters = { t, number, currency, percent, pluralOf: (n: number) => pluralCategory(locale, n) }
  const counted = (range: string, count: number) => {
    const one = pluralCategory(locale, count) === 'one'
    const values = { range, count: number(count) }
    if (unit === 'partners') return one ? t('range_count_partners_one', values) : t('range_count_partners', values)
    return one ? t('range_count_loans_one', values) : t('range_count_loans', values)
  }

  /** Call with the slider's new [min, max] on every change, before passing it on. */
  const noteChange = (next: readonly number[]) => {
    window.clearTimeout(linger.current)
    const handle = next[0] !== lo ? 'min' : next[1] !== hi ? 'max' : moving?.handle
    if (!handle) return
    const total = totalFor?.(next[0] <= min ? null : next[0], next[1] >= max ? null : next[1]) ?? null
    setMoving({ handle, total })
  }
  const sliderProps = {
    onBeforeChange: () => window.clearTimeout(linger.current),
    onChangeComplete: () => {
      window.clearTimeout(linger.current)
      linger.current = window.setTimeout(() => setMoving(null), LINGER_MS)
    },
  }

  let tip: { at: number; lines: string[] } | null = null
  if (bins && moving) {
    const bin = binIndex(moving.handle === 'min' ? lo : hi, spec)
    if (bin >= 0 && bin < bins.length) {
      const lines = [counted(hintRangeText(spec, bin, step, hint, formatters), bins[bin])]
      if (moving.total != null) lines.push(counted(hintSpanText(lo, hi, { min, max, step }, hint, formatters), moving.total))
      tip = { at: barCentre(spec, bin), lines }
    }
  } else if (bins && hoverBin !== null) {
    tip = { at: barCentre(spec, hoverBin), lines: [counted(hintRangeText(spec, hoverBin, step, hint, formatters), bins[hoverBin])] }
  }

  // The highlighted bar is the one the tip speaks about.
  const activeBin = bins && moving ? binIndex(moving.handle === 'min' ? lo : hi, spec) : hoverBin
  return { tip, activeBin: activeBin != null && activeBin >= 0 ? activeBin : null, trackProps, noteChange, sliderProps }
}
