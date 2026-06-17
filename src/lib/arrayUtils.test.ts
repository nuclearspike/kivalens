import { describe, it, expect } from 'vitest'
import {
  groupBy,
  chunk,
  distinct,
  sortBy,
  percentWhere,
  groupByWithCount,
  groupBySelectWithSum,
} from './arrayUtils'

// sortBy underpins sortLoans; groupBy underpins the limit_to grouping in filter().

describe('sortBy', () => {
  it('sorts ascending by a single selector and does not mutate the input', () => {
    const input = [{ v: 3 }, { v: 1 }, { v: 2 }]
    const out = sortBy(input, { fn: (x) => x.v })
    expect(out.map((x) => x.v)).toEqual([1, 2, 3])
    expect(input.map((x) => x.v)).toEqual([3, 1, 2]) // original untouched
  })

  it('sorts descending when desc is set', () => {
    const out = sortBy([{ v: 1 }, { v: 3 }, { v: 2 }], { fn: (x) => x.v, desc: true })
    expect(out.map((x) => x.v)).toEqual([3, 2, 1])
  })

  it('applies later selectors only to break ties (thenBy)', () => {
    const out = sortBy(
      [
        { a: 1, b: 2 },
        { a: 1, b: 1 },
        { a: 0, b: 9 },
      ],
      { fn: (x) => x.a },
      { fn: (x) => x.b },
    )
    expect(out).toEqual([
      { a: 0, b: 9 },
      { a: 1, b: 1 },
      { a: 1, b: 2 },
    ])
  })

  it('sorts null/undefined values to the front in ascending order', () => {
    const out = sortBy([{ v: 2 }, { v: null }, { v: 1 }], { fn: (x) => x.v })
    expect(out.map((x) => x.v)).toEqual([null, 1, 2])
  })

  it('uses localeCompare for strings', () => {
    const out = sortBy([{ s: 'banana' }, { s: 'apple' }, { s: 'cherry' }], { fn: (x) => x.s })
    expect(out.map((x) => x.s)).toEqual(['apple', 'banana', 'cherry'])
  })
})

describe('groupBy', () => {
  it('groups items by key function', () => {
    const groups = groupBy([1, 2, 3, 4], (n) => n % 2)
    expect(groups).toHaveLength(2)
    expect(groups).toContainEqual([1, 3])
    expect(groups).toContainEqual([2, 4])
  })
})

describe('chunk', () => {
  it('splits into chunks of the given size', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })
  it('returns [] for a non-positive size', () => {
    expect(chunk([1, 2, 3], 0)).toEqual([])
  })
})

describe('distinct', () => {
  it('removes duplicates by strict equality', () => {
    expect(distinct([1, 1, 2, 3, 3])).toEqual([1, 2, 3])
  })
  it('removes duplicates by a custom comparator', () => {
    const out = distinct(
      [{ id: 1 }, { id: 1 }, { id: 2 }],
      (a, b) => a.id === b.id,
    )
    expect(out).toEqual([{ id: 1 }, { id: 2 }])
  })
})

describe('percentWhere', () => {
  it('returns 0 for an empty array', () => {
    expect(percentWhere([], () => true)).toBe(0)
  })
  it('returns the matching percentage', () => {
    expect(percentWhere([1, 2, 3, 4], (n) => n % 2 === 0)).toBe(50)
  })
})

describe('groupByWithCount / groupBySelectWithSum', () => {
  it('counts items per group', () => {
    const res = groupByWithCount(['a', 'a', 'b'], (s) => s)
    expect(res).toContainEqual({ key: 'a', count: 2, items: ['a', 'a'] })
    expect(res).toContainEqual({ key: 'b', count: 1, items: ['b'] })
  })
  it('sums a selected value per group', () => {
    const res = groupBySelectWithSum(
      [{ k: 'x', n: 2 }, { k: 'x', n: 3 }, { k: 'y', n: 5 }],
      (i) => i.k,
      (i) => i.n,
    )
    expect(res).toContainEqual({ key: 'x', sum: 5 })
    expect(res).toContainEqual({ key: 'y', sum: 5 })
  })
})
