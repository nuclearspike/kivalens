import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildSystemPrompt, handleChat, lenderPromptShare } from '../../server/aiChat.mjs'
import { costOf, estimateInputTokens, estimateOutputTokens, utf8Length } from '../../server/aiUsage.mjs'
import { createState } from '../../server/klCore.mjs'
import { configureRuntime, memoryUsage, resetRuntime } from '../../server/runtime.mjs'

/**
 * What an Ask KivaLens turn costs against the month's budget, however it ends.
 * OpenAI reports usage only with a finished response and keeps no copy of one
 * abandoned mid-stream, so a round that stops early is charged an estimate. OpenAI
 * is a stand-in fetch serving each round's events from a script, installed before
 * the client is first made (the client keeps the fetch it was created with).
 */

type Event = Record<string, unknown> & { type: string }
type Round =
  // Stream these events, then end (the default) or hold the stream open; `idle` runs
  // once the reader has taken everything and asks for more.
  | { events: Event[]; end?: boolean; idle?: () => void }
  | { refuse: number; before?: () => void } // answer with this HTTP status (after `before`)
  | { hold: true } // never answer; fail only when aborted
  | { lose: true } // the connection fails before any answer

const MODEL = 'gpt-4o-mini'
const originalFetch = globalThis.fetch
let script: Round[] = []
let sent: string[] = []
let body = '{}'
// Called when a tool asks Kiva for a lender's profile (get_lender_profile), before Kiva answers.
let onKivaLender: (() => void) | null = null

const aborted = () => Object.assign(new Error('This operation was aborted'), { name: 'AbortError' })

