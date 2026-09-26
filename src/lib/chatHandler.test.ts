import { afterEach, describe, expect, it, vi } from 'vitest'
import { handleChat } from '../../server/aiChat.mjs'
import { createState } from '../../server/klCore.mjs'
import { configureRuntime, memoryUsage, resetRuntime } from '../../server/runtime.mjs'

/**
 * Ask KivaLens's HTTP edge (handleChat): a Fetch Request in, a Response (a
 * server-sent-events stream for a turn) out, or null for another route. These
 * stop short of calling OpenAI.
 */

afterEach(() => {
  vi.unstubAllEnvs()
  resetRuntime()
})

const post = (body: string, path = '/api/chat') =>
  new Request(`http://localhost${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })

const events = async (response: Response) =>
  (await response.text())
    .split('\n\n')
    .filter((line) => line.startsWith('data: '))
    .map((line) => JSON.parse(line.slice(6)))

describe('handleChat', () => {
  it('declines a route that is not the assistant\'s', async () => {
    expect(await handleChat(createState(), new Request('http://localhost/api/start'))).toBeNull()
  })

  it('answers a GET to /api/chat with 405', async () => {
    const res = await handleChat(createState(), new Request('http://localhost/api/chat'))
    expect(res!.status).toBe(405)
  })

  it('refuses a body over 256 KB with 413, and bad JSON with 400', async () => {
    expect((await handleChat(createState(), post('x'.repeat(256 * 1024 + 1))))!.status).toBe(413)
    expect((await handleChat(createState(), post('{not json')))!.status).toBe(400)
  })

  it('says so in the stream when the assistant is turned off', async () => {
    vi.stubEnv('ASK_KIVALENS_ENABLED', 'false')
    const res = (await handleChat(createState(), post('{}')))!
    expect(res.headers.get('content-type')).toMatch(/^text\/event-stream/)
    expect(await events(res)).toEqual([
      { type: 'error', message: 'The KivaLens assistant is currently turned off.' },
      { type: 'done' },
    ])
  })

  it('returns the stream before the budget is read, and reports a spent budget in it', async () => {
    // The budget read can reach Redis; a slow one must not hold the headers.
    vi.stubEnv('ASK_KIVALENS_ENABLED', 'true')
    vi.stubEnv('OPENAI_API_KEY', 'sk-test-not-used')
    let spend!: (usd: number) => void
    const spent = new Promise<number>((resolve) => (spend = resolve))
    configureRuntime({ usage: { ...memoryUsage(), getSpend: () => spent } })

    const pending = handleChat(createState(), post('{"messages":[{"role":"user","content":"hi"}]}'))
    const first = await Promise.race([pending, new Promise((resolve) => setTimeout(() => resolve('still waiting'), 300))])
    expect(first).toBeInstanceOf(Response)

    spend(1_000) // far past any monthly budget
    const got = await events(first as Response)
    expect(got[0]).toMatchObject({ type: 'error', message: expect.stringMatching(/monthly budget/) })
    expect(got.at(-1)).toEqual({ type: 'done' })
  })
})
