/**
 * Hands a report to the collector and forgets it. Text, not JSON, so the
 * cross-origin POST needs no preflight. A keepalive fetch survives the page
 * closing and sends no cookies (credentials: omit). It does not use sendBeacon
 * first, although that is the usual choice, because a beacon always carries the
 * cookies the browser holds for the collector's domain; sendBeacon is only the
 * fallback for a browser that cannot keep a fetch alive. It never throws: a
 * report is worth less than the page it describes.
 */
export const MAX_BEACON_BYTES = 60_000

const keepaliveSupported = (): boolean => {
  try {
    return typeof Request === 'function' && 'keepalive' in Request.prototype
  } catch {
    return false
  }
}

export function send(url: string, payload: unknown): boolean {
  try {
    const body = JSON.stringify(payload)
    if (body.length > MAX_BEACON_BYTES) return false
    if (!keepaliveSupported() && typeof navigator.sendBeacon === 'function') {
      return navigator.sendBeacon(url, new Blob([body], { type: 'text/plain' }))
    }
    void fetch(url, {
      method: 'POST',
      body,
      keepalive: true,
      credentials: 'omit',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
    }).catch(() => {})
    return true
  } catch {
    return false
  }
}
