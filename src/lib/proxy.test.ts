import { afterEach, describe, expect, it, vi } from 'vitest'
import { handleProxy } from '../../server/klCore.mjs'

/**
 * The anonymizing GET proxy to two fixed hosts (/proxy/kiva/ajax/*,
 * /proxy/gdocs/spreadsheets/*): what goes upstream and what comes back.
 */

const originalFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = originalFetch
})

const get = (path: string, method = 'GET') => new Request(`http://localhost${path}`, { method })

describe('handleProxy', () => {
  it('declines a route that is not a proxy', async () => {
    expect(await handleProxy(get('/api/start'))).toBeNull()
  })

  it('allows only GET, and only the allowed paths', async () => {
    globalThis.fetch = vi.fn() as unknown as typeof fetch
    expect((await handleProxy(get('/proxy/kiva/ajax/x', 'POST')))!.status).toBe(405)
    expect((await handleProxy(get('/proxy/kiva/lend/123')))!.status).toBe(403)
    expect((await handleProxy(get('/proxy/gdocs/document/d/1')))!.status).toBe(403)
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('asks Kiva the way its firewall accepts and passes the answer back', async () => {
    const fetchMock = vi.fn(async () => new Response('{"ok":true}', { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } }))
    globalThis.fetch = fetchMock as unknown as typeof fetch
    const res = (await handleProxy(get('/proxy/kiva/ajax/getSuperGraphData?id=1')))!
    expect(fetchMock).toHaveBeenCalledWith('https://www.kiva.org/ajax/getSuperGraphData?id=1', {
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        Accept: 'application/json, text/javascript, */*; q=0.01',
        Referer: 'https://www.kiva.org/',
      },
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
    expect(res.headers.get('content-type')).toBe('application/json; charset=utf-8')
    expect(await res.text()).toBe('{"ok":true}')
  })

  it('passes an upstream error status through', async () => {
    globalThis.fetch = vi.fn(async () => new Response('gone', { status: 404, headers: { 'Content-Type': 'text/plain' } })) as unknown as typeof fetch
    const res = (await handleProxy(get('/proxy/gdocs/spreadsheets/d/1/export')))!
    expect(res.status).toBe(404)
    expect(await res.text()).toBe('gone')
  })

  it('passes a status that has no body through, instead of failing on it', async () => {
    for (const status of [204, 205, 304]) {
      globalThis.fetch = vi.fn(async () => new Response(null, { status })) as unknown as typeof fetch
      const res = (await handleProxy(get('/proxy/kiva/ajax/x')))!
      expect(res.status).toBe(status)
      expect(res.body).toBeNull()
    }
  })

  it('answers 502 when Kiva cannot be reached', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    globalThis.fetch = vi.fn(async () => { throw new Error('ECONNRESET') }) as unknown as typeof fetch
    const res = (await handleProxy(get('/proxy/kiva/ajax/x')))!
    expect(res.status).toBe(502)
    expect(await res.text()).toBe('Proxy error')
  })
})
