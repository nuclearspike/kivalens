/**
 * Groups array elements by a key function. Returns an array of groups (each group is an array).
 */
export function groupBy<T, K>(arr: T[], keyFn: (item: T) => K): T[][] {
  const map = new Map<K, T[]>()
  for (const item of arr) {
    const key = keyFn(item)
    const group = map.get(key)
    if (group) {
      group.push(item)
    } else {
      map.set(key, [item])
    }
  }
  return [...map.values()]
}

/**
 * Splits an array into chunks of the given size.
 */
export function chunk<T>(arr: T[], size: number): T[][] {
  if (size <= 0) return []
  const result: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size))
  }
  return result
}

/**
 * Returns a new array with duplicates removed.
 * If compareFn is provided, uses it to determine equality; otherwise uses strict equality.
 */
export function distinct<T>(arr: T[], compareFn?: (a: T, b: T) => boolean): T[] {
  if (!compareFn) {
    return [...new Set(arr)]
  }
  const result: T[] = []
  for (const item of arr) {
    if (!result.some((existing) => compareFn(existing, item))) {
      result.push(item)
    }
  }
  return result
}

interface SortSelector<T> {
  fn: (item: T) => unknown
  desc?: boolean
}

/**
 * Returns a new sorted array using multiple selectors (thenBy-style chaining).
 * Uses .toSorted() for immutability.
 */
export function sortBy<T>(arr: T[], ...selectors: SortSelector<T>[]): T[] {
  return arr.toSorted((a, b) => {
    for (const { fn, desc } of selectors) {
      const aVal = fn(a)
      const bVal = fn(b)
      let cmp = 0
      if (aVal == null && bVal == null) cmp = 0
      else if (aVal == null) cmp = -1
      else if (bVal == null) cmp = 1
      else if (typeof aVal === 'string' && typeof bVal === 'string') cmp = aVal.localeCompare(bVal)
      else if (aVal < bVal) cmp = -1
      else if (aVal > bVal) cmp = 1

      if (cmp !== 0) return desc ? -cmp : cmp
    }
    return 0
  })
}

/**
 * Returns the percentage of items in the array that match the predicate.
 */
export function percentWhere<T>(arr: T[], predicate: (item: T) => boolean): number {
  if (arr.length === 0) return 0
  const count = arr.filter(predicate).length
  return (count / arr.length) * 100
}

interface GroupCount<K> {
  key: K
  count: number
  items: unknown[]
}

/**
 * Groups by key and returns each group's key, count, and items.
 */
export function groupByWithCount<T, K>(arr: T[], keyFn: (item: T) => K): GroupCount<K>[] {
  const map = new Map<K, T[]>()
  for (const item of arr) {
    const key = keyFn(item)
    const group = map.get(key)
    if (group) {
      group.push(item)
    } else {
      map.set(key, [item])
    }
  }
  return [...map.entries()].map(([key, items]) => ({ key, count: items.length, items }))
}

interface GroupSum<K> {
  key: K
  sum: number
}

/**
 * Groups by key, selects a numeric value from each item, and sums per group.
 */
export function groupBySelectWithSum<T, K>(
  arr: T[],
  keyFn: (item: T) => K,
  valueFn: (item: T) => number
): GroupSum<K>[] {
  const map = new Map<K, number>()
  for (const item of arr) {
    const key = keyFn(item)
    map.set(key, (map.get(key) ?? 0) + valueFn(item))
  }
  return [...map.entries()].map(([key, sum]) => ({ key, sum }))
}

/**
 * Flattens a nested array by one level. Equivalent to arr.flat().
 */
export function flatten<T>(arr: T[][]): T[] {
  return arr.flat()
}
