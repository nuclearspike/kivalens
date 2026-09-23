import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describePage } from './describePage'
import { ROUTES } from '../../../server/routeMap.mjs'

/**
 * The assistant names a page in two directions — it says which page the lender
 * is on, and it asks to be taken to one. Both now go through the route ids, so
 * the two vocabularies cannot drift apart the way they had.
 */

describe('the assistant knows which page the lender is on', () => {
  it.each([
    ['/stats', 'the Stats page'],
    ['/wall', 'the Wall'],
    ['/basket', 'the Basket'],
    ['/saved', 'the Saved Searches page'],
    ['/partners', 'the Partners page'],
    ['/partners/145', 'a field-partner page'],
    ['/loans/2549812', 'a loan detail page'],
    ['/options', 'the Options page'],
    ['/about', 'the About page'],
    ['/teams', 'the Teams page'],
    ['/search', 'the Search page'],
    ['/nowhere', 'the Search page'],
  ])('%s is %s', (pathname, label) => {
    expect(describePage(pathname)).toBe(label)
  })

  it('recognises Stats, which it could not while the route was called /live', () => {
    expect(describePage('/stats')).toBe('the Stats page')
    expect(describePage('/stats')).not.toBe('the Search page')
  })
})

describe('every page the assistant can be asked for exists', () => {
  const server = readFileSync(path.join(process.cwd(), 'server/aiChat.mjs'), 'utf8')

  it('offers only route ids in its navigate argument', () => {
    const line = /name: 'navigate'[\s\S]{0,400}?enum: \[([^\]]+)\]/.exec(server)
    expect(line).not.toBeNull()
    const pages = line![1].split(',').map((s) => s.trim().replace(/^'|'$/g, ''))
    const ids = new Set(ROUTES.filter((r) => !r.param).map((r) => r.id))
    expect(pages.filter((p) => !ids.has(p as never))).toEqual([])
  })

  it('no longer names a page by a route that was renamed', () => {
    expect(server).not.toMatch(/'\/live'/)
    expect(server).not.toMatch(/'\/portfolio'/)
  })
})
