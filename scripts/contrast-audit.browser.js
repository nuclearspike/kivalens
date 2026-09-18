// In-page text-contrast audit (WCAG 2.x AA). Measures what is actually rendered:
// for every visible piece of text it composites the real stack of ancestor
// backgrounds and opacities, then compares the text colour against it.
//
// Run it in the dev server's page, in each theme, on every route and state:
//   const { audit } = await import('/@fs/<repo>/scripts/contrast-audit.browser.js')
//   audit()            // -> { checked, failures: [...], unverifiable: [...] }
//
// A failure is normal text under 4.5:1, or large text (>= 24px, or >= 18.66px
// bold) under 3:1. Disabled controls are exempt, as WCAG exempts them. Text
// over a background IMAGE or gradient cannot be measured here and is returned
// in `unverifiable` for a human look.

function parseColor(str) {
  if (!str) return null
  let m = str.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/)
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3]), alpha(m[4])]
  m = str.match(/^color\(srgb\s+([\d.e-]+)\s+([\d.e-]+)\s+([\d.e-]+)(?:\s*\/\s*([\d.]+%?))?\s*\)$/)
  if (m) return [Number(m[1]) * 255, Number(m[2]) * 255, Number(m[3]) * 255, alpha(m[4])]
  return null
}

function alpha(raw) {
  if (raw === undefined) return 1
  return raw.endsWith('%') ? Number(raw.slice(0, -1)) / 100 : Number(raw)
}

// source-over of two straight-alpha RGBA colours
function over(top, bottom) {
  const a = top[3] + bottom[3] * (1 - top[3])
  if (a === 0) return [0, 0, 0, 0]
  const ch = (i) => (top[i] * top[3] + bottom[i] * bottom[3] * (1 - top[3])) / a
  return [ch(0), ch(1), ch(2), a]
}

const fade = (c, opacity) => [c[0], c[1], c[2], c[3] * opacity]

function luminance(c) {
  const f = (v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2])
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const hex = (c) => '#' + [0, 1, 2].map((i) => Math.round(c[i]).toString(16).padStart(2, '0')).join('')

// Renders the single-pixel stack root -> el. An ancestor with opacity < 1 is a
// compositing group: its subtree is painted on a transparent buffer and only
// then blended onto what lies behind it.
function render(chain, i, backdrop, textColor) {
  const cs = getComputedStyle(chain[i])
  const opacity = Number(cs.opacity)
  let buffer = opacity < 1 ? [0, 0, 0, 0] : backdrop
  const bg = parseColor(cs.backgroundColor)
  if (bg && bg[3] > 0) buffer = over(bg, buffer)
  let result
  if (i === chain.length - 1) result = { bg: buffer, text: over(textColor, buffer) }
  else result = render(chain, i + 1, buffer, textColor)
  if (opacity < 1) {
    result = { bg: over(fade(result.bg, opacity), backdrop), text: over(fade(result.text, opacity), backdrop) }
  }
  return result
}

function describe(el) {
  const parts = []
  for (let n = el; n && n.nodeType === 1 && parts.length < 4; n = n.parentElement) {
    const cls = typeof n.className === 'string' && n.className.trim() ? '.' + n.className.trim().split(/\s+/).slice(0, 3).join('.') : ''
    parts.unshift(n.tagName.toLowerCase() + (n.id ? '#' + n.id : '') + cls)
  }
  return parts.join(' > ')
}

function visible(el) {
  if (!el.getClientRects().length) return false
  const cs = getComputedStyle(el)
  if (cs.visibility !== 'visible' || cs.display === 'none') return false
  const r = el.getBoundingClientRect()
  return r.width > 1 && r.height > 1 // sr-only text is clipped to 1px
}

export function audit(root = document.body) {
  const canvas = parseColor(getComputedStyle(document.documentElement).backgroundColor)
  const scheme = getComputedStyle(document.documentElement).colorScheme
  const pageBackdrop = canvas && canvas[3] === 1 ? canvas : scheme.includes('dark') ? [18, 18, 18, 1] : [255, 255, 255, 1]
  const failures = new Map()
  const unverifiable = new Map()
  let checked = 0

  const check = (el, colorStr, sample, kind) => {
    if (el.closest(':disabled, [aria-disabled="true"], .disabled')) return
    const color = parseColor(colorStr)
    if (!color || color[3] === 0) return
    const chain = []
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) chain.unshift(n)
    const overImage = chain.some((n) => getComputedStyle(n).backgroundImage !== 'none')
    const px = render(chain, 0, pageBackdrop, color)
    const ratio = contrast(px.text, px.bg)
    const cs = getComputedStyle(el)
    const size = parseFloat(cs.fontSize)
    const large = size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700)
    const need = large ? 3 : 4.5
    checked += 1
    if (ratio >= need) return
    const key = `${kind}|${describe(el)}|${hex(px.text)}|${hex(px.bg)}`
    const bucket = overImage ? unverifiable : failures
    const hit = bucket.get(key)
    if (hit) hit.count += 1
    else bucket.set(key, { kind, where: describe(el), text: hex(px.text), bg: hex(px.bg), ratio: Math.round(ratio * 100) / 100, need, sample: sample.trim().slice(0, 40), count: 1 })
  }

  for (const el of root.querySelectorAll('*')) {
    const tag = el.tagName.toLowerCase()
    if (['script', 'style', 'noscript', 'option', 'optgroup', 'head', 'meta', 'link', 'title'].includes(tag)) continue
    if (!visible(el)) continue
    const cs = getComputedStyle(el)
    const svgText = el instanceof SVGElement && (tag === 'text' || tag === 'tspan')
    if (el instanceof SVGElement && !svgText) continue
    const own = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim()).map((n) => n.textContent).join(' ')
    if (own) check(el, svgText ? cs.fill : cs.color, own, svgText ? 'svg' : 'text')
    if (tag === 'input' || tag === 'textarea' || tag === 'select') {
      const type = el.getAttribute('type') || ''
      if (['checkbox', 'radio', 'range', 'hidden', 'file', 'color'].includes(type)) continue
      if (el.value) check(el, cs.color, String(el.value), 'value')
      if (el.placeholder && !el.value) check(el, getComputedStyle(el, '::placeholder').color, el.placeholder, 'placeholder')
    }
  }
  const sort = (m) => [...m.values()].sort((a, b) => a.ratio - b.ratio)
  return { scheme, checked, failures: sort(failures), unverifiable: sort(unverifiable) }
}
