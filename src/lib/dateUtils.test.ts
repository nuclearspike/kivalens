import { describe, it, expect } from 'vitest'
import { formatDate, clearTime, startOfNextMonth, monthsBetween, isAfter, isBefore } from './dateUtils'

describe('dateUtils', () => {
  it('formatDate renders MMM-yyyy', () => {
    expect(formatDate(new Date(2027, 0, 15), 'MMM-yyyy')).toBe('Jan-2027')
  })

  it('clearTime zeroes the time portion without mutating input', () => {
    const d = new Date(2027, 5, 17, 13, 45, 30)
    const cleared = clearTime(d)
    expect(cleared.getHours()).toBe(0)
    expect(cleared.getMinutes()).toBe(0)
    expect(cleared.getSeconds()).toBe(0)
    expect(d.getHours()).toBe(13) // original untouched
  })

  it('startOfNextMonth is the 1st at midnight', () => {
    const d = startOfNextMonth()
    expect(d.getDate()).toBe(1)
    expect(d.getHours()).toBe(0)
  })

  it('monthsBetween is absolute (order-independent)', () => {
    const a = new Date(2027, 0, 1)
    const b = new Date(2027, 6, 1)
    expect(monthsBetween(a, b)).toBe(6)
    expect(monthsBetween(b, a)).toBe(6)
  })

  it('isAfter / isBefore compare instants', () => {
    const earlier = new Date(2027, 0, 1)
    const later = new Date(2027, 0, 2)
    expect(isAfter(later, earlier)).toBe(true)
    expect(isBefore(earlier, later)).toBe(true)
    expect(isAfter(earlier, later)).toBe(false)
  })
})
