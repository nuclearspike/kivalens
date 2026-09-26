/**
 * nodeAdapter.mjs — the Node server's edge: an incoming request becomes a Fetch
 * API Request for the handlers (http.mjs), and their Response is written back.
 * Used by prod.mjs and the Vite dev plugin; a Cloudflare Worker needs none.
 */
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

/**
 * The request as a Fetch Request. Its signal aborts when the browser goes away
 * before the response has finished (a closed tab mid-chat), never when the
 * request body has merely been read.
 */
export function toRequest(req, res) {
  const controller = new AbortController()
  res.on('close', () => {
    if (!res.writableEnded) controller.abort()
  })
  const headers = new Headers()
  for (const [name, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) for (const v of value) headers.append(name, v)
    else if (value != null) headers.set(name, String(value))
  }
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD'
  return new Request(`http://${req.headers.host || 'localhost'}${req.url || '/'}`, {
    method: req.method,
    headers,
    body: hasBody ? Readable.toWeb(req) : undefined,
    duplex: hasBody ? 'half' : undefined,
    signal: controller.signal,
  })
}

/**
 * Writes a Response to a Node response, streaming its body with backpressure.
 * Settles when the body has been sent or the browser has gone away, which also
 * cancels the body (a chat turn then stops upstream). It does not wait for
 * 'drain' by hand: a browser that leaves while a write is backed up never
 * drains, and the send would wait forever.
 */
export async function sendResponse(res, response) {
  res.statusCode = response.status
  for (const [name, value] of response.headers) res.setHeader(name, value)
  if (!response.body) {
    res.end()
    return
  }
  // An event stream must reach the browser as it is written, not when it ends.
  if ((response.headers.get('content-type') || '').startsWith('text/event-stream')) res.flushHeaders?.()
  try {
    await pipeline(Readable.fromWeb(response.body), res)
  } catch {
    // The browser went away, or the body failed mid-way; pipeline has closed both.
  }
}
