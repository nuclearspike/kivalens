// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { needsBringingIntoView, scrollIntoViewIfHidden, stickyBottom } from './scrollIntoViewIfHidden'

/**
 * Paul: "yes scroll it into view." In the narrow layout the basket stacks, and a
 * loan opened from the repayment chart appeared below it — the click worked and
 * nothing on screen changed.
 */

const BAR = 35 // the sticky navbar, measured in the wide layout

describe('whether something just opened needs bringing into view', () => {
  it('does when its top is below the window', () => {
    expect(needsBringingIntoView(1400, 812, BAR)).toBe(true)
  })

  it('does when its top is above the window, or hidden under the navbar', () => {
    expect(needsBringingIntoView(-300, 812, BAR)).toBe(true)
    expect(needsBringingIntoView(BAR - 1, 812, BAR)).toBe(true)
  })

  it('does when only a sliver of it shows at the bottom', () => {
    // Measured on a phone: opened from the chart, the loan's top landed at 679
    // of 812 — technically on screen, and still a click that seemed to do nothing.
    expect(needsBringingIntoView(679, 812, BAR)).toBe(true)
    expect(needsBringingIntoView(812 / 2 + 1, 812, BAR)).toBe(true)
  })

  it('does not when its top is already in the upper half, below the navbar', () => {
    // The wide layout: measured, the panel's top sits at 41 under a 35px bar.
    expect(needsBringingIntoView(41, 800, BAR)).toBe(false)
    expect(needsBringingIntoView(BAR, 800, BAR)).toBe(false)
    expect(needsBringingIntoView(400, 800, BAR)).toBe(false)
  })
})

describe('where the navbar ends', () => {
  it('is the height of the sticky bar, where it ends once stuck', () => {
    // Its bottom right now can differ from where it will sit when the scroll
    // ends; its height cannot.
    const bar = document.createElement('nav')
    bar.className = 'navbar sticky-top'
    bar.getBoundingClientRect = () => ({ bottom: 90, height: 52 }) as DOMRect
    document.body.appendChild(bar)
    expect(stickyBottom()).toBe(52)
    bar.remove()
  })

  it('is the top of the window when there is no bar', () => {
    expect(stickyBottom()).toBe(0)
  })
})

describe('scrolling it into view', () => {
  const el = (top: number) => {
    const node = document.createElement('div')
    node.getBoundingClientRect = () => ({ top }) as DOMRect
    return node
  }
  const setMotion = (reduced: boolean) => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: reduced }) as never
  }
  afterEach(() => vi.restoreAllMocks())

  it('lands its top just below the navbar', () => {
    setMotion(false)
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    const bar = document.createElement('nav')
    bar.className = 'navbar sticky-top'
    bar.getBoundingClientRect = () => ({ bottom: 52, height: 52 }) as DOMRect
    document.body.appendChild(bar)
    Object.defineProperty(window, 'scrollY', { value: 195, configurable: true })
    scrollIntoViewIfHidden(el(679 + 2000))
    // From 195 down by (top - bar): the top arrives exactly at the bar's edge.
    expect(scrollTo).toHaveBeenCalledWith({ top: 195 + 2679 - 52, behavior: 'smooth' })
    bar.remove()
  })

  it('leaves the page alone when its top is already in the upper half', () => {
    setMotion(false)
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    scrollIntoViewIfHidden(el(120))
    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('jumps rather than glides for someone who has asked for less motion', () => {
    setMotion(true)
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    scrollIntoViewIfHidden(el(window.innerHeight + 500))
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'auto' }))
  })

  it('does not ask again for the place it is already on its way to', () => {
    // Mid-way through a smooth scroll the element is still low; asking again
    // restarts the animation instead of letting it finish.
    setMotion(false)
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true })
    const sent = scrollIntoViewIfHidden(el(1000))
    expect(sent).toBe(1000)
    expect(scrollTo).toHaveBeenCalledTimes(1)
    // The panel grew by nothing that moves its top: same destination, no call.
    expect(scrollIntoViewIfHidden(el(1000), sent)).toBe(1000)
    expect(scrollTo).toHaveBeenCalledTimes(1)
    // Content above it moved it further down: a new destination, a new call.
    expect(scrollIntoViewIfHidden(el(1200), sent)).toBe(1200)
    expect(scrollTo).toHaveBeenCalledTimes(2)
  })

  it('does nothing without an element', () => {
    expect(() => scrollIntoViewIfHidden(null)).not.toThrow()
  })
})

describe('the pages that open things into a panel', () => {
  const read = (file: string) => readFileSync(path.join(process.cwd(), file), 'utf8')
  const basket = read('src/components/Basket.tsx')
  const search = read('src/components/Search.tsx')
  const partners = read('src/components/Partners.tsx')
  const loanRow = read('src/components/LoanListItem.tsx')

  it('basket: a row and a chart band both open through openLoan, which marks the open', () => {
    expect(basket).toContain('onSelectLoan={openLoan}')
    expect(basket).toMatch(/const handleSelect = \(id: number\) => \{\s*openLoan\(id\)/)
    expect(basket).toMatch(/const panelRef = useRevealOnOpen<HTMLDivElement>\(\)/)
    expect(basket).toContain('ref={panelRef}')
    // One mechanism for every page, not a second one local to the basket.
    expect(basket).not.toContain('scrollAfterOpen')
  })

  it('search: a loan row marks the open, and the loan panel is what comes into view', () => {
    expect(loanRow).toContain('onClick={() => markOpenIntent()}')
    expect(search).toMatch(/const detailRef = useRevealOnOpen<HTMLDivElement>\(\)/)
    expect(search).toContain('<Col ref={detailRef} md={detailCol}')
  })

  it('partners: a partner row marks the open, and the detail column comes into view', () => {
    expect(partners).toMatch(/to=\{`\/partners\/\$\{partner\.id\}`\}\s*onClick=\{\(\) => markOpenIntent\(\)\}/)
    expect(partners).toMatch(/const detailRef = useRevealOnOpen<HTMLDivElement>\(\)/)
    expect(partners).toContain('<div ref={detailRef} className="col-md-5">')
  })

  it('assumes no navbar height anywhere — it is measured', () => {
    const lib = read('src/lib/scrollIntoViewIfHidden.ts')
    expect(lib).not.toMatch(/\b60\b/)
    expect(read('src/styles/main.scss')).not.toContain('kl-basket-loan-panel')
  })
})
