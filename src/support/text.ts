import catalog from './shared-support.json'
import { EXTRA_LOCALES } from './extraLocales'
import type { Locale } from '../i18n'

/**
 * The shared support copy in the lender's language.
 *
 * The seven shared languages come from the vendored definition snapshot
 * (shared-support.json, pinned by shared-support.lock.json); Italian and Dutch
 * from KivaLens's own translations of the same keys. Where the definition names
 * a web wording for a key ("this browser" for "this device", "Reload the page"
 * for "Update the app"), the web wording is used. A key never falls back to
 * English silently: text.test.ts holds every rendered key to all nine.
 */

type Strings = Record<string, Record<string, string>>
const STRINGS = catalog.strings as Strings
const VARIANTS = catalog.entryPoints.web_app.copyVariants as Record<string, string>

export function supportKey(key: string): string {
  return VARIANTS[key] ?? key
}

export function supportText(locale: Locale, key: string, params?: Record<string, string | number>): string {
  const resolved = supportKey(key)
  const shared = STRINGS[resolved]
  const value =
    (locale === 'it' || locale === 'nl' ? EXTRA_LOCALES[locale][resolved] : shared?.[locale]) ?? shared?.en ?? resolved
  if (!params) return value
  return value.replace(/\{([a-zA-Z]+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match))
}

export const SUPPORT_CATALOG = catalog

/**
 * The first nonempty line the lender wrote, at most 160 whole characters, with
 * an ellipsis when cut (definition myReports.recognition). Whole characters:
 * an emoji or accented letter is never split in two.
 */
export function reportHeadline(message: string, max = catalog.reports.headlineCharacters): string {
  const line = message.split(/\r?\n/).map((l) => l.trim()).find(Boolean) ?? ''
  const chars = [...line]
  return chars.length > max ? `${chars.slice(0, max).join('').trimEnd()}…` : line
}
