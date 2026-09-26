import { LOCALES, matchLocale, type Locale } from '../i18n'

/**
 * Languages a lender can ask for. The same 76 as the native apps' picker
 * (app-services native FeedbackLanguages.json), named by the browser's own
 * language data in the lender's language, less the nine KivaLens already has.
 */
export const REQUESTABLE_LANGUAGE_CODES = [
  'af', 'am', 'ar', 'az', 'be', 'bg', 'bn', 'bs', 'ca', 'cs', 'cy', 'da', 'de', 'el', 'en', 'es', 'et', 'eu', 'fa',
  'fi', 'fil', 'fr', 'ga', 'gl', 'gu', 'he', 'hi', 'hr', 'hu', 'hy', 'id', 'is', 'it', 'ja', 'ka', 'kk', 'km', 'kn',
  'ko', 'lo', 'lt', 'lv', 'mk', 'ml', 'mn', 'mr', 'ms', 'mt', 'my', 'ne', 'nl', 'no', 'pa', 'pl', 'pt', 'pt-BR', 'ro',
  'ru', 'si', 'sk', 'sl', 'sq', 'sr', 'sv', 'sw', 'ta', 'te', 'th', 'tr', 'uk', 'ur', 'uz', 'vi', 'zh-Hans', 'zh-Hant',
  'zu',
] as const

const SUPPORTED = new Set<string>(LOCALES.map((l) => l.code))

export interface LanguageChoice {
  code: string
  /** What the lender reads: its own name, then its name in their language when that differs. */
  title: string
}

function displayName(code: string, inLanguage: string): string | undefined {
  try {
    return new Intl.DisplayNames([inLanguage], { type: 'language' }).of(code)
  } catch {
    return undefined
  }
}

export function languageTitle(code: string, locale: Locale): string {
  const own = displayName(code, code) ?? code
  const local = displayName(code, locale) ?? own
  return own.localeCompare(local, undefined, { sensitivity: 'base' }) === 0 ? own : `${own} — ${local}`
}

export function requestableLanguages(locale: Locale): LanguageChoice[] {
  return REQUESTABLE_LANGUAGE_CODES.filter((code) => !SUPPORTED.has(code))
    .map((code) => ({ code, title: languageTitle(code, locale) }))
    .sort((a, b) => a.title.localeCompare(b.title, locale))
}

/**
 * The browser's first language when KivaLens does not speak it — the one the
 * language menu's Suggest Language arrives with, already chosen (definition
 * entryPoints.web_app.languageMenu).
 * Null when KivaLens already has it, or the browser names nothing usable.
 */
export function unsupportedBrowserLanguage(tags: readonly string[]): string | null {
  const first = tags.find((tag) => /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/.test(tag))
  if (!first) return null
  // KivaLens shows Simplified Chinese to a Traditional reader, but Traditional is
  // still a language it does not have: offer it, as the native apps do.
  if (/^zh-(hant|tw|hk|mo)/i.test(first)) return 'zh-Hant'
  if (matchLocale([first])) return null
  const base = first.split('-')[0].toLowerCase()
  return REQUESTABLE_LANGUAGE_CODES.find((code) => code.toLowerCase() === first.toLowerCase()) ??
    REQUESTABLE_LANGUAGE_CODES.find((code) => code === base) ??
    base
}
