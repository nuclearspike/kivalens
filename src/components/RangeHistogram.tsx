import { memo, useMemo } from 'react'
import type { BinSpec } from '../../server/loanFilter.mjs'
import { HEIGHT, WIDTH, barRect, histogramPaths } from '../lib/rangeHistogram'

// The distribution drawn behind a range slider: how the loans matching every
// OTHER criterion spread along this slider's scale, with the selected span
// highlighted. Decorative for assistive tech (the slider keeps its own
// semantics) and transparent to the pointer, so dragging is untouched. It is
// absolutely positioned over space the row already has: arriving late, or
// changing, never moves anything.
function RangeHistogram({ bins, spec, lo, hi, hoverBin = null }: { bins: readonly number[] | undefined; spec: BinSpec; lo: number; hi: number; hoverBin?: number | null }) {
  const paths = useMemo(() => (bins ? histogramPaths(bins, spec, lo, hi) : null), [bins, spec, lo, hi])
  if (!paths) return null
  const hovered = bins && hoverBin !== null ? barRect(bins, spec, hoverBin) : null
  return (
    <svg className="kl-range-hist" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
      {paths.outside && <path className="kl-range-hist-out" d={paths.outside} />}
      {paths.inside && <path className="kl-range-hist-in" d={paths.inside} />}
      {hovered && <rect className="kl-range-hist-hover" {...hovered} />}
    </svg>
  )
}

export default memo(RangeHistogram)
