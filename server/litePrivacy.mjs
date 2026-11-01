/** Standalone app notice: no catalog, account, analytics or app shell is loaded. */
import { LITE_PRIVACY } from './litePrivacyCopy.mjs'

const names = { en: 'English', de: 'Deutsch', fr: 'Français', es: 'Español', 'pt-BR': 'Português (Brasil)', ja: '日本語', 'zh-Hans': '简体中文' }
const escape = (value) => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])

export function litePrivacyResponse(pathname) {
  const match = /^\/(en|de|fr|es|pt-BR|ja|zh-Hans)\/lite-privacy\/?$/.exec(pathname)
  if (!match) return null
  const language = match[1]
  const copy = LITE_PRIVACY[language]
  const canonical = `https://www.kivalens.org/${language}/lite-privacy`
  const html = `<!doctype html><html lang="${language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><meta name="color-scheme" content="light dark"><title>${escape(copy.title)} · KivaLens Lite</title><link rel="canonical" href="${canonical}"><link rel="stylesheet" href="/lite-privacy.css">${Object.keys(names).map(locale => `<link rel="alternate" hreflang="${locale}" href="https://www.kivalens.org/${locale}/lite-privacy">`).join('')}</head><body><main><p>KivaLens Lite · Humans Are Useful</p><h1>${escape(copy.title)}</h1><nav aria-label="${escape(copy.languages)}">${Object.entries(names).map(([locale, name]) => `<a lang="${locale}" href="/${locale}/lite-privacy"${locale === language ? ' aria-current="page"' : ''}>${name}</a>`).join(' ')}</nav><p>${escape(copy.intro)}</p>${copy.sections.map(([heading, text]) => `<section><h2>${escape(heading)}</h2><p>${escape(text)}</p></section>`).join('')}<p><a href="mailto:support@humansareuseful.ai">support@humansareuseful.ai</a></p></main></body></html>`
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache', 'X-Robots-Tag': 'noindex' } })
}

export function litePrivacyResponseForRequest(method, requestUrl) {
  if (method !== 'GET' && method !== 'HEAD') return null
  const pathname = String(requestUrl || '').split('?', 1)[0]
  const response = litePrivacyResponse(pathname)
  if (!response || method !== 'HEAD') return response
  return new Response(null, { status: response.status, statusText: response.statusText, headers: response.headers })
}
