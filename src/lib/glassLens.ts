// Edge refraction for the glass slider handles: the rim of a handle bends what is
// behind it, the way a bevelled piece of glass does, while its centre stays true.
//
// CSS cannot bend a backdrop; an SVG displacement filter used as a backdrop-filter
// can, and only Chromium renders url() filters there. Other browsers keep the
// plain glass from main.scss: this module does nothing for them, so they never
// see a backdrop-filter value they would have to discard.
//
// The filter works in the handle's own pixel space, so its size is the handle's
// size. glassLens.test.ts fails if main.scss and GLASS_LENS_SIZE disagree.

export const GLASS_LENS_ID = 'kl-glass-lens'
/** Width and height of .rc-slider-handle in main.scss, in CSS px. */
export const GLASS_LENS_SIZE = 25
/** How far in from each edge the bend reaches, in percent of the handle. */
const RIM_PERCENT = 34
/** feDisplacementMap scale: the outermost pixel is drawn from SCALE / 2 px further in. */
const SCALE = 12
// The bend falls off quadratically from the edge to the end of the rim, sampled at
// five stops: strongest in the last pixel or two, gone by RIM_PERCENT.
const FALLOFF = [1, 0.5625, 0.25, 0.0625, 0]

const hex2 = (value: number) => value.toString(16).padStart(2, '0')

/** Gradient stops for one axis. 128 is "no bend"; above it samples from further
 *  along the axis, below it from further back, so both rims look inward. */
function stops(channel: 'r' | 'g'): string {
  const colour = (value: number) => (channel === 'r' ? `#${hex2(value)}0000` : `#00${hex2(value)}00`)
  const near = FALLOFF.map((ratio, i) => [(RIM_PERCENT * i) / 4, Math.round(128 + 127 * ratio)] as const)
  const far = [...FALLOFF].reverse().map((ratio, i) => [100 - RIM_PERCENT + (RIM_PERCENT * i) / 4, Math.round(128 - 128 * ratio)] as const)
  return [...near, ...far].map(([offset, value]) => `<stop offset='${offset.toFixed(2)}%' stop-color='${colour(value)}'/>`).join('')
}

/** The displacement map: red bends x, green bends y. Its intrinsic size is the
 *  handle's size, because Chromium draws an feImage at its intrinsic size. */
export function glassLensMap(size = GLASS_LENS_SIZE): string {
  return (
    `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 100 100' preserveAspectRatio='none'><defs>` +
    `<linearGradient id='x' x1='0' x2='1' y1='0' y2='0'>${stops('r')}</linearGradient>` +
    `<linearGradient id='y' x1='0' x2='0' y1='0' y2='1'>${stops('g')}</linearGradient></defs>` +
    `<rect width='100' height='100' fill='url(#x)'/>` +
    // The channels are disjoint, so screen is a plain sum: R from the first rect, G from the second.
    `<rect width='100' height='100' fill='url(#y)' style='mix-blend-mode:screen'/></svg>`
  )
}

function isChromium(): boolean {
  const brands = (navigator as Navigator & { userAgentData?: { brands?: { brand: string }[] } }).userAgentData?.brands
  return !!brands?.some((entry) => entry.brand === 'Chromium')
}

/** True where a url() backdrop-filter is both parsed and actually rendered. */
export function glassLensSupported(): boolean {
  if (typeof CSS === 'undefined' || typeof CSS.supports !== 'function') return false
  return isChromium() && CSS.supports('backdrop-filter', `url(#${GLASS_LENS_ID})`)
}

/**
 * Adds the lens filter to the page and marks <html data-glass-lens>, which is
 * what main.scss keys the refracting handle on. Safe to call more than once.
 */
export function installGlassLens(doc: Document = document): boolean {
  if (!glassLensSupported()) return false
  if (!doc.getElementById(GLASS_LENS_ID)) {
    const NS = 'http://www.w3.org/2000/svg'
    const svg = doc.createElementNS(NS, 'svg')
    svg.setAttribute('width', '0')
    svg.setAttribute('height', '0')
    svg.setAttribute('aria-hidden', 'true')
    svg.setAttribute('focusable', 'false')
    // Not display:none - a filter inside an undisplayed svg does not render.
    svg.style.position = 'absolute'

    const filter = doc.createElementNS(NS, 'filter')
    filter.setAttribute('id', GLASS_LENS_ID)
    filter.setAttribute('filterUnits', 'userSpaceOnUse')
    filter.setAttribute('x', '0')
    filter.setAttribute('y', '0')
    filter.setAttribute('width', String(GLASS_LENS_SIZE))
    filter.setAttribute('height', String(GLASS_LENS_SIZE))
    // The map's 128 must stay 128. In the default linearRGB it would become 55 and shift the whole handle.
    filter.setAttribute('color-interpolation-filters', 'sRGB')

    const image = doc.createElementNS(NS, 'feImage')
    image.setAttribute('href', `data:image/svg+xml,${encodeURIComponent(glassLensMap())}`)
    image.setAttribute('x', '0')
    image.setAttribute('y', '0')
    image.setAttribute('width', String(GLASS_LENS_SIZE))
    image.setAttribute('height', String(GLASS_LENS_SIZE))
    image.setAttribute('preserveAspectRatio', 'none')
    image.setAttribute('result', 'lens')

    const bend = doc.createElementNS(NS, 'feDisplacementMap')
    bend.setAttribute('in', 'SourceGraphic')
    bend.setAttribute('in2', 'lens')
    bend.setAttribute('scale', String(SCALE))
    bend.setAttribute('xChannelSelector', 'R')
    bend.setAttribute('yChannelSelector', 'G')

    filter.append(image, bend)
    svg.append(filter)
    doc.body.prepend(svg)
  }
  doc.documentElement.setAttribute('data-glass-lens', '')
  return true
}
