/* eslint-disable react-refresh/only-export-components -- locale helpers and the provider intentionally share one public module. */
import { localizeCountryName } from './countryNames'
import { Fragment, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import enCatalog from './locales/en'

export type Locale = 'en' | 'es' | 'fr' | 'de' | 'it' | 'nl' | 'pt-BR' | 'ja' | 'zh-Hans'
type SecondaryLocale = Exclude<Locale, 'en'>

// Labels are endonyms on purpose — each language named in itself, never
// translated into the active locale — so a reader can always find their own.
// `short` is the menu's closed-state code; `country` picks the flag drawn
// beside each language (a language is not a country, so this is the flag of
// the locale's reference region, e.g. pt-BR → BR).
export const LOCALES: ReadonlyArray<{ code: Locale; label: string; short: string; country: string }> = [
  { code: 'en', label: 'English', short: 'EN', country: 'US' },
  { code: 'es', label: 'Español', short: 'ES', country: 'ES' },
  { code: 'fr', label: 'Français', short: 'FR', country: 'FR' },
  { code: 'de', label: 'Deutsch', short: 'DE', country: 'DE' },
  { code: 'it', label: 'Italiano', short: 'IT', country: 'IT' },
  { code: 'nl', label: 'Nederlands', short: 'NL', country: 'NL' },
  { code: 'pt-BR', label: 'Português (Brasil)', short: 'PT', country: 'BR' },
  { code: 'ja', label: '日本語', short: 'JA', country: 'JP' },
  { code: 'zh-Hans', label: '简体中文', short: 'ZH', country: 'CN' },
]

const STORAGE_KEY = 'KivaLensLocale'
const supported = new Set<Locale>(LOCALES.map(({ code }) => code))

type Params = Record<string, string | number>
type Catalog = Record<string, string>
const EMPTY_CATALOG: Catalog = {}

// Every UI string is keyed by a short symbolic key (e.g. 'set_lender_id'), never
// by its English text — see src/i18n/locales/*.ts. English is a peer locale
// file like the other eight; it happens to be bundled eagerly (below) while the
// others load on demand, purely as a startup-cost optimization for the
// overwhelmingly common case.
function loadCatalog(locale: SecondaryLocale): Promise<Catalog> {
  switch (locale) {
    case 'es': return import('./locales/es').then((m) => m.default)
    case 'fr': return import('./locales/fr').then((m) => m.default)
    case 'de': return import('./locales/de').then((m) => m.default)
    case 'it': return import('./locales/it').then((m) => m.default)
    case 'nl': return import('./locales/nl').then((m) => m.default)
    case 'pt-BR': return import('./locales/pt-BR').then((m) => m.default)
    case 'ja': return import('./locales/ja').then((m) => m.default)
    case 'zh-Hans': return import('./locales/zh-Hans').then((m) => m.default)
  }
}

function templateFor(locale: Locale, key: string, catalog: Catalog): string {
  return locale === 'en' ? (enCatalog as Catalog)[key] ?? key : catalog[key] ?? (enCatalog as Catalog)[key] ?? key
}

export function translate(
  locale: Locale,
  key: string,
  params: Params = {},
  catalog: Catalog = EMPTY_CATALOG,
): string {
  // Null-safe: callers sometimes pass a nullable data field; never throw on missing keys.
  if (key == null) return ''
  return templateFor(locale, key, catalog).replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`))
}

type NodeParams = Record<string, ReactNode>

// A sentence that contains a link (or any element) is ONE key with a
// placeholder for it — `'Manage them on the {savedTab}.'` — never two text
// fragments glued around the element in JSX, because word order and spacing
// around the link differ by language (Japanese and Chinese put no space
// before it; German may move it). The placeholder is replaced by the element
// wherever the translator placed it in the sentence.
export function translateNodes(
  locale: Locale,
  key: string,
  params: NodeParams = {},
  catalog: Catalog = EMPTY_CATALOG,
): ReactNode {
  if (key == null) return ''
  const template = templateFor(locale, key, catalog)
  const out: ReactNode[] = []
  const re = /\{(\w+)\}/g
  let last = 0
  let match: RegExpExecArray | null
  while ((match = re.exec(template))) {
    if (match.index > last) out.push(template.slice(last, match.index))
    const value = params[match[1]]
    out.push(value === undefined ? match[0] : <Fragment key={match.index}>{value}</Fragment>)
    last = match.index + match[0].length
  }
  if (last < template.length) out.push(template.slice(last))
  return out
}

// Numbers, currency and percentages format per locale through CLDR data
// (Intl.NumberFormat): pt-BR groups with '.', fr with a narrow no-break
// space, and the currency symbol lands where that locale puts it. Formatters
// are cached — constructing one is far costlier than using it.
const formatterCache = new Map<string, Intl.NumberFormat>()
function numberFormatter(locale: Locale, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const cacheKey = `${locale}|${JSON.stringify(options)}`
  let formatter = formatterCache.get(cacheKey)
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, options)
    formatterCache.set(cacheKey, formatter)
  }
  return formatter
}

// Non-numeric input (undefined, null, '') formats as 0, never "NaN": callers pass
// API fields straight through, and an absent count or amount displays as zero.
const finite = (value: unknown): number => (Number.isFinite(Number(value)) ? Number(value) : 0)

type Fraction = number | { min: number; max: number }
const fractionOptions = (fraction: Fraction): Intl.NumberFormatOptions =>
  typeof fraction === 'number'
    ? { minimumFractionDigits: fraction, maximumFractionDigits: fraction }
    : { minimumFractionDigits: fraction.min, maximumFractionDigits: fraction.max }

export function formatNumber(locale: Locale, value: unknown, fraction: Fraction = 0): string {
  return numberFormatter(locale, fractionOptions(fraction)).format(finite(value))
}

/** Kiva lends in US dollars everywhere, so the currency is fixed; only its presentation is localized. */
export function formatCurrency(locale: Locale, value: unknown, fraction: Fraction = 0): string {
  return numberFormatter(locale, { style: 'currency', currency: 'USD', ...fractionOptions(fraction) }).format(finite(value))
}

/** `value` is already in percent units (16.833 → "16.833%"), as Kiva's API and the app's own math express it. */
export function formatPercent(locale: Locale, value: unknown, fraction: Fraction = 1): string {
  return numberFormatter(locale, { style: 'percent', ...fractionOptions(fraction) }).format(finite(value) / 100)
}

// Kiva's own data vocabulary — sector, activity, country, repayment-interval
// and status names — arrives as the external system's canonical English string
// (loan.activity === 'Bakery'), not as a catalog key: it is Kiva's identifier,
// the same way a country code would be. Every such name also exists as an
// English catalog VALUE, so it is translated by looking its key up from that
// value. Text we have no entry for (a sector Kiva adds tomorrow) passes through
// unchanged rather than showing a key or throwing.
const keyByEnglishText: ReadonlyMap<string, string> = (() => {
  const map = new Map<string, string>()
  for (const [key, text] of Object.entries(enCatalog)) if (!map.has(text)) map.set(text, key)
  return map
})()

export function translateData(locale: Locale, text: string, catalog: Catalog = EMPTY_CATALOG): string {
  if (text == null) return ''
  const key = keyByEnglishText.get(text)
  if (key) return translate(locale, key, {}, catalog)
  // Not in the catalog: a country Kiva is not fundraising in today still gets
  // its name in the lender's language (see countryNames.ts); anything else
  // passes through as Kiva sent it.
  return (locale === 'en' ? undefined : localizeCountryName(locale, text)) ?? text
}

/** Sector names are one case of Kiva data vocabulary; kept as a named alias for existing callers. */
export const translateSector = translateData

// Every locale file is generated from the same key set (see
// scripts/check-i18n.mjs's parity check), so a key that exists in English
// exists everywhere — this checks the one catalog that's always loaded.
export function hasTranslation(_locale: Locale, key: string): boolean {
  return key in enCatalog
}

export function formatRelativeTime(locale: Locale, value: Date | string | number, now = Date.now()): string {
  const difference = new Date(value).getTime() - now
  const absolute = Math.abs(difference)
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 365 * 24 * 60 * 60 * 1000],
    ['month', 30 * 24 * 60 * 60 * 1000],
    ['week', 7 * 24 * 60 * 60 * 1000],
    ['day', 24 * 60 * 60 * 1000],
    ['hour', 60 * 60 * 1000],
    ['minute', 60 * 1000],
  ]
  const [unit, size] = units.find(([, unitSize]) => absolute >= unitSize) ?? ['second', 1000]
  return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(Math.round(difference / size), unit)
}

/**
 * Resolve BCP 47 tags (a single tag, or an ordered preference list such as
 * navigator.languages) to a supported locale. Exact match first (case-
 * insensitive, so 'pt-br' and 'zh-hans' work), then region fallbacks —
 * pt-* → pt-BR; every zh-* → zh-Hans, including Traditional-script tags
 * (zh-TW / zh-HK / zh-MO / zh-Hant): Simplified is the only Chinese offered,
 * and a Traditional reader is far better served by it than by English — then
 * bare-language match (en-GB → en). A list with no match resolves to
 * undefined (callers fall back to English).
 */
export function matchLocale(tags: readonly string[] | string | null | undefined): Locale | undefined {
  const list = (typeof tags === 'string' ? [tags] : [...(tags ?? [])]).filter((t) => typeof t === 'string' && t)
  for (const tag of list) {
    const lower = tag.toLowerCase()
    const exact = LOCALES.find((l) => l.code.toLowerCase() === lower)
    if (exact) return exact.code
    const [base] = lower.split('-')
    if (base === 'pt') return 'pt-BR'
    if (base === 'zh') return 'zh-Hans'
    if (supported.has(base as Locale)) return base as Locale
  }
  return undefined
}

/** The browser's ordered language preferences (navigator.languages, falling back to navigator.language). */
export function browserLanguageTags(): readonly string[] {
  if (typeof navigator === 'undefined') return []
  if (navigator.languages?.length) return navigator.languages
  return navigator.language ? [navigator.language] : []
}

function initialLocale(): Locale {
  if (typeof window === 'undefined') return 'en'
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved && supported.has(saved as Locale)) return saved as Locale
  } catch {
    // Fall through to browser preference.
  }
  return matchLocale(browserLanguageTags()) ?? 'en'
}

type I18nValue = {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string, params?: Params) => string
  /** Like `t`, but placeholders may be React elements (a link inside a sentence). */
  tx: (key: string, params?: NodeParams) => ReactNode
  /** Translate a Kiva data value (sector, activity, country, status…) by its canonical English name. */
  data: (text: string) => string
  /** @deprecated alias of `data` for existing sector call sites. */
  sector: (englishSector: string) => string
  relativeTime: (value: Date | string | number, now?: number) => string
  date: (value: Date | string | number, options?: Intl.DateTimeFormatOptions) => string
  number: (value: unknown, fraction?: Fraction) => string
  currency: (value: unknown, fraction?: Fraction) => string
  percent: (value: unknown, fraction?: Fraction) => string
}

const I18nContext = createContext<I18nValue>({
  locale: 'en',
  setLocale: () => {},
  t: (key, params) => translate('en', key, params),
  tx: (key, params) => translateNodes('en', key, params),
  data: (value) => translateData('en', value),
  sector: (value) => translateData('en', value),
  relativeTime: (value, now) => formatRelativeTime('en', value, now),
  date: (value, options) => new Intl.DateTimeFormat('en', options).format(new Date(value)),
  number: (value, fraction) => formatNumber('en', value, fraction),
  currency: (value, fraction) => formatCurrency('en', value, fraction),
  percent: (value, fraction) => formatPercent('en', value, fraction),
})

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale)
  const [loadedCatalog, setLoadedCatalog] = useState<{
    locale: SecondaryLocale
    catalog: Catalog
  } | null>(null)
  const setLocale = useCallback((next: Locale) => {
    if (!supported.has(next)) return
    setLocaleState(next)
    try { window.localStorage.setItem(STORAGE_KEY, next) } catch { /* ignore */ }
  }, [])
  useEffect(() => {
    document.documentElement.lang = locale
    if (locale === 'en') return
    let active = true
    const secondaryLocale = locale as SecondaryLocale
    void loadCatalog(secondaryLocale).then((catalog) => {
      if (active) setLoadedCatalog({ locale: secondaryLocale, catalog })
    })
    return () => { active = false }
  }, [locale])
  const activeCatalog =
    locale !== 'en' && loadedCatalog?.locale === locale ? loadedCatalog.catalog : EMPTY_CATALOG
  const value = useMemo<I18nValue>(() => ({
    locale,
    setLocale,
    t: (key, params) => translate(locale, key, params, activeCatalog),
    tx: (key, params) => translateNodes(locale, key, params, activeCatalog),
    data: (text) => translateData(locale, text, activeCatalog),
    sector: (englishSector) => translateData(locale, englishSector, activeCatalog),
    relativeTime: (input, now) => formatRelativeTime(locale, input, now),
    date: (input, options) => new Intl.DateTimeFormat(locale, options).format(new Date(input)),
    number: (value, fraction) => formatNumber(locale, value, fraction),
    currency: (value, fraction) => formatCurrency(locale, value, fraction),
    percent: (value, fraction) => formatPercent(locale, value, fraction),
  }), [activeCatalog, locale, setLocale])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  return useContext(I18nContext)
}
