import { describe, expect, it, vi } from 'vitest'
import vector from './__fixtures__/p256-signing-v1.json'
import { base64Url, envelope, send, sha256Base64Url, sign, signingInput, uuidV7, type ClientFacts, type Transport } from './protocol'

/**
 * The browser signs exactly as the native SDKs do. The vector is the service's
 * own (app-services test/vectors/p256-signing-v1.json), shared by the Swift and
 * .NET clients: the same body must digest, frame and verify identically.
 */

const facts: ClientFacts = {
  schemaVersion: '1.0',
  sdk: { family: 'web', version: '1.1.21' },
  appId: 'kivalens-web',
  appVersion: '2026.9.25',
  appBuild: 'abc1234',
  distribution: 'web',
  platform: 'web',
  osVersion: 'Chrome 140 · macOS',
  architecture: 'unknown',
  locale: 'en',
  capabilities: {},
}

describe('signing, against the service’s shared vector', () => {
  it('digests the exact body the way the service does', async () => {
    expect(await sha256Base64Url(vector.exactBodyUtf8)).toBe(vector.bodySha256Base64Url)
  })

  it('frames the signed fields in the service’s order', () => {
    expect(signingInput(vector.method, vector.path, vector.sentAt, vector.messageId, vector.bodySha256Base64Url)).toBe(
      vector.canonicalSigningInput,
    )
  })

  it('signs so the registered public key verifies it, and verifies the service’s own signature', async () => {
    const privateKey = await crypto.subtle.importKey('jwk', vector.privateJwkForTestsOnly, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
    const publicKey = await crypto.subtle.importKey('jwk', vector.publicJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'])
    const signature = await sign(privateKey, vector.canonicalSigningInput)
    const raw = (b64: string) => Uint8Array.from(atob(b64.replace(/-/g, '+').replace(/_/g, '/') + '=='.slice((b64.length + 2) % 4 || 2)), (c) => c.charCodeAt(0))
    const data = new TextEncoder().encode(vector.canonicalSigningInput)
    expect(raw(signature)).toHaveLength(64) // raw r‖s, not DER
    expect(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, publicKey, raw(signature), data)).toBe(true)
    expect(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, publicKey, raw(vector.signatureBase64Url), data)).toBe(true)
  })

  it('writes base64url without padding', () => {
    expect(base64Url(new Uint8Array([251, 255, 191]))).toBe('-_-_')
  })
})

describe('message ids', () => {
  it('are UUIDv7, ordered by time', () => {
    const early = uuidV7(Date.UTC(2026, 0, 1))
    const late = uuidV7(Date.UTC(2026, 8, 25))
    for (const id of [early, late]) expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(early < late).toBe(true)
  })
})

describe('sending', () => {
  const ok = (payload: object, serverTime = '2026-09-25T00:00:00.000Z') =>
    new Response(JSON.stringify({ payload, serverTime }), { status: 202, headers: { 'content-type': 'application/json' } })
  const stale = (serverTime: string) =>
    new Response(JSON.stringify({ serverTime, error: { code: 'staleRequest', message: '', retryable: true } }), { status: 401 })

  async function signer() {
    const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify'])) as CryptoKeyPair
    return { keyId: 'key-1', privateKey: pair.privateKey }
  }

  it('signs the exact bytes it sends, and says which key signed them', async () => {
    const fetch = vi.fn(async () => ok({ reportCode: 'x' }))
    const transport: Transport = { base: 'https://api.example', fetch, clockOffset: 0 }
    const result = await send(transport, '/v1/feedback', (now) => envelope('feedback.submit', facts, { kind: 'bug' }, now), await signer())
    expect(result.ok).toBe(true)
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.example/v1/feedback')
    const headers = init.headers as Record<string, string>
    expect(headers['x-lss-key-id']).toBe('key-1')
    expect(headers['x-lss-body-sha256']).toBe(await sha256Base64Url(init.body as string))
    const body = JSON.parse(init.body as string)
    expect(headers['x-lss-message-id']).toBe(body.messageId)
    expect(headers['x-lss-sent-at']).toBe(body.sentAt)
    expect(init.credentials).toBe('omit')
  })

  it('corrects a wrong browser clock once from the service’s time, and re-signs with a fresh message', async () => {
    const serverTime = new Date(Date.now() + 20 * 60_000).toISOString()
    const fetch = vi.fn().mockResolvedValueOnce(stale(serverTime)).mockResolvedValueOnce(ok({ done: true }))
    const transport: Transport = { base: '', fetch, clockOffset: 0 }
    const result = await send(transport, '/v1/feedback', (now) => envelope('feedback.submit', facts, {}, now), await signer())
    expect(result.ok).toBe(true)
    expect(fetch).toHaveBeenCalledTimes(2)
    const [first, second] = fetch.mock.calls.map((c) => JSON.parse((c[1] as RequestInit).body as string))
    expect(second.messageId).not.toBe(first.messageId)
    expect(Math.abs(Date.parse(second.sentAt) - Date.parse(serverTime))).toBeLessThan(5_000)
  })

  it('does not loop on a clock it cannot correct', async () => {
    const fetch = vi.fn(async () => stale(new Date(Date.now() + 20 * 60_000).toISOString()))
    const result = await send({ base: '', fetch, clockOffset: 0 }, '/v1/feedback', (now) => envelope('x', facts, {}, now), await signer())
    expect(result.ok).toBe(false)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('tells no answer from a refusal', async () => {
    const down = await send({ base: '', fetch: vi.fn().mockRejectedValue(new TypeError('Failed to fetch')), clockOffset: 0 }, '/v1/x', (now) => envelope('x', facts, {}, now))
    expect(down).toEqual({ ok: false, kind: 'transport' })
    const refused = await send(
      { base: '', fetch: vi.fn(async () => new Response(JSON.stringify({ error: { code: 'dailyQuotaExceeded', message: 'm', retryable: true } }), { status: 429 })), clockOffset: 0 },
      '/v1/x',
      (now) => envelope('x', facts, {}, now),
    )
    expect(refused).toMatchObject({ ok: false, kind: 'service', status: 429, error: { code: 'dailyQuotaExceeded' } })
  })
})
