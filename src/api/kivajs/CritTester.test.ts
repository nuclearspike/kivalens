import { describe, it, expect } from 'vitest'
import { CritTester } from './CritTester'

// CritTester is the predicate-building heart of the matching engine. kiva.ts's
// filter() does nothing more than wire criteria into these testers, so this is
// where filtering bugs would hide. Tests use loose `any` shapes to mirror the
// class's own typing and the real loan/partner objects it runs against.

describe('CritTester.allPass', () => {
  it('passes everything when no testers are added', () => {
    const ct = new CritTester({})
    expect(ct.allPass({ anything: true })).toBe(true)
  })

  it('short-circuits to false when failAll is set, even with passing testers', () => {
    const ct = new CritTester({})
    ct.testers.push(() => true)
    ct.failAll = true
    expect(ct.allPass({})).toBe(false)
  })

  it('returns false (not throw) when a tester throws', () => {
    const ct = new CritTester({})
    ct.testers.push(() => {
      throw new Error('boom')
    })
    expect(ct.allPass({})).toBe(false)
  })

  it('requires every tester to pass (AND semantics)', () => {
    const ct = new CritTester({})
    ct.testers.push((e: any) => e.a === 1)
    ct.testers.push((e: any) => e.b === 2)
    expect(ct.allPass({ a: 1, b: 2 })).toBe(true)
    expect(ct.allPass({ a: 1, b: 3 })).toBe(false)
  })
})

describe('CritTester.addRangeTesters', () => {
  it('enforces an inclusive minimum', () => {
    const ct = new CritTester({ age_min: 30 })
    ct.addRangeTesters('age', (e: any) => e.age)
    expect(ct.allPass({ age: 30 })).toBe(true)
    expect(ct.allPass({ age: 29 })).toBe(false)
  })

  it('enforces an inclusive maximum', () => {
    const ct = new CritTester({ age_max: 40 })
    ct.addRangeTesters('age', (e: any) => e.age)
    expect(ct.allPass({ age: 40 })).toBe(true)
    expect(ct.allPass({ age: 41 })).toBe(false)
  })

  it('enforces a min/max band together', () => {
    const ct = new CritTester({ age_min: 30, age_max: 40 })
    ct.addRangeTesters('age', (e: any) => e.age)
    expect(ct.allPass({ age: 35 })).toBe(true)
    expect(ct.allPass({ age: 29 })).toBe(false)
    expect(ct.allPass({ age: 41 })).toBe(false)
  })

  it('adds no tester when neither bound is present', () => {
    const ct = new CritTester({})
    ct.addRangeTesters('age', (e: any) => e.age)
    expect(ct.testers).toHaveLength(0)
  })

  it('treats a 0 bound as present (not nullish)', () => {
    const ct = new CritTester({ age_min: 0 })
    ct.addRangeTesters('age', (e: any) => e.age)
    expect(ct.testers).toHaveLength(1)
    expect(ct.allPass({ age: -1 })).toBe(false)
  })

  it('honors an override predicate that bypasses the range', () => {
    const ct = new CritTester({ x_min: 5 })
    ct.addRangeTesters(
      'x',
      (e: any) => e.x,
      (e: any) => e.skip === true,
      () => true,
    )
    // x below min, but override fires
    expect(ct.allPass({ x: 1, skip: true })).toBe(true)
    // override does not fire -> range applies
    expect(ct.allPass({ x: 1, skip: false })).toBe(false)
  })
})

describe('CritTester.addAnyAllNoneTester (scalar field)', () => {
  it('defaults to "any": entity value must be one of the criteria values', () => {
    const ct = new CritTester({ sector: ['Food', 'Health'] })
    ct.addAnyAllNoneTester('sector', null, 'any', (e: any) => e.sector)
    expect(ct.allPass({ sector: 'Food' })).toBe(true)
    expect(ct.allPass({ sector: 'Arts' })).toBe(false)
  })

  it('"none": entity value must NOT be one of the criteria values', () => {
    const ct = new CritTester({
      sector: ['Food'],
      sector_all_any_none: 'none',
    })
    ct.addAnyAllNoneTester('sector', null, 'any', (e: any) => e.sector)
    expect(ct.allPass({ sector: 'Arts' })).toBe(true)
    expect(ct.allPass({ sector: 'Food' })).toBe(false)
  })

  it('adds no tester when the criteria list is empty', () => {
    const ct = new CritTester({ sector: [] })
    ct.addAnyAllNoneTester('sector', null, 'any', (e: any) => e.sector)
    expect(ct.testers).toHaveLength(0)
  })
})

describe('CritTester.addAnyAllNoneTester (array field, e.g. tags)', () => {
  it('"all": entity array must contain every criteria value', () => {
    const ct = new CritTester({ tags: ['a', 'b'] }) // default 'all'
    ct.addAnyAllNoneTester('tags', null, 'all', (e: any) => e.tags, true)
    expect(ct.allPass({ tags: ['a', 'b', 'c'] })).toBe(true)
    expect(ct.allPass({ tags: ['a'] })).toBe(false)
  })

  it('"any": entity array must contain at least one criteria value', () => {
    const ct = new CritTester({ tags: ['a', 'b'], tags_all_any_none: 'any' })
    ct.addAnyAllNoneTester('tags', null, 'all', (e: any) => e.tags, true)
    expect(ct.allPass({ tags: ['a', 'x'] })).toBe(true)
    expect(ct.allPass({ tags: ['x', 'y'] })).toBe(false)
  })

  it('"none": entity array must contain none of the criteria values', () => {
    const ct = new CritTester({ tags: ['a'], tags_all_any_none: 'none' })
    ct.addAnyAllNoneTester('tags', null, 'all', (e: any) => e.tags, true)
    expect(ct.allPass({ tags: ['x', 'y'] })).toBe(true)
    expect(ct.allPass({ tags: ['a', 'x'] })).toBe(false)
  })
})

