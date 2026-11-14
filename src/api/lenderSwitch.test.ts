/**
 * The lender's own loans are read 500 ms after a lender ID is set, so that a page can exclude
 * them. A lender ID changed while that read is under way is read anew, and the earlier read's
 * answer is dropped instead of being taken for the new lender's.
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Loans, type NotifyMessage } from './kiva'
import { LenderFundraisingLoans } from './kivajs/LenderFundraisingLoans'
import { held } from '../test/lateWork'

let kl: Loans
let heard: NotifyMessage[]

beforeEach(() => {
  vi.useFakeTimers()
  kl = new Loans()
  heard = []
  kl.onNotify((msg) => { heard.push(msg) })
})
afterEach(() => {
  kl.kill()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

const done = () => heard.filter((m) => m.lender_loans_event === 'done').length

describe("a lender ID changed while the last one's loans are being read", () => {
  it("reads the new lender's loans, and keeps them, whichever answer comes back first", async () => {
    const first = held<number[]>()
    const second = held<number[]>()
    const ids = vi.spyOn(LenderFundraisingLoans.prototype, 'ids')
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
    kl.setLender('firstlender')
    await vi.advanceTimersByTimeAsync(500)
    kl.setLender('secondlender')
    await vi.advanceTimersByTimeAsync(500)
    expect(ids).toHaveBeenCalledTimes(2)
    second.resolve([2])
    await vi.advanceTimersByTimeAsync(0)
    first.resolve([1])
    await vi.advanceTimersByTimeAsync(0)
    expect(kl.lenderId).toBe('secondlender')
    expect(kl.lenderLoans.secondlender).toEqual([2])
    expect(kl.lenderLoans.firstlender).toEqual([])
    expect(done()).toBe(1)
  })

  it('cleared while a read is under way, stops the page waiting at once and drops the answer', async () => {
    const first = held<number[]>()
    vi.spyOn(LenderFundraisingLoans.prototype, 'ids').mockReturnValueOnce(first.promise)
    kl.setLender('firstlender')
    await vi.advanceTimersByTimeAsync(500)
    kl.setLender('')
    expect(done()).toBe(1)
    first.resolve([1])
    await vi.advanceTimersByTimeAsync(0)
    expect(kl.lenderId).toBe('')
    expect(kl.lenderLoans.firstlender).toEqual([])
    expect(done()).toBe(1)
  })

  it('the same lender set again while it is being read is read once', async () => {
    const first = held<number[]>()
    const ids = vi.spyOn(LenderFundraisingLoans.prototype, 'ids').mockReturnValue(first.promise)
    kl.setLender('firstlender')
    await vi.advanceTimersByTimeAsync(500)
    // The read has gone out; the same ID is set again (the store does this as the page starts).
    kl.setLender('firstlender')
    await vi.advanceTimersByTimeAsync(500)
    expect(ids).toHaveBeenCalledTimes(1)
    first.resolve([1])
    await vi.advanceTimersByTimeAsync(0)
    expect(kl.lenderLoans.firstlender).toEqual([1])
  })

  it('a lender ID changed before its read has started is read only for the new lender', async () => {
    const ids = vi.spyOn(LenderFundraisingLoans.prototype, 'ids').mockResolvedValue([2])
    kl.setLender('firstlender')
    kl.setLender('secondlender')
    await vi.advanceTimersByTimeAsync(500)
    expect(ids).toHaveBeenCalledTimes(1)
    expect(kl.lenderLoans.secondlender).toEqual([2])
  })

  it("an earlier lender's read that fails after another ID was set is reported, and leaves the new read alone", async () => {
    const reported: string[] = []
    vi.stubGlobal('reportError', (error: unknown) => { reported.push((error as Error).message) })
    try {
      const first = held<number[]>()
      const second = held<number[]>()
      vi.spyOn(LenderFundraisingLoans.prototype, 'ids').mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
      kl.setLender('firstlender')
      await vi.advanceTimersByTimeAsync(500)
      kl.setLender('secondlender')
      await vi.advanceTimersByTimeAsync(500)
      first.reject(new Error('HTTP 503'))
      await vi.advanceTimersByTimeAsync(0)
      expect(reported).toEqual(["Reading the lender's own loans from Kiva failed: HTTP 503"])
      // Still waiting on the new lender's read: nothing was marked done or failed.
      expect(done()).toBe(0)
      second.resolve([2])
      await vi.advanceTimersByTimeAsync(0)
      expect(kl.lenderLoans.secondlender).toEqual([2])
      expect(done()).toBe(1)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('killed with two lender IDs set in a row, keeps no timer', () => {
    kl.setLender('firstlender')
    kl.setLender('secondlender')
    kl.kill()
    expect(vi.getTimerCount()).toBe(0)
  })

  it("killed while a lender's loans are being read, takes none of the answer in", async () => {
    const first = held<number[]>()
    vi.spyOn(LenderFundraisingLoans.prototype, 'ids').mockReturnValueOnce(first.promise)
    kl.setLender('firstlender')
    await vi.advanceTimersByTimeAsync(500)
    kl.kill()
    first.resolve([1])
    await vi.advanceTimersByTimeAsync(0)
    expect(kl.lenderLoans.firstlender).toEqual([])
    expect(done()).toBe(0)
  })

  it('a lender ID cleared before its read has started is not read', async () => {
    const ids = vi.spyOn(LenderFundraisingLoans.prototype, 'ids').mockResolvedValue([1])
    kl.setLender('firstlender')
    kl.setLender('')
    await vi.advanceTimersByTimeAsync(500)
    expect(ids).not.toHaveBeenCalled()
  })

  it("killed right after it was asked for a portfolio figure, does not read it", async () => {
    kl.lenderId = 'somelender'
    const read = vi.spyOn(kl, 'loadBalancerData').mockResolvedValue(undefined as never)
    kl.balancerSlices('country', 'active')
    kl.kill()
    await vi.advanceTimersByTimeAsync(0)
    expect(read).not.toHaveBeenCalled()
  })
})
