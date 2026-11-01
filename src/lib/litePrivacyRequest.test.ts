import { describe, expect, it } from 'vitest'
// @ts-expect-error standalone server module, exercised without the app shell
import { litePrivacyResponseForRequest } from '../../server/litePrivacy.mjs'

describe('standalone app privacy HTTP response', () => {
  for (const language of ['en', 'de', 'fr', 'es', 'pt-BR', 'ja', 'zh-Hans']) {
    it(`returns a bodyless HEAD response with the same headers for ${language}`, async () => {
      const get = litePrivacyResponseForRequest('GET', `/${language}/lite-privacy?source=about`)
      const head = litePrivacyResponseForRequest('HEAD', `/${language}/lite-privacy?source=about`)
      expect(get?.status).toBe(200)
      expect(head?.status).toBe(get?.status)
      expect(head?.headers.get('content-type')).toBe(get?.headers.get('content-type'))
      expect(head?.headers.get('x-robots-tag')).toBe('noindex')
      expect(head?.body).toBeNull()
    })
  }

  it('does not serve unsupported methods or unrelated paths', () => {
    expect(litePrivacyResponseForRequest('POST', '/en/lite-privacy')).toBeNull()
    expect(litePrivacyResponseForRequest('GET', '/search')).toBeNull()
    expect(litePrivacyResponseForRequest('HEAD', '/xx/lite-privacy')).toBeNull()
  })
})
