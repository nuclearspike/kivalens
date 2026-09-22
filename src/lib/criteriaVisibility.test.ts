// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { SHOW_CRITERIA_KEY, readShowCriteria, useShowCriteria } from './criteriaVisibility'

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('criteria visibility is remembered per browser', () => {
  it('shows the criteria on a first visit', () => {
    expect(renderHook(() => useShowCriteria()).result.current[0]).toBe(true)
  })

  it('hiding them is remembered, so the next visit opens with them hidden', () => {
    const { result } = renderHook(() => useShowCriteria())
    act(() => result.current[1]())
    expect(result.current[0]).toBe(false)
    expect(localStorage.getItem(SHOW_CRITERIA_KEY)).toBe('false')
    expect(renderHook(() => useShowCriteria()).result.current[0]).toBe(false)
  })

  it('showing them again is remembered too', () => {
    localStorage.setItem(SHOW_CRITERIA_KEY, 'false')
    const { result } = renderHook(() => useShowCriteria())
    act(() => result.current[1]())
    expect(result.current[0]).toBe(true)
    expect(readShowCriteria()).toBe(true)
  })

  it('blocked storage means shown, and the toggle still works', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    const { result } = renderHook(() => useShowCriteria())
    expect(result.current[0]).toBe(true)
    act(() => result.current[1]())
    expect(result.current[0]).toBe(false)
  })
})