beforeAll(() => {
  vi.stubEnv('OPENAI_API_KEY', 'sk-test-not-used')
  vi.stubEnv('ASK_KIVALENS_ENABLED', 'true')
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input)
    if (url.includes('api.kivaws.org') && url.includes('/lenders/')) {
      onKivaLender?.()
      return new Response('{}', { status: 404 })
    }
    if (!url.startsWith('https://api.openai.com/v1/responses')) return originalFetch(input, init)
    sent.push(String(init?.body))
    const round = script.shift()
    const signal = init?.signal
    if (!round) throw new Error('no scripted round left')
    if ('lose' in round) throw new TypeError('fetch failed')
    if ('refuse' in round) {
      round.before?.()
      return new Response(JSON.stringify({ error: { message: 'refused', type: 'invalid_request_error' } }), {
        status: round.refuse,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    if ('hold' in round)
      return new Promise<Response>((_resolve, reject) => signal?.addEventListener('abort', () => reject(aborted())))
    const encoder = new TextEncoder()
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        signal?.addEventListener('abort', () => {
          try {
            controller.error(aborted())
          } catch {
            // already finished
          }
        })
        for (const event of round.events)
          controller.enqueue(encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`))
        if (round.end !== false) controller.close()
      },
      pull() {
        // The SDK reads ahead of what it has handed on; let it catch up first, once.
        const idle = round.idle
        if (idle) {
          round.idle = undefined
          setTimeout(idle, 20)
        }
      },
    })
    return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
  }) as typeof fetch
})
afterAll(() => {
  globalThis.fetch = originalFetch
  vi.unstubAllEnvs()
  resetRuntime()
})

let spent: number[]
let logged: Array<Record<string, unknown>>
beforeEach(() => {
  script = []
  sent = []
  onKivaLender = null
  spent = []
  logged = []
  configureRuntime({
    usage: {
      ...memoryUsage(),
      addSpend: async (_month: string, usd: number) => void spent.push(usd),
      pushLog: async (entry: Record<string, unknown>) => void logged.push(entry),
    },
  })
})

// Responses API events, as OpenAI streams them.
const created = { type: 'response.created', response: { id: 'resp_1', status: 'in_progress', usage: null, output: [] } }
const delta = (text: string) => ({ type: 'response.output_text.delta', item_id: 'msg_1', output_index: 0, content_index: 0, delta: text })
const message = (text: string) => ({ type: 'message', id: 'msg_1', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text, annotations: [] }] })
const toolCall = { type: 'function_call', id: 'fc_1', call_id: 'call_1', name: 'get_basket', arguments: '{}', status: 'completed' }
const usage = (input: number, output: number) => ({ input_tokens: input, output_tokens: output, total_tokens: input + output })
const completed = (output: unknown[], use = usage(1000, 20)) => ({ type: 'response.completed', response: { id: 'resp_1', status: 'completed', usage: use, output } })

/**
 * One turn: `leave` is called with the lender's leave() once the reply stream is
 * readable, and says when to leave. Resolves once the turn is charged and logged.
 */
async function turn(
  leave?: (go: () => void, events: Array<Record<string, unknown>>) => void,
  lenderId?: string,
  rawBody?: string, // what the browser sends, verbatim, instead of the usual question
) {
  const browser = new AbortController()
  const kept: Promise<unknown>[] = []
  const res = (await handleChat(
    createState(),
    new Request('http://localhost/api/chat', {
      method: 'POST',
      body: (body = rawBody ?? JSON.stringify({ messages: [{ role: 'user', content: 'What does KivaLens do?' }], locale: 'en', lenderId })),
      signal: browser.signal,
    }),
    { waitUntil: (p) => void kept.push(p) },
  ))!
  const events: Array<Record<string, unknown>> = []
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  leave?.(() => browser.abort(), events)
  for (;;) {
    const chunk = await Promise.race([reader.read(), new Promise<null>((r) => browser.signal.addEventListener('abort', () => r(null)))])
    if (!chunk || chunk.done) break
    buffer += decoder.decode(chunk.value, { stream: true })
    let i
    while ((i = buffer.indexOf('\n\n')) >= 0) {
      const line = buffer.slice(0, i)
      buffer = buffer.slice(i + 2)
      if (line.startsWith('data: ')) events.push(JSON.parse(line.slice(6)))
    }
  }
  await Promise.all(kept)
  expect(logged).toHaveLength(1)
  return { entry: logged[0], events }
}

// The estimate the server makes for request i: its lender share measured against the
// prompt built with nothing from the lender (the turn's state is an empty catalog too).
const inputEstimate = (i: number) => {
  const request = JSON.parse(sent[i])
  return estimateInputTokens(request, lenderPromptShare(createState(), request.instructions, JSON.parse(body).locale ?? 'en'))
}

describe('what an Ask KivaLens turn is charged', () => {
  it('charges a completed turn exactly what OpenAI reported', async () => {
    script = [{ events: [created, delta('KivaLens finds loans.'), completed([message('KivaLens finds loans.')])] }]
    const { entry } = await turn()
    expect(entry).toMatchObject({ outcome: 'completed', estimated: false, rounds: 1, promptTokens: 1000, completionTokens: 20 })
    expect(spent).toEqual([costOf(MODEL, 1000, 20)])
  })

  it('charges a turn the lender leaves mid-reply: the request as sent and the reply so far', async () => {
    script = [{ events: [created, delta('Kiva')], end: false }]
    const { entry } = await turn((go, events) => {
      const wait = setInterval(() => {
        if (events.some((e) => e.type === 'token')) {
          clearInterval(wait)
          go()
        }
      }, 1)
    })
    const input = inputEstimate(0)
    expect(input).toBeGreaterThan(1000) // the real system prompt and tools, not a token count of zero
    expect(entry).toMatchObject({ outcome: 'abandoned', estimated: true, rounds: 1, promptTokens: input, completionTokens: 1, response: 'Kiva' })
    expect(spent).toEqual([costOf(MODEL, input, 1)])
  })

  it('counts reply text that arrived in bytes, so a reply in Japanese is not counted as English', async () => {
    const text = 'こんにちは' // one delta: five characters, fifteen bytes
    script = [{ events: [created, delta(text)], end: false }]
    const { entry } = await turn((go, events) => {
      const wait = setInterval(() => {
        if (events.some((e) => e.type === 'token')) {
          clearInterval(wait)
          go()
        }
      }, 1)
    })
    expect(entry.completionTokens).toBe(estimateOutputTokens(1, utf8Length(text)))
    expect(entry.completionTokens).toBe(4)
  })

  it('counts every field the lender sent that reaches the prompt at a token per byte', async () => {
    // Digits and commas never merge in gpt-4o-mini's tokenizer: this is 80,000 tokens.
    const dense = '1,'.repeat(40000)
    const nested = '{"a":'.repeat(10000) + '1' + '}'.repeat(10000) // JSON.stringify cannot even measure this
    const padding = `[${Array(6000).fill('1e20').join(',')}]` // 4 bytes each as sent, 21 re-serialized
    const criteria = `{"loan":{"name":"${dense}"}}`
    const bodies = [
      JSON.stringify({ messages: [{ role: 'user', content: 'hi' }], shownCount: dense, totalCount: 1 }),
      JSON.stringify({ messages: [{ role: 'user', content: 'hi' }], shownCount: 0, totalCount: dense }),
      `{"messages":[{"role":"user","content":"hi"}],"criteria":{"loan":{"name":"${dense}"},"unused":${nested}}}`,
      `{"messages":[{"role":"user","content":"hi"}],"criteria":${criteria},"applicationStorage":{"AskKivaLens:x":${padding}}}`,
      `{"messages":[{"role":"user","content":"hi","unused":${padding}}],"criteria":${criteria}}`,
    ]
    for (const raw of bodies) {
      logged = []
      script = [{ hold: true }]
      const { entry } = await turn(
        (go) => {
          const wait = setInterval(() => {
            if (sent.length) {
              clearInterval(wait)
              go()
            }
          }, 1)
        },
        undefined,
        raw,
      )
      expect(entry.outcome).toBe('abandoned')
      expect(entry.promptTokens).toBeGreaterThanOrEqual(dense.length)
    }
  })

  it('counts what reached the prompt, even when it grew on the way', async () => {
    // Numbers written 1e20 arrive as 4 bytes and are copied into the prompt as 21.
    const raw = `{"messages":[{"role":"user","content":"hi"}],"savedSearches":[${Array(6000).fill('1e20').join(',')}]}`
    const copied = Array(6000).fill(String(1e20)).join(', ')
    logged = []
    script = [{ hold: true }]
    const { entry } = await turn(
      (go) => {
        const wait = setInterval(() => {
          if (sent.length) {
            clearInterval(wait)
            go()
          }
        }, 1)
      },
      undefined,
      raw,
    )
    expect(JSON.parse(sent[0]).instructions).toContain(copied)
    expect(entry.promptTokens).toBeGreaterThanOrEqual(utf8Length(copied))
  })

  it('charges the input of a request the lender left while it was on its way', async () => {
    script = [{ hold: true }]
    const { entry } = await turn((go) => {
      const wait = setInterval(() => {
        if (sent.length) {
          clearInterval(wait)
          go()
        }
      }, 1)
    })
    const input = inputEstimate(0)
    expect(entry).toMatchObject({ outcome: 'abandoned', estimated: true, rounds: 1, promptTokens: input, completionTokens: 0 })
    expect(spent).toEqual([costOf(MODEL, input, 0)])
  })

  it('charges the rounds that finished before the lender left, and sends no more', async () => {
    // The lender leaves while a tool from the first round is waiting on Kiva.
    const profile = { ...toolCall, name: 'get_lender_profile' }
    script = [{ events: [created, completed([profile])] }, { events: [created, completed([message('unused')])] }]
    const { entry } = await turn((go) => (onKivaLender = go), 'somelender')
    expect(sent).toHaveLength(1)
    expect(entry).toMatchObject({ outcome: 'abandoned', estimated: false, rounds: 1, promptTokens: 1000, completionTokens: 20 })
    expect(spent).toEqual([costOf(MODEL, 1000, 20)])
  })

  it('charges a reply that reached its length limit what OpenAI reported, and says so', async () => {
    const incomplete = { type: 'response.incomplete', response: { id: 'resp_1', status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' }, usage: usage(1000, 900), output: [message('A long list…')] } }
    script = [{ events: [created, delta('A long list…'), incomplete] }]
    const { entry } = await turn()
    expect(entry).toMatchObject({ outcome: 'incomplete', incompleteReason: 'max_output_tokens', estimated: false, rounds: 1, promptTokens: 1000, completionTokens: 900 })
    expect(spent).toEqual([costOf(MODEL, 1000, 900)])
  })

  it('charges a reply KivaLens cut short, and says so', async () => {
    const reply = 'Here is a chart ![chart](data:image/png;base64,iVBORw0KGgo'
    script = [{ events: [created, delta(reply)], end: false }]
    const { entry, events } = await turn()
    const input = inputEstimate(0)
    expect(entry).toMatchObject({ outcome: 'cut', estimated: true, rounds: 1, promptTokens: input, completionTokens: estimateOutputTokens(1, reply.length) })
    expect(spent).toEqual([costOf(MODEL, input, estimateOutputTokens(1, reply.length))])
    expect(events.at(-1)).toEqual({ type: 'done' })
  })

  it('charges every round of a turn that fails mid-reply, and tells the lender', async () => {
    const failed = { type: 'response.failed', response: { id: 'resp_2', status: 'failed', error: { message: 'server_error' } } }
    script = [{ events: [created, completed([toolCall])] }, { events: [created, delta('Your'), failed] }]
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { entry, events } = await turn()
    const second = inputEstimate(1)
    expect(sent).toHaveLength(2)
    expect(entry).toMatchObject({ outcome: 'failed', estimated: true, rounds: 2, promptTokens: 1000 + second, completionTokens: 21, response: 'Your' })
    expect(spent).toEqual([costOf(MODEL, 1000 + second, 21)])
    expect(events.slice(-2)).toEqual([{ type: 'error', message: 'Sorry — something went wrong. Please try again.' }, { type: 'done' }])
  })

  it('records why OpenAI stopped a reply, such as its content filter', async () => {
    const filtered = { type: 'response.incomplete', response: { id: 'resp_1', status: 'incomplete', incomplete_details: { reason: 'content_filter' }, usage: usage(1000, 5), output: [] } }
    script = [{ events: [created, delta('I can'), filtered] }]
    const { entry } = await turn()
    expect(entry).toMatchObject({ outcome: 'incomplete', incompleteReason: 'content_filter', promptTokens: 1000, completionTokens: 5 })
  })

  it('charges the tool-call arguments already streamed when the lender leaves', async () => {
    const argsDelta = (text: string) => ({ type: 'response.function_call_arguments.delta', item_id: 'fc_1', output_index: 0, delta: text })
    let leave!: () => void
    // Japanese arguments: eleven characters, seventeen bytes, counted as bytes.
    script = [{ events: [created, argsDelta('{"q":"日本'), argsDelta('語"}')], end: false, idle: () => leave() }]
    const { entry } = await turn((go) => (leave = go))
    const input = inputEstimate(0)
    expect(entry).toMatchObject({ outcome: 'abandoned', estimated: true, promptTokens: input, completionTokens: estimateOutputTokens(2, 17) })
    expect(entry.completionTokens).toBe(5)
  })

  it('charges an attempt OpenAI never answered as well as the one that followed', async () => {
    // The connection fails before any answer; the SDK retries, and the retry completes.
    script = [{ lose: true }, { events: [created, delta('KivaLens finds loans.'), completed([message('KivaLens finds loans.')])] }]
    const { entry } = await turn()
    expect(sent).toHaveLength(2)
    const lost = inputEstimate(0)
    expect(entry).toMatchObject({ outcome: 'completed', estimated: true, rounds: 1, promptTokens: lost + 1000, completionTokens: 20 })
    expect(spent).toEqual([costOf(MODEL, lost + 1000, 20)])
  })

  it('does not charge a request OpenAI refused, even when the lender leaves at that moment', async () => {
    let leave!: () => void
    script = [{ refuse: 400, before: () => leave() }]
    const { entry } = await turn((go) => (leave = go))
    expect(entry).toMatchObject({ outcome: 'abandoned', estimated: false, rounds: 1, promptTokens: 0, completionTokens: 0, costUsd: 0 })
    expect(spent).toEqual([])
  })

  it('does not charge a request OpenAI refused, but still logs the turn and tells the lender', async () => {
    script = [{ refuse: 400 }]
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { entry, events } = await turn()
    expect(entry).toMatchObject({ outcome: 'failed', estimated: false, rounds: 1, promptTokens: 0, completionTokens: 0, costUsd: 0 })
    expect(spent).toEqual([])
    expect(events.map((e) => e.type)).toEqual(['error', 'done'])
  })
})

describe('the estimates', () => {
  it('counts the prompt KivaLens writes at four bytes a token, and what the lender controls at one', () => {
    const prompt = { model: 'gpt-4o-mini', instructions: 'x'.repeat(398) }
    const input = [{ role: 'user', content: 'y'.repeat(100) }, { type: 'function_call_output', call_id: 'c', output: '{"loans":[]}' }]
    expect(estimateInputTokens({ ...prompt, input })).toBe(Math.ceil(JSON.stringify(prompt).length / 4) + JSON.stringify(input).length)
    expect(estimateInputTokens(prompt)).toBe(Math.ceil(JSON.stringify(prompt).length / 4))
    // What the instructions copied from the lender moves from four bytes a token to one.
    expect(estimateInputTokens(prompt, 100)).toBe(Math.ceil((JSON.stringify(prompt).length - 100) / 4) + 100)
    expect(estimateInputTokens(prompt, 10 ** 9)).toBe(JSON.stringify(prompt).length) // never more than the whole prompt
  })

  it('cannot be undercounted by text written to tokenize densely', () => {
    // Digits and commas never merge in gpt-4o-mini's tokenizer: '1,' is two tokens, one per byte.
    const dense = '1,'.repeat(4000)
    const input = Array.from({ length: 10 }, () => ({ role: 'user', content: dense }))
    expect(estimateInputTokens({ instructions: 'Answer.', input })).toBeGreaterThanOrEqual(10 * dense.length)
    // The same text copied into the instructions, as saved-search names are.
    const savedSearches = [dense, dense]
    const state = createState()
    const instructions = buildSystemPrompt(state, null, null, { savedSearches, locale: 'en' })
    const request = { instructions, input: [] }
    expect(estimateInputTokens(request, lenderPromptShare(state, instructions, 'en'))).toBeGreaterThanOrEqual(2 * dense.length)
  })

  it('counts a conversation in Japanese at no less than it costs', () => {
    // OpenAI's tokenizer guide counts this phrase at 8 tokens in cl100k, more than
    // gpt-4o-mini's own encoding needs; with its newline, 9 tokens a line.
    const line = 'お誕生日おめでとう'
    const input = Array.from({ length: 10 }, () => ({ role: 'user', content: `${line}\n`.repeat(800) }))
    expect(estimateInputTokens({ input })).toBeGreaterThanOrEqual(10 * 800 * 9)
  })

  it('counts nothing for what cannot be serialized', () => {
    const circular: Record<string, unknown> = {}
    circular.self = circular
    expect(estimateInputTokens(circular)).toBe(0)
    expect(estimateInputTokens({ input: circular })).toBe(Math.ceil(2 / 4)) // "{}" for the rest
  })

  it('counts a reply at one token per delta, or per four bytes when that is more', () => {
    expect(estimateOutputTokens(25, 59)).toBe(25) // the probe: 25 deltas, 59 bytes
    expect(estimateOutputTokens(1, 58)).toBe(15)
    expect(estimateOutputTokens(0, 0)).toBe(0)
  })
})
