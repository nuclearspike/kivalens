// In-page check that a page does not scroll sideways, and what causes it when it does.
//
// Run it in the dev server's page at each width worth checking (375, 768, desktop):
//   const { overflowAudit } = await import('/@fs/<repo>/scripts/overflow-audit.browser.js')
//   overflowAudit()   // -> { viewport, scrollWidth, overflows, offenders: [...] }
//
// `overflows` is the verdict: the document is wider than the viewport. `offenders`
// are the outermost elements whose right edge passes the viewport and that no
// ancestor clips: the places to fix. Each names its parent and that parent's
// padding, because the usual cause here is a grid .row (negative side margins)
// inside an element with less side padding than the row's margin. An offender
// with `overflows: false` is content hanging off-screen inside something that
// clips it on purpose (a carousel, the 3D wall); it does not scroll the page.

const describe = (el) =>
  el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : '')

export function overflowAudit(root = document.body) {
  const viewport = document.documentElement.clientWidth
  const past = []
  for (const el of root.querySelectorAll('*')) {
    const rect = el.getBoundingClientRect()
    if (rect.width === 0 || rect.right <= viewport + 0.5) continue
    if (getComputedStyle(el).position === 'fixed') continue
    let clipped = false
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      if (getComputedStyle(p).overflowX !== 'visible' && p.getBoundingClientRect().right <= viewport + 0.5) {
        clipped = true
        break
      }
    }
    if (!clipped) past.push(el)
  }
  const offenders = past
    .filter((el) => !past.includes(el.parentElement))
    .map((el) => ({
      element: describe(el),
      right: Math.round(el.getBoundingClientRect().right),
      marginRight: getComputedStyle(el).marginRight,
      parent: describe(el.parentElement),
      parentPaddingRight: getComputedStyle(el.parentElement).paddingRight,
    }))
  const scrollWidth = document.documentElement.scrollWidth
  return { viewport, scrollWidth, overflows: scrollWidth > window.innerWidth, offenders }
}
