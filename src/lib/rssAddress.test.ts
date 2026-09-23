import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { criteriaFromParams, criteriaToParams, readableSearch } from '../../server/criteriaUrl.mjs'
import type { Criteria } from '../types'

/**
 * A feed address is the same encoding a Search address uses, so the two read
 * alike and there is one place to change. The original `/rss/<the whole search
 * as JSON>` is still served: those feeds are in readers and always will be.
 */

const core = readFileSync(path.join(process.cwd(), 'server/klCore.mjs'), 'utf8')

describe('the feed endpoint', () => {
  it('still claims the original path shape', () => {
    expect(core).toContain('/^\\/rss\\/(.+)$/')
    expect(core).toMatch(/JSON\.parse\(decodeURIComponent/)
  })

  it('also claims the query shape', () => {
    expect(core).toContain("/^\\/rss(\\/|\\?|$)/")
    expect(core).toContain('criteriaFromParams(params)')
  })

  it('names the feed `feed`, because `name` is a search field', () => {
    expect(core).toContain("params.get('feed')")
    // loan.name is the borrower-name search; a feed called `name` would fight it.
    expect(criteriaFromParams(new URLSearchParams('name=Maria'))).toEqual({
      loan: { name: 'Maria' },
      partner: {},
      portfolio: {},
    })
  })

  it('reads the lender for the portfolio filters from `lender`', () => {
    expect(core).toContain("params.get('lender')")
    expect(core).toContain("link_to: params.get('link_to') || 'kiva'")
  })
})

describe('the address the RSS tab shows', () => {
  const feedUrl = (criteria: Criteria, feed: string, linkTo: string, lender?: string) => {
    const params = criteriaToParams(criteria)
    if (feed.trim()) params.set('feed', feed.trim())
    params.set('link_to', linkTo)
    if (lender) params.set('lender', lender)
    return `https://www.kivalens.org/rss${readableSearch(params)}`
  }

  it('reads as the search it came from', () => {
    expect(
      feedUrl(
        { loan: { country_code: 'KE,UG', sector: 'Agriculture' }, partner: {}, portfolio: {} },
        'Kenya farms',
        'kivalens',
      ),
    ).toBe(
      'https://www.kivalens.org/rss?country_code=KE,UG&sector=Agriculture&feed=Kenya+farms&link_to=kivalens',
    )
  })

  it('carries the lender only when the portfolio filters are wanted', () => {
    const plain = feedUrl({ loan: {}, partner: {}, portfolio: {} }, '', 'kiva')
    expect(plain).toBe('https://www.kivalens.org/rss?link_to=kiva')
    expect(plain).not.toContain('lender=')
    expect(feedUrl({ loan: {}, partner: {}, portfolio: {} }, '', 'kiva', 'examplelender')).toContain(
      'lender=examplelender',
    )
  })

  it('hands the server back exactly the search it was built from', () => {
    const criteria: Criteria = {
      loan: { sector: 'Agriculture', still_needed_min: 25 },
      partner: { direct: 'mfi' },
      portfolio: {},
    }
    const url = new URL(feedUrl(criteria, 'My feed', 'kiva'))
    expect(criteriaFromParams(url.searchParams)).toEqual(criteria)
  })
})