describe('CritTester.addFieldContainsOneOfArrayTester', () => {
  it('passes when the scalar field is in the list, fails otherwise', () => {
    const ct = new CritTester({})
    ct.addFieldContainsOneOfArrayTester(['Food', 'Health'], (e: any) => e.sector)
    expect(ct.allPass({ sector: 'Food' })).toBe(true)
    expect(ct.allPass({ sector: 'Arts' })).toBe(false)
  })

  it('treats a null selector value as a failure', () => {
    const ct = new CritTester({})
    ct.addFieldContainsOneOfArrayTester([1, 2], (e: any) => e.partner_id)
    expect(ct.allPass({ partner_id: null })).toBe(false)
    expect(ct.allPass({ partner_id: 2 })).toBe(true)
  })

  it('sets failAll when given an empty list and failIfEmpty=true', () => {
    // This is the "no partners matched" case in filter(): everything fails.
    const ct = new CritTester({})
    ct.addFieldContainsOneOfArrayTester([], (e: any) => e.partner_id, true)
    expect(ct.failAll).toBe(true)
    expect(ct.allPass({ partner_id: 1 })).toBe(false)
  })
})

describe('CritTester.addThreeStateTester', () => {
  it('"true" requires the value to be exactly true', () => {
    const ct = new CritTester({})
    ct.addThreeStateTester('true', (e: any) => e.flag)
    expect(ct.allPass({ flag: true })).toBe(true)
    expect(ct.allPass({ flag: false })).toBe(false)
  })

  it('"false" requires the value to be exactly false', () => {
    const ct = new CritTester({})
    ct.addThreeStateTester('false', (e: any) => e.flag)
    expect(ct.allPass({ flag: false })).toBe(true)
    expect(ct.allPass({ flag: true })).toBe(false)
  })

  it('adds no tester for an unset value', () => {
    const ct = new CritTester({})
    ct.addThreeStateTester('', (e: any) => e.flag)
    expect(ct.testers).toHaveLength(0)
  })
})

describe('CritTester.addBalancer (portfolio balancing)', () => {
  it('does nothing when disabled', () => {
    const ct = new CritTester({})
    ct.addBalancer({ enabled: false, hideshow: 'show', values: ['Food'] }, (e: any) => e.sector)
    expect(ct.testers).toHaveLength(0)
    expect(ct.failAll).toBe(false)
  })

  it('"show" keeps only entities whose value is in values', () => {
    const ct = new CritTester({})
    ct.addBalancer({ enabled: true, hideshow: 'show', values: ['Food'] }, (e: any) => e.sector)
    expect(ct.allPass({ sector: 'Food' })).toBe(true)
    expect(ct.allPass({ sector: 'Arts' })).toBe(false)
  })

  it('"show" with an empty values array fails everything', () => {
    const ct = new CritTester({})
    ct.addBalancer({ enabled: true, hideshow: 'show', values: [] }, (e: any) => e.sector)
    expect(ct.failAll).toBe(true)
    expect(ct.allPass({ sector: 'Food' })).toBe(false)
  })

  it('"hide" excludes entities whose value is in values', () => {
    const ct = new CritTester({})
    ct.addBalancer({ enabled: true, hideshow: 'hide', values: ['Food'] }, (e: any) => e.sector)
    expect(ct.allPass({ sector: 'Arts' })).toBe(true)
    expect(ct.allPass({ sector: 'Food' })).toBe(false)
  })
})

describe('CritTester.addArrayAllStartWithTester (word-prefix search)', () => {
  it('matches when every search term prefixes some word (case-insensitive)', () => {
    const ct = new CritTester({})
    ct.addArrayAllStartWithTester('mar sell', (e: any) => e.words)
    expect(ct.allPass({ words: ['MARIA', 'SELLS', 'VEGETABLES'] })).toBe(true)
    // "sell" present but "xyz" is not
    const ct2 = new CritTester({})
    ct2.addArrayAllStartWithTester('sell xyz', (e: any) => e.words)
    expect(ct2.allPass({ words: ['MARIA', 'SELLS'] })).toBe(false)
  })

  it('adds no tester for blank input', () => {
    const ct = new CritTester({})
    ct.addArrayAllStartWithTester('   ', (e: any) => e.words)
    expect(ct.testers).toHaveLength(0)
  })
})

describe('CritTester.addSimpleContains', () => {
  it('requires every word to appear as a substring (case-insensitive)', () => {
    const ct = new CritTester({})
    ct.addSimpleContains('food shop', (e: any) => e.text)
    expect(ct.allPass({ text: 'A food shop in town' })).toBe(true)
    expect(ct.allPass({ text: 'A food stall' })).toBe(false)
  })
})
