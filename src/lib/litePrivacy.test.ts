import { describe, it, expect } from 'vitest'
// @ts-expect-error standalone server module, exercised without the app shell
import { litePrivacyResponse } from '../../server/litePrivacy.mjs'

describe('Lite app privacy notice', () => {
  for (const language of ['en', 'de', 'fr', 'es', 'pt-BR', 'ja', 'zh-Hans']) {
    it(`serves the complete ${language} notice without loading the loan app`, async () => {
      const response = litePrivacyResponse(`/${language}/lite-privacy`)
      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toContain('text/html')
      expect(response.headers.get('x-robots-tag')).toBe('noindex')
      const html = await response.text()
      expect(html).toContain(`<html lang="${language}">`)
      expect(html).toContain(`https://www.kivalens.org/${language}/lite-privacy`)
      expect(html.match(/<section>/g)).toHaveLength(5)
      expect(html.match(/hreflang=/g)).toHaveLength(7)
      expect(html).not.toMatch(/<script|rum\.kivalens|\/search|<iframe/)
      expect(html).toContain('support@humansareuseful.ai')
    })
  }
  it('does not claim ordinary site routes or arbitrary languages', () => {
    for (const path of ['/privacy', '/search', '/xx/lite-privacy', '/en/lite-privacy/extra'])
      expect(litePrivacyResponse(path)).toBeNull()
  })

  it('describes the current browser-based support flow accurately', async () => {
    const html = await litePrivacyResponse('/en/lite-privacy').text()
    expect(html).toContain('Send Feedback and My Reports open the support experience in your browser.')
    expect(html).toContain('Lite itself does not submit a report.')
    expect(html).not.toContain('the app sends your message')
    expect(html).not.toContain('feedback drafts')
  })
})
