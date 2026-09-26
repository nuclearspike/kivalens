/**
 * The HumansAreUseful App Services wire protocol, as a browser speaks it.
 *
 * Every request is an envelope naming this app and its facts, and every request
 * but enrollment is signed by the installation's P-256 key over the method, the
 * path, the send time, the message id and the exact body's SHA-256
 * (app-services src/public/signature.ts). The native SDKs do the same; the
 * signing test vectors they share are checked here in protocol.test.ts.
 */

export const SIGNATURE_PREFIX = 'LSS1'
export const ENVELOPE_VERSION = '1.0'
export const MESSAGE_VERSION = '1.0'

export interface ClientFacts {
  schemaVersion: '1.0'
  sdk: { family: 'web'; version: string }
  appId: string
  appVersion: string
  appBuild: string
  distribution: 'web' | 'development'
  platform: 'web'
  osVersion: string
  architecture: 'unknown'
  locale: string
  capabilities: Record<string, boolean>
}

export interface Envelope<P> {
  envelopeVersion: '1.0'
  messageType: string
  messageVersion: '1.0'
  messageId: string
  sentAt: string
  client: ClientFacts
  payload: P & { schemaVersion: '1.0' }
}

export interface ServiceError {
  code: string
  message: string
  retryable: boolean
}

/** What a request came to. `transport` means no answer arrived at all. */
export type Outcome<T> =
  | { ok: true; payload: T; serverTime: string }
  | { ok: false; kind: 'service'; status: number; error: ServiceError; serverTime?: string }
  | { ok: false; kind: 'transport' }

const encoder = new TextEncoder()

export function base64Url(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let binary = ''
  for (const byte of view) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function sha256Base64Url(text: string): Promise<string> {
  return base64Url(await crypto.subtle.digest('SHA-256', encoder.encode(text)))
}

export function signingInput(method: string, path: string, sentAt: string, messageId: string, digest: string): string {
  return [SIGNATURE_PREFIX, method.toUpperCase(), path, sentAt, messageId, digest].join('\n')
}

/** WebCrypto's ECDSA signature is already the raw 64-byte r‖s the service expects. */
export async function sign(privateKey: CryptoKey, input: string): Promise<string> {
  return base64Url(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, encoder.encode(input)))
}

/** A UUIDv7: time-ordered, as the service requires of every message id. */
export function uuidV7(now = Date.now()): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  let time = now
  for (let i = 5; i >= 0; i--) {
    bytes[i] = time % 256
    time = Math.floor(time / 256)
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x70
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function envelope<P extends object>(
  messageType: string,
  client: ClientFacts,
  payload: P,
  now: number,
): Envelope<P> {
  return {
    envelopeVersion: ENVELOPE_VERSION,
    messageType,
    messageVersion: MESSAGE_VERSION,
    messageId: uuidV7(now),
    sentAt: new Date(now).toISOString(),
    client,
    payload: { schemaVersion: MESSAGE_VERSION, ...payload },
  }
}

export interface Signer {
  keyId: string
  privateKey: CryptoKey
}

export interface Transport {
  base: string
  fetch: typeof fetch
  /** Milliseconds added to the local clock; learned from the service on `staleRequest`. */
  clockOffset: number
}

async function read<T>(response: Response): Promise<Outcome<T>> {
  let body: { payload?: T; error?: ServiceError; serverTime?: string } | null
  try {
    body = await response.json()
  } catch {
    body = null
  }
  if (response.ok && body?.payload) return { ok: true, payload: body.payload, serverTime: body.serverTime ?? '' }
  return {
    ok: false,
    kind: 'service',
    status: response.status,
    error: body?.error ?? { code: 'unexpectedResponse', message: '', retryable: response.status >= 500 },
    serverTime: body?.serverTime,
  }
}

/**
 * Sends one envelope, signed when a signer is given. A browser's clock can be
 * minutes off, and the service refuses a request sent more than five minutes
 * from its own time: on `staleRequest` the service's time is learned once and
 * the request is rebuilt, re-signed and sent again, with a fresh message id.
 */
export async function send<T>(
  transport: Transport,
  path: string,
  build: (now: number) => Envelope<object>,
  signer?: Signer,
): Promise<Outcome<T>> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const body = build(Date.now() + transport.clockOffset)
    const text = JSON.stringify(body)
    const headers: Record<string, string> = { 'content-type': 'application/json' }
    if (signer) {
      const digest = await sha256Base64Url(text)
      headers['x-lss-key-id'] = signer.keyId
      headers['x-lss-sent-at'] = body.sentAt
      headers['x-lss-message-id'] = body.messageId
      headers['x-lss-body-sha256'] = digest
      headers['x-lss-signature'] = await sign(signer.privateKey, signingInput('POST', path, body.sentAt, body.messageId, digest))
    }
    let response: Response
    try {
      response = await transport.fetch(`${transport.base}${path}`, { method: 'POST', headers, body: text, mode: 'cors', credentials: 'omit' })
    } catch {
      return { ok: false, kind: 'transport' }
    }
    const outcome = await read<T>(response)
    if (!outcome.ok && outcome.kind === 'service' && outcome.error.code === 'staleRequest' && attempt === 0) {
      const serverNow = Date.parse(outcome.serverTime ?? response.headers.get('date') ?? '')
      if (!Number.isFinite(serverNow)) return outcome
      transport.clockOffset = serverNow - Date.now()
      continue
    }
    return outcome
  }
  return { ok: false, kind: 'transport' }
}
