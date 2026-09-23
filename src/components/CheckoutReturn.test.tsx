// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { resolveLegacyUrl, formatUrl } from '../../server/routeMap.mjs'

/**
 * Kiva is handed a callback address in the checkout POST and sends the checkout
 * tab back to it when the basket is set. Every checkout already in flight, and
 * anything Kiva has recorded, carries the old one — so both have to arrive at
 * the same place.
 */

const basket = readFileSync(path.join(process.cwd(), 'src/components/Basket.tsx'), 'utf8')

describe('the checkout callback', () => {
  it('is the basket page with the flag the page reads', () => {
    const line = /const callbackUrl = `([^`]+)`/.exec(basket)
    expect(line).not.toBeNull()
    expect(line![1]).toBe('${location.protocol}//${location.host}/basket?clear=1')
  })

  it('is an address of this app, not one built from whatever page is showing', () => {
    // Built from location.pathname it would name the page the lender happened
    // to be on when they pressed checkout.
    expect(basket).not.toMatch(/const callbackUrl[^\n]*location\.pathname/)
  })

  it('reads the flag on arrival and takes it back out of the address', () => {
    expect(basket).toMatch(/searchParams\.has\('clear'\)/)
    expect(basket).toMatch(/rest\.delete\('clear'\)/)
    expect(basket).toMatch(/setSearchParams\(rest, \{ replace: true \}\)/)
  })

  it('tells other tabs the hand-off is over, and empties nothing by itself', () => {
    expect(basket).toMatch(/postMessage\(\{ type: 'checkout-returned' \}\)/)
    // Clearing on the callback alone would assume a lend that may not have
    // happened: the callback fires when the basket is SET.
    const handler = basket.slice(basket.indexOf("searchParams.has('clear')"))
    expect(handler.slice(0, 900)).not.toMatch(/clearBasket\(/)
  })

  it('arrives at the same place as the address Kiva was given for years', () => {
    const old = resolveLegacyUrl({ pathname: '/', hash: '#/clear-basket' })
    expect(formatUrl(old!)).toBe('/basket?clear=1')
  })
})
