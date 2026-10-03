// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { resolveLegacyUrl, formatUrl } from '../../server/routeMap.mjs'

/**
 * /basket?clear=1 is where Kiva's retired basket address sent the checkout tab
 * back to, and #/clear-basket is the address before that. Either can still
 * arrive from history or an old tab, so both have to land in the same place and
 * be handled the same way.
 */

const basket = readFileSync(path.join(process.cwd(), 'src/components/Basket.tsx'), 'utf8')

describe('an address from an old checkout', () => {
  it('reads the flag on arrival and takes it back out of the address', () => {
    expect(basket).toMatch(/searchParams\.has\('clear'\)/)
    expect(basket).toMatch(/rest\.delete\('clear'\)/)
    expect(basket).toMatch(/setSearchParams\(rest, \{ replace: true \}\)/)
  })

  it('tells other tabs the hand-off is over, and empties nothing by itself', () => {
    expect(basket).toMatch(/postMessage\(\{ type: 'checkout-returned' \}\)/)
    // Clearing on the flag alone would assume a lend that may not have
    // happened: it says a basket was handed over, not that it was paid for.
    const handler = basket.slice(basket.indexOf("searchParams.has('clear')"))
    expect(handler.slice(0, 900)).not.toMatch(/clearBasket\(/)
  })

  it('arrives at the same place from the address Kiva was given for years', () => {
    const old = resolveLegacyUrl({ pathname: '/', hash: '#/clear-basket' })
    expect(formatUrl(old!)).toBe('/basket?clear=1')
  })
})
