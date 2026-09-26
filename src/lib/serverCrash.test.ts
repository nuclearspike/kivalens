import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

/**
 * `GET /%FF` killed the production server process — verified against a built
 * server, which took every other lender's session with it until Heroku restarted
 * the dyno. `decodeURIComponent` throws on a half-written escape, which anyone
 * or any crawler can send, and the throw was in the request handler with nothing
 * around it. It predates this work; it is fixed here because it is live.
 */

const prod = readFileSync(path.join(process.cwd(), 'server/prod.mjs'), 'utf8')
const shell = readFileSync(path.join(process.cwd(), 'server/shell.mjs'), 'utf8')

describe('one bad request never takes the server down', () => {
  it('decodes a path where it can and keeps the raw one where it cannot', () => {
    expect(prod).toMatch(/function safeDecode\(pathname\) \{\s*try \{\s*return decodeURIComponent\(pathname\)\s*\} catch \{\s*return pathname\s*\}/)
    expect(prod).toContain('let pathname = safeDecode(rawPath)')
  })

  it('never calls decodeURIComponent unguarded in the request path', () => {
    const calls = [...prod.matchAll(/decodeURIComponent\(/g)]
    // The only one is inside safeDecode.
    expect(calls).toHaveLength(1)
    const around = prod.slice(prod.indexOf('function safeDecode'), prod.indexOf('function safeDecode') + 200)
    expect(around).toContain('decodeURIComponent(')
  })

  it('answers a request that throws instead of letting it end the process', () => {
    // handleRequest is async: a throw anywhere in it, synchronous or not, arrives
    // here as a rejection and is answered with a 500.
    expect(prod).toMatch(/http\.createServer\(\(req, res\) => \{\s*handleRequest\(req, res\)\.catch\(/)
    expect(prod).toMatch(/async function handleRequest\(req, res\)/)
    expect(prod).toContain("res.statusCode = 500")
    expect(prod).toContain('if (!res.headersSent)')
  })
})

describe('the shell can be revalidated rather than re-sent', () => {
  it('carries an ETag over the finished body, and answers a matching one with 304', () => {
    // no-cache means "ask me first", which needs something to ask WITH.
    expect(prod).toContain("res.setHeader('ETag', etag)")
    expect(prod).toContain("if (req.headers['if-none-match'] === etag)")
    expect(prod).toContain('res.statusCode = 304')
    // Over the BODY, so a partner renamed or a loan expired changes the tag
    // (shell.mjs, shared with the Cloudflare Worker).
    expect(shell).toMatch(/createHash\('sha1'\)\.update\(body\)/)
    expect(prod).toContain('renderShell(html,')
  })
})
