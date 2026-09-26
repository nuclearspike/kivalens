import { afterEach, describe, expect, it, vi } from 'vitest'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { sendResponse, toRequest } from '../../server/nodeAdapter.mjs'

/**
 * The Node server's edge (server/nodeAdapter.mjs), over real sockets: the
 * handlers speak Fetch Request/Response, and this is where a Node request
 * becomes one and their Response is written back.
 */

let server: http.Server | null = null
afterEach(async () => {
  server?.closeAllConnections()
  await new Promise((resolve) => server?.close(resolve) ?? resolve(null))
  server = null
})

async function serve(handler: (req: http.IncomingMessage, res: http.ServerResponse) => void) {
  server = http.createServer(handler)
  await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve))
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`
}

describe('toRequest', () => {
  it('carries the method, address, headers and body', async () => {
    let seen: { method: string; url: string; type: string | null; multi: string | null; body: string } | null = null
    const base = await serve(async (req, res) => {
      const request = toRequest(req, res)
      seen = {
        method: request.method,
        url: request.url,
        type: request.headers.get('content-type'),
        multi: request.headers.get('x-multi'),
        body: await request.text(),
      }
      res.end('ok')
    })
    await fetch(`${base}/api/chat?x=1`, {
      method: 'POST',
      headers: [['Content-Type', 'application/json'], ['X-Multi', 'a'], ['X-Multi', 'b']],
      body: '{"hello":"world"}',
    })
    expect(seen).toEqual({
      method: 'POST',
      url: expect.stringMatching(/^http:\/\/127\.0\.0\.1:\d+\/api\/chat\?x=1$/),
      type: 'application/json',
      multi: 'a, b',
      body: '{"hello":"world"}',
    })
  })

  it('gives a GET no body', async () => {
    let body: ReadableStream | null | undefined
    const base = await serve((req, res) => {
      body = toRequest(req, res).body
      res.end()
    })
    await fetch(`${base}/api/start`)
    expect(body).toBeNull()
  })

  it('aborts its signal when the browser leaves before the response ends, and not after', async () => {
    const signals: AbortSignal[] = []
    const base = await serve((req, res) => {
      const request = toRequest(req, res)
      signals.push(request.signal)
      if (req.url === '/done') res.end('finished')
      else res.write('partial') // never ends: the browser leaves first
    })
    expect(await (await fetch(`${base}/done`)).text()).toBe('finished')

    const controller = new AbortController()
    const res = await fetch(`${base}/hang`, { signal: controller.signal })
    await res.body!.getReader().read()
    controller.abort()

    await vi.waitFor(() => expect(signals[1].aborted).toBe(true))
    expect(signals[0].aborted).toBe(false)
  })
})

describe('sendResponse', () => {
  it('writes the status, headers and body', async () => {
    const base = await serve((_req, res) => {
      void sendResponse(res, new Response('{"a":1}', { status: 201, headers: { 'Content-Type': 'application/json', 'X-Test': 'yes' } }))
    })
    const res = await fetch(base)
    expect(res.status).toBe(201)
    expect(res.headers.get('x-test')).toBe('yes')
    expect(await res.text()).toBe('{"a":1}')
  })

  it('answers a Response without a body', async () => {
    const base = await serve((_req, res) => {
      void sendResponse(res, new Response(null, { status: 304, headers: { ETag: 'W/"x"' } }))
    })
    const res = await fetch(base)
    expect(res.status).toBe(304)
    expect(res.headers.get('etag')).toBe('W/"x"')
  })

  it('delivers an event stream as it is written, not when it ends', async () => {
    let push!: (text: string) => void
    let end!: () => void
    const base = await serve((_req, res) => {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          push = (text) => controller.enqueue(new TextEncoder().encode(text))
          end = () => controller.close()
        },
      })
      void sendResponse(res, new Response(body, { headers: { 'Content-Type': 'text/event-stream' } }))
    })
    const res = await fetch(base)
    const reader = res.body!.getReader()
    push('data: {"type":"token"}\n\n')
    const first = await reader.read()
    expect(new TextDecoder().decode(first.value)).toBe('data: {"type":"token"}\n\n')
    end()
    expect((await reader.read()).done).toBe(true)
  })

  it('settles and cancels the body when the browser leaves while writes are backed up', async () => {
    // A browser that leaves mid-download never drains the socket. Waiting for
    // 'drain' would leave this send, and everything it holds, pending forever.
    const chunk = new Uint8Array(64 * 1024)
    let cancelled = false
    let settled = 'pending'
    const base = await serve((_req, res) => {
      const endless = new ReadableStream<Uint8Array>({
        pull(controller) {
          controller.enqueue(chunk)
        },
        cancel() {
          cancelled = true
        },
      })
      sendResponse(res, new Response(endless)).then(
        () => (settled = 'resolved'),
        () => (settled = 'rejected'),
      )
    })
    await new Promise<void>((resolve) => {
      const req = http.get(base, (res) => {
        res.once('data', () => {
          req.destroy()
          resolve()
        })
      })
    })
    await vi.waitFor(() => expect(settled).toBe('resolved'), { timeout: 3000 })
    expect(cancelled).toBe(true)
  })
})
