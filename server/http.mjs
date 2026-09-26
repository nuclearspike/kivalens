/**
 * http.mjs — the request/response vocabulary every handler speaks: the Fetch
 * API's Request and Response, which both hosts have natively. Cloudflare Workers
 * hand a Request in and take a Response out; the Node server converts at its
 * edge (nodeAdapter.mjs). A handler returns a Response when the request is its
 * own and null when it is not, so the host tries the next handler and finally
 * serves the app.
 */

/** The path and query of a request, exactly as sent (not decoded). */
export function pathOf(request) {
  const u = new URL(request.url)
  return u.pathname + u.search
}

export function json(value, { status = 200, headers = {} } = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  })
}

export function text(body, { status = 200, headers = {} } = {}) {
  return new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', ...headers } })
}

/**
 * Bytes that are already gzipped, sent as they are. `encodeBody: 'manual'` tells
 * Cloudflare the body is already encoded; Node's Response ignores the option.
 */
export function gzipped(bytes, { cacheControl = 'public, max-age=600' } = {}) {
  return new Response(bytes, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Encoding': 'gzip',
      'Content-Length': String(bytes.length),
      'Cache-Control': cacheControl,
    },
    encodeBody: 'manual',
  })
}

export function redirect(location, status = 302) {
  return new Response(null, { status, headers: { Location: location } })
}

/**
 * A request body as text, refusing more than `maxBytes` without reading it all:
 * { text } or { tooLarge: true }.
 */
export async function readBody(request, maxBytes) {
  const declared = Number(request.headers.get('content-length') || 0)
  if (declared > maxBytes) return { tooLarge: true }
  if (!request.body) return { text: '' }
  const reader = request.body.getReader()
  const decoder = new TextDecoder()
  let size = 0
  let out = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > maxBytes) {
      try {
        await reader.cancel()
      } catch {
        // already closed
      }
      return { tooLarge: true }
    }
    out += decoder.decode(value, { stream: true })
  }
  return { text: out + decoder.decode() }
}

/**
 * A server-sent-events response and the functions that feed it. `send` never
 * throws once the reader has gone; `close` ends the stream.
 */
export function eventStream() {
  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()
  const encoder = new TextEncoder()
  let open = true
  const send = (event) => {
    if (!open) return
    writer.write(encoder.encode(`data: ${JSON.stringify(event)}\n\n`)).catch(() => {
      open = false
    })
  }
  const close = () => {
    if (!open) return
    open = false
    writer.close().catch(() => {})
  }
  const response = new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
  return { response, send, close, isOpen: () => open }
}
