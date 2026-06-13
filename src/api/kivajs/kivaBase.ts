import pLimit from 'p-limit'

export const limiter = pLimit(8)
export const limiterTwo = pLimit(8)

export const apiOptions = { maxConcurrent: 8, appId: 'org.kiva.kivalens' }

export function setAPIOptions(options: Partial<typeof apiOptions>): void {
  Object.assign(apiOptions, options)
  if (options.maxConcurrent) {
    limiter.concurrency = options.maxConcurrent
  }
}

export async function getUrl(
  url: string,
  options?: { parseJSON?: boolean; includeRequestedWith?: boolean }
): Promise<any> {
  const opts = { parseJSON: true, ...options }
  const headers: Record<string, string> = { Accept: 'application/json,*/*' }
  if (opts.includeRequestedWith) headers['X-Requested-With'] = 'XMLHttpRequest'
  const response = await fetch(url, { headers })
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`)
  return opts.parseJSON ? response.json() : response.text()
}

export async function postUrl(
  url: string,
  query: string,
  options?: { parseJSON?: boolean; includeRequestedWith?: boolean }
): Promise<any> {
  const opts = { parseJSON: true, ...options }
  const headers: Record<string, string> = {
    'Content-Type': 'application/json;charset=UTF-8',
    Accept: 'application/json,*/*',
  }
  if (opts.includeRequestedWith) headers['X-Requested-With'] = 'XMLHttpRequest'
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query }),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`)
  return opts.parseJSON ? response.json() : response.text()
}

export function serialize(obj: Record<string, any>, prefix?: string): string {
  const parts: string[] = []
  for (const [p, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue
    const k = prefix ? `${prefix}[${p}]` : p
    if (typeof v === 'object' && !Array.isArray(v)) {
      parts.push(serialize(v, k))
    } else {
      parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    }
  }
  return parts.join('&')
}
