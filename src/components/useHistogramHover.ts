import { useState, type MouseEvent } from 'react'
import type { BinSpec } from '../../server/loanFilter.mjs'
import { binAt } from '../lib/rangeHistogram'

// Which histogram bar the pointer is over, for the caption readout. The props go
// on the element that wraps the rc-slider; the bar is found from the pointer's
// position along the slider's own box, which is exactly the rail. State changes
// only when the bar changes, so a drag does not re-render per pixel.
export function useHistogramHover(bins: readonly number[] | undefined, spec: BinSpec) {
  const [hoverBin, setHoverBin] = useState<number | null>(null)
  const onMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!bins) return
    const rail = e.currentTarget.querySelector('.rc-slider')?.getBoundingClientRect()
    if (!rail || rail.width === 0) return
    const next = binAt((e.clientX - rail.left) / rail.width, spec)
    setHoverBin((prev) => (prev === next ? prev : next))
  }
  const onMouseLeave = () => setHoverBin(null)
  const active = bins && hoverBin !== null && hoverBin < bins.length ? hoverBin : null
  return { hoverBin: active, trackProps: { className: 'kl-range', onMouseMove, onMouseLeave } }
}
