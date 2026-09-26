import { beforeEach, describe, expect, it, vi } from 'vitest'
import { checkStatus, submitFeedback, updateContact, type SupportDeps } from './service'
import { MemoryStore, openSupportStore, resetSupportStoreForTests, type StoredReport } from './storage'
import type { ClientFacts } from './protocol'

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

type Handler = (path: string, body: { messageType: string; payload: Record<string, unknown> }, headers: Record<string, string>) => Response

function fakeService(handler: Handler) {
  const calls: { path: string; body: { messageType: string; payload: Record<string, unknown> }; headers: Record<string, string> }[] = []
  const fetch = vi.fn(async (url: string, init: RequestInit) => {
    const path = new URL(url).pathname
    const body = JSON.parse(init.body as string)
    const headers = init.headers as Record<string, string>
    calls.push({ path, body, headers })
    return handler(path, body, headers)
  })
  return { fetch: fetch as unknown as typeof globalThis.fetch, calls }
}

const json = (status: number, value: object) => new Response(JSON.stringify({ serverTime: '2026-09-25T10:00:00.000Z', ...value }), { status })
const RECEIPT = 'r'.repeat(40)

function standard(extra: Partial<Record<string, (body: { payload: Record<string, unknown> }) => Response>> = {}): Handler {
  let keys = 0
  return (path, body) => {
    const custom = extra[path]
    if (custom) return custom(body)
    if (path === '/v1/installations/enroll') return json(201, { payload: { keyId: `key-${++keys}` } })
    if (path === '/v1/feedback') return json(202, { payload: { reportCode: 'LSS-AAAAA-BBBBB', receipt: RECEIPT, status: 'received', contactVerificationPending: Boolean(body.payload.contact) } })
    return json(404, { error: { code: 'routeNotFound', message: '', retryable: false } })
  }
}

function deps(fetch: typeof globalThis.fetch, store = new MemoryStore(true)): SupportDeps {
  return { store, transport: { base: 'https://api.example', fetch, clockOffset: 0 }, facts: () => facts }
}

const report = (over: Partial<StoredReport> = {}): StoredReport => ({
  appId: 'kivalens-web',
  reportCode: 'LSS-AAAAA-BBBBB',
  receipt: RECEIPT,
  kind: 'bug',
  message: 'The legend overlaps.',
  createdAt: '2026-09-25T10:00:00.000Z',
  outcome: 'received',
  ...over,
})

describe('the installation', () => {
  it('enrolls once, keeps its key, and signs every later request with it', async () => {
    const service = fakeService(standard())
    const d = deps(service.fetch)
    await submitFeedback(d, { kind: 'bug', message: 'First report' })
    await submitFeedback(d, { kind: 'suggestion', message: 'Second report' })
    expect(service.calls.map((c) => c.path)).toEqual(['/v1/installations/enroll', '/v1/feedback', '/v1/feedback'])
    expect(service.calls[1].headers['x-lss-key-id']).toBe('key-1')
    expect(service.calls[2].headers['x-lss-key-id']).toBe('key-1')
  })

  it('never hands the service a private key: the enrolled key is public and verify-only', async () => {
    const service = fakeService(standard())
    await submitFeedback(deps(service.fetch), { kind: 'bug', message: 'A report' })
    const jwk = service.calls[0].body.payload.publicKeyJwk as Record<string, unknown>
    expect(jwk).toMatchObject({ kty: 'EC', crv: 'P-256', key_ops: ['verify'] })
    expect(jwk).not.toHaveProperty('d')
  })

  it('replaces a key the service no longer knows, once, and repeats the request', async () => {
    let refused = false
    const service = fakeService(
      standard({
        '/v1/feedback': () => {
          if (!refused) {
            refused = true
            return json(401, { error: { code: 'unknownOrRevokedInstallation', message: '', retryable: false } })
          }
          return json(202, { payload: { reportCode: 'LSS-AAAAA-BBBBB', receipt: RECEIPT, status: 'received', contactVerificationPending: false } })
        },
      }),
    )
    const result = await submitFeedback(deps(service.fetch), { kind: 'bug', message: 'A report' })
    expect(result.ok).toBe(true)
    expect(service.calls.map((c) => c.path)).toEqual(['/v1/installations/enroll', '/v1/feedback', '/v1/installations/enroll', '/v1/feedback'])
    expect(service.calls[3].headers['x-lss-key-id']).toBe('key-2')
  })
})

