import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { afterNextPaint } from './afterNextPaint'

describe('afterNextPaint', () => {
  let frames: FrameRequestCallback[]

  beforeEach(() => {
    vi.useFakeTimers()
    frames = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('does not run before the frame, even when timers fire first', () => {
    const work = vi.fn()
    afterNextPaint(work)
    vi.advanceTimersByTime(50) // a plain setTimeout(0) would have run by now
    expect(work).not.toHaveBeenCalled()
  })

  it('runs in the task after the frame callback, not inside it', () => {
    const work = vi.fn()
    afterNextPaint(work)
    frames[0](0) // the frame is being prepared: still before paint
    expect(work).not.toHaveBeenCalled()
    vi.advanceTimersByTime(0) // the task posted from the frame: after paint
    expect(work).toHaveBeenCalledTimes(1)
  })

  it('falls back to a timer when no frame ever comes (hidden tab), and never runs twice', () => {
    const work = vi.fn()
    afterNextPaint(work)
    vi.advanceTimersByTime(200)
    expect(work).toHaveBeenCalledTimes(1)
    frames[0](0)
    vi.advanceTimersByTime(10)
    expect(work).toHaveBeenCalledTimes(1)
  })
})
