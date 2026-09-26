import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { handleChat } from '../../server/aiChat.mjs'
import { createState } from '../../server/klCore.mjs'
import { configureRuntime, memoryUsage, resetRuntime } from '../../server/runtime.mjs'

/**
 * /api/translate: the lender gets the translation as soon as the model gives
 * it. OpenAI is a stand-in fetch, installed before the client is first made
 * (the client keeps the fetch it was created with).
 */

const originalFetch = globalThis.fetch
beforeAll(() => {
  vi.stubEnv('OPENAI_API_KEY', 'sk-test-not-used')
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input)
    if (!url.includes('/chat/completions')) return originalFetch(input, init)
    return new Response(
      JSON.stringify({
        id: 'chatcmpl-test',
        object: 'chat.completion',
        created: 0,
        model: 'gpt-4o-mini',
        choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: 'Hola, mundo' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  }) as typeof fetch
})
afterAll(() => {
  globalThis.fetch = originalFetch
  vi.unstubAllEnvs()
  resetRuntime()
})

describe('translation', () => {
  it('answers as soon as the model does, and hands the spend write to the host to finish', async () => {
    let release!: () => void
    const written = new Promise<void>((resolve) => (release = resolve))
    const addSpend = vi.fn(() => written)
    configureRuntime({ usage: { ...memoryUsage(), addSpend } })
    const kept: Promise<unknown>[] = []

    const pending = handleChat(
      createState(),
      new Request('http://localhost/api/translate', { method: 'POST', body: JSON.stringify({ text: 'Hello, world', lang: 'es' }) }),
      { waitUntil: (p) => void kept.push(p) },
    )
    const first = await Promise.race([pending, new Promise((resolve) => setTimeout(() => resolve('still waiting'), 300))])

    expect(first).toBeInstanceOf(Response)
    expect(await (first as Response).json()).toEqual({ translation: 'Hola, mundo' })
    expect(addSpend).toHaveBeenCalledTimes(1) // the write was started
    expect(kept).toHaveLength(1) // and given to the host to keep alive:
    let done = false
    void kept[0].then(() => (done = true))
    for (let i = 0; i < 20; i++) await Promise.resolve()
    expect(done).toBe(false) // what the host keeps alive is the write itself
    release()
    await kept[0]
    expect(done).toBe(true)
  })
})