describe('a key refused by several requests at once', () => {
  it('is replaced once, and every request uses the one new key', async () => {
    const known = new Set<string>()
    let keys = 0
    const service = fakeService((path, body, headers) => {
      if (path === '/v1/installations/enroll') {
        const keyId = `key-${++keys}`
        known.add(keyId)
        return json(201, { payload: { keyId } })
      }
      if (!known.has(headers['x-lss-key-id'])) return json(401, { error: { code: 'unknownOrRevokedInstallation', message: '', retryable: false } })
      return json(200, { payload: { status: 'queued', revision: 1, updatedAt: '2026-09-25T10:00:00.000Z', messages: [] } })
    })
    const d = deps(service.fetch)
    // The browser has a key the service has since forgotten.
    const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify'])) as CryptoKeyPair
    await d.store.setInstallation({ keyId: 'forgotten', keyPair: pair })
    const results = await Promise.all([1, 2, 3, 4].map((n) => checkStatus(d, report({ reportCode: `LSS-AAAAA-BBBB${n}` }))))
    expect(results.every((r) => r.ok)).toBe(true)
    expect(service.calls.filter((c) => c.path === '/v1/installations/enroll')).toHaveLength(1)
    expect((await d.store.getInstallation())?.keyId).toBe('key-1')
  })
})

describe('sending a report', () => {
  it('keeps the receipt and exactly what the lender wrote, as this app’s report', async () => {
    const store = new MemoryStore(true)
    await submitFeedback(deps(fakeService(standard()).fetch, store), { kind: 'bug', message: 'Line one\nLine two' })
    const [kept] = await store.listReports('kivalens-web')
    expect(kept).toMatchObject({ reportCode: 'LSS-AAAAA-BBBBB', receipt: RECEIPT, message: 'Line one\nLine two', kind: 'bug', outcome: 'received' })
    expect(await store.listReports('another-app')).toEqual([])
  })

  it('sends the reply address only with consent, and calls it pending only when the service does', async () => {
    const service = fakeService(standard())
    const store = new MemoryStore(true)
    await submitFeedback(deps(service.fetch, store), { kind: 'bug', message: 'With email', email: 'a@example.com' })
    expect(service.calls[1].body.payload.contact).toEqual({ email: 'a@example.com', communicationConsent: true, automatedProcessingDisclosureAccepted: true })
    expect((await store.listReports('kivalens-web'))[0].contact).toEqual({ state: 'pending', pendingEmail: 'a@example.com' })
  })

  it('declares the disclosure reviewed, which the lender was shown', async () => {
    const service = fakeService(standard())
    await submitFeedback(deps(service.fetch), { kind: 'suggestion', message: 'Idea' })
    expect(service.calls[1].body.payload.disclosureReviewed).toBe(true)
  })

  it('returns a refusal as a refusal, keeping nothing', async () => {
    const store = new MemoryStore(true)
    const service = fakeService(standard({ '/v1/feedback': () => json(429, { error: { code: 'dailyQuotaExceeded', message: '', retryable: true } }) }))
    const result = await submitFeedback(deps(service.fetch, store), { kind: 'bug', message: 'Too many' })
    expect(result).toMatchObject({ ok: false, kind: 'service', error: { code: 'dailyQuotaExceeded' } })
    expect(await store.listReports('kivalens-web')).toEqual([])
  })
})

