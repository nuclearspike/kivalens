import { afterEach, describe, expect, it, vi } from 'vitest'
import { HttpStatusError, postUrl } from './kivaBase'

afterEach(() => vi.unstubAllGlobals())

describe('a refused request to Kiva', () => {
  it('is reported by its status alone, never with what Kiva answered', async () => {
    // The message reaches the error collector, and Kiva's answer can name a lender.
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"message":"lender example_lender not found"}', { status: 404 })))
    const error = await postUrl('https://www.kiva.org/graphql', '{ x }').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(HttpStatusError)
    expect((error as HttpStatusError).status).toBe(404)
    expect((error as Error).message).toBe('HTTP 404')
  })
})