describe('checking status', () => {
  const statusService = (payload: object) =>
    fakeService(standard({ '/v1/reports/status': () => json(200, { payload: { status: 'queued', revision: 3, updatedAt: '2026-09-25T10:00:00.000Z', messages: [], ...payload } }) }))

  it('shows the service’s typed outcome', async () => {
    const service = statusService({ outcome: { code: 'beingLookedAt' }, contact: { state: 'none' } })
    const result = await checkStatus(deps(service.fetch), report())
    expect(result.ok && result.payload).toMatchObject({ outcome: 'beingLookedAt', revision: 3, contact: { state: 'none' } })
    expect(service.calls.at(-1)!.body.payload).toEqual({ schemaVersion: '1.0', reportCode: 'LSS-AAAAA-BBBBB', receipt: RECEIPT })
  })

  it('says unavailable when the service gives no outcome, or an unknown one — never a guess', async () => {
    for (const payload of [{}, { outcome: { code: 'somethingNew' } }]) {
      const result = await checkStatus(deps(statusService(payload).fetch), report())
      expect(result.ok && result.payload.outcome).toBe('unavailable')
    }
  })

  it('never claims a fixed version it was not given', async () => {
    const without = await checkStatus(deps(statusService({ outcome: { code: 'fixedIn' } }).fetch), report())
    expect(without.ok && without.payload.outcome).toBe('unavailable')
    const withRelease = await checkStatus(deps(statusService({ outcome: { code: 'fixedIn', fixedRelease: { version: '2026.10.1' } } }).fetch), report())
    expect(withRelease.ok && withRelease.payload).toMatchObject({ outcome: 'fixedIn', fixedVersion: '2026.10.1' })
  })

  it('keeps the lender’s original words over the service’s copy', async () => {
    const result = await checkStatus(deps(statusService({ submittedMessage: 'server copy' }).fetch), report({ message: 'my words' }))
    expect(result.ok && result.payload.message).toBe('my words')
    const recovered = await checkStatus(deps(statusService({ submittedMessage: 'server copy' }).fetch), report({ message: '' }))
    expect(recovered.ok && recovered.payload.message).toBe('server copy')
  })
})

describe('the reply email on one report', () => {
  it('names the report, its receipt and the revision it was shown', async () => {
    const service = fakeService(standard({ '/v1/reports/contact': () => json(200, { payload: { revision: 5, contact: { state: 'pending', pendingEmail: 'b@example.com' } } }) }))
    const result = await updateContact(deps(service.fetch), report({ revision: 4 }), 'set', 'b@example.com')
    expect(result.ok && result.payload).toMatchObject({ revision: 5, contact: { state: 'pending' } })
    expect(service.calls.at(-1)!.body.payload).toMatchObject({ reportCode: 'LSS-AAAAA-BBBBB', receipt: RECEIPT, expectedRevision: 4, action: 'set', contact: { email: 'b@example.com', communicationConsent: true } })
  })

  it('sends no address to remove or undo', async () => {
    const service = fakeService(standard({ '/v1/reports/contact': () => json(200, { payload: { revision: 6, contact: { state: 'none' } } }) }))
    await updateContact(deps(service.fetch), report({ revision: 5 }), 'remove')
    expect(service.calls.at(-1)!.body.payload).not.toHaveProperty('contact')
  })
})

describe('a browser that keeps no data for the site', () => {
  beforeEach(() => resetSupportStoreForTests())

  it('still works for the page’s life, and says it is not keeping anything', async () => {
    const saved = globalThis.indexedDB
    // @ts-expect-error — a browser with storage blocked
    delete globalThis.indexedDB
    try {
      const store = await openSupportStore()
      expect(store.persistent).toBe(false)
      await store.putReport(report())
      expect(await store.listReports('kivalens-web')).toHaveLength(1)
    } finally {
      if (saved) globalThis.indexedDB = saved
      resetSupportStoreForTests()
    }
  })
})
