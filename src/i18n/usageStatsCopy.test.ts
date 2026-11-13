import { describe, expect, it } from 'vitest'
import en from './locales/en'
import de from './locales/de'
import es from './locales/es'
import fr from './locales/fr'
import it_ from './locales/it'
import ja from './locales/ja'
import nl from './locales/nl'
import ptBR from './locales/pt-BR'
import zhHans from './locales/zh-Hans'
import { USAGE_EVENTS } from '../lib/rum/usageEvents'
import { METRICS } from '../lib/rum/payload'

// Usage statistics carry the names of the filters a search used and its
// choices among KivaLens's own settings (Both / MFI Only / Direct Only, All or
// None for a list, the sort order, what Limit to groups by), never a value
// picked or typed: no sector, country, partner, age or words
// (src/lib/rum/usage.ts, criteriaTokens). "Which filters your searches use,
// never what you search for" read as one thing allowed and forbidden at once
// (Paul, 2026-11-13: "that's the same thing"). So both the Options help and the
// Privacy page say it by example, the same examples in every language: a
// filter's name, a setting, and a value that is never sent. The wording can
// still be wrong in ways no string check sees; these hold the examples in place.

const CATALOGS: Record<string, Record<string, string>> = {
  en, de, es, fr, it: it_, ja, nl, 'pt-BR': ptBR, 'zh-Hans': zhHans,
}
const EXAMPLES: Record<string, { filters: [string, string]; sector: string; setting: string; value: string }> = {
  en: { filters: ['sector', 'age'], sector: 'sector', setting: 'sort order', value: 'countries' },
  de: { filters: ['Sektor', 'Alter'], sector: 'Sektor', setting: 'Sortierung', value: 'Länder' },
  es: { filters: ['sector', 'edad'], sector: 'sector', setting: 'el orden', value: 'países' },
  fr: { filters: ['secteur', 'âge'], sector: 'secteur', setting: 'ordre de tri', value: 'pays' },
  it: { filters: ['settore', 'età'], sector: 'settor', setting: 'ordinamento', value: 'paesi' },
  ja: { filters: ['セクター', '年齢'], sector: 'セクター', setting: '並べ替え', value: '国' },
  nl: { filters: ['sector', 'leeftijd'], sector: 'sector', setting: 'sortering', value: 'landen' },
  'pt-BR': { filters: ['setor', 'idade'], sector: 'setor', setting: 'ordenação', value: 'países' },
  'zh-Hans': { filters: ['行业', '年龄'], sector: '行业', setting: '排序', value: '国家' },
}
const occurrences = (text: string, word: string) => text.split(word).length - 1
// The word that turns the sentence from what is sent to what never is, and
// whether it comes before the values (most languages) or after them (Japanese).
const NEVER: Record<string, { word: string; before: boolean }> = {
  en: { word: 'never', before: true },
  de: { word: 'niemals', before: true },
  es: { word: 'nunca', before: true },
  fr: { word: 'jamais', before: true },
  it: { word: 'mai', before: true },
  ja: { word: '送信されません', before: false },
  nl: { word: 'nooit', before: true },
  'pt-BR': { word: 'nunca', before: true },
  'zh-Hans': { word: '从不', before: true },
}
// The Privacy paragraph's never-word, where it differs from the help's.
const BODY_NEVER: Record<string, string> = {
  en: 'never', de: 'niemals', es: 'nunca', fr: 'jamais', it: 'mai', ja: '含みません', nl: 'nooit', 'pt-BR': 'nunca', 'zh-Hans': '从不',
}
// Each kind of action the report counts (src/lib/rum/usageEvents.ts), as the
// English Privacy page names it. A new kind fails here until it is disclosed.
const ACTIONS_DISCLOSED: Record<string, string> = {
  basket_add: 'loans you added to the basket',
  checkout: 'pressed Checkout at Kiva',
  checkout_loans: 'sent to Kiva to lend',
  saved_load: 'loaded one of your saved searches',
  history_restore: 'went back through your search history',
  rss_copy: 'copied an RSS link',
  'preset:': 'built-in saved searches you loaded',
  'home:': 'suggestion cards on Search',
}

describe('the usage-statistics texts say what is sent by example', () => {
  it.each(Object.keys(CATALOGS))('in %s', (locale) => {
    const { usage_stats_help: help, usage_statistics_body: body } = CATALOGS[locale]
    const { filters, sector, setting, value } = EXAMPLES[locale]
    for (const word of filters) {
      // Quoted as a filter's name, so "age" is not found inside "usage" or "page".
      const named = new RegExp(`[“„«‘「]\\s*${word}\\s*[”“»’」]`)
      expect(help, `${locale} help names the filter ${word}`).toMatch(named)
      expect(body, `${locale} Privacy names the filter ${word}`).toMatch(named)
    }
    expect(help, `${locale} help names a setting`).toContain(setting)
    expect(body, `${locale} Privacy names a setting`).toContain(setting)
    // The help names the sector twice: once as a filter that is reported, once
    // among the values that never are.
    expect(occurrences(help, sector), `${locale} help: sector as filter and as value`).toBeGreaterThanOrEqual(2)
    // ...and the sector as a value sits on the never side of the sentence.
    const never = help.indexOf(NEVER[locale].word)
    const asValue = help.lastIndexOf(sector)
    expect(never, `${locale} help says never`).toBeGreaterThanOrEqual(0)
    if (NEVER[locale].before) expect(never, `${locale}: never comes before the values`).toBeLessThan(asValue)
    else expect(never, `${locale}: never comes after the values`).toBeGreaterThan(asValue)
    expect(body, `${locale} Privacy names a value that is never sent`).toContain(value)
    // ...on the never side of its clause.
    const at = body.indexOf(value)
    if (NEVER[locale].before) {
      const clauseStart = Math.max(body.lastIndexOf(';', at), body.lastIndexOf('；', at))
      expect(body.lastIndexOf(BODY_NEVER[locale], at), `${locale}: Privacy says never in the same clause, before the values`).toBeGreaterThan(clauseStart)
    } else {
      const never = body.indexOf(BODY_NEVER[locale], at)
      expect(never, `${locale}: Privacy says never after the values`).toBeGreaterThanOrEqual(0)
      expect(never, `${locale}: ...inside the same parenthesis`).toBeLessThan(body.indexOf('）', at))
    }
    expect(help).toContain('{privacy}')
  })
})

describe('the Privacy page names everything the usage report counts', () => {
  it('every kind of action, in English', () => {
    expect(Object.keys(ACTIONS_DISCLOSED).filter((k) => !k.endsWith(':')).sort()).toEqual([...USAGE_EVENTS].sort())
    for (const phrase of Object.values(ACTIONS_DISCLOSED)) expect(en.usage_statistics_body).toContain(phrase)
  })

  it('and the day the browser\'s number was made', () => {
    expect(en.usage_statistics_body).toContain('and the day it was made')
  })
})

describe('the Privacy page names everything a visit report carries', () => {
  // Each measurement the report can carry (src/lib/rum/payload.ts METRICS), as the
  // English paragraph names it. A new measurement fails here until it is disclosed.
  const MEASURED: Record<string, string> = {
    ttfb: 'how long the page and the loan list took to load',
    fcp: 'how long the page and the loan list took to load',
    lcp: 'how long the page and the loan list took to load',
    inp: 'how quickly the page answered clicks and taps',
    cls: 'how much its layout shifted',
    catalog: 'how long the page and the loan list took to load',
    results: 'how long the page and the loan list took to load',
    resync: 'how long the page and the loan list took to load',
    api_start: 'how long requests to KivaLens took',
    api_pages: 'how long requests to KivaLens took',
    api_since: 'how long requests to KivaLens took',
    graphql: 'how long requests to KivaLens took',
    chat_first: 'how long its answers took',
    chat_total: 'how long its answers took',
  }
  // The report's other fields (payload.ts ReportPayload), by the same rule.
  const FIELDS: Record<string, string> = {
    view: 'a random number for that visit only, never kept in the browser',
    host: 'which of KivaLens’s addresses it came to',
    route: 'which page it started on',
    version: 'the app version',
    lang: 'the language',
    device: 'the screen size class',
    net: 'the kind of connection',
    source: 'where the loan list came from',
    chats: 'how many times Ask KivaLens was used',
    errors: 'any errors the page ran into',
  }

  it('every measurement, in English', () => {
    expect(Object.keys(MEASURED).sort()).toEqual([...METRICS].sort())
    for (const phrase of Object.values(MEASURED)) expect(en.anonymous_visit_reports).toContain(phrase)
  })

  it('and every other field, in English', () => {
    for (const phrase of Object.values(FIELDS)) expect(en.anonymous_visit_reports).toContain(phrase)
  })

  it('and when reports are sent and what the collector keeps of their arrival, in English', () => {
    // A report goes when the page is left or hidden, again each time it is hidden
    // (the collector keeps the latest), and errors can go sooner (src/main.tsx).
    expect(en.anonymous_visit_reports).toContain('when you leave or hide the page')
    expect(en.anonymous_visit_reports).toContain('only the latest is kept')
    expect(en.anonymous_visit_reports).toContain('errors may be sent sooner')
    // cloudflare/rum/src/store.ts keeps the day and time of arrival.
    expect(en.anonymous_visit_reports).toContain('the date and time each report arrived')
    // ...and what scrub.ts does to error text, with its one exception.
    expect(en.anonymous_visit_reports).toContain('cuts the addresses it finds to their site, except its own script files, and removes the long numbers it finds')
    // It promises no more than that: the scrub is a best effort over text it did not write.
    expect(en.anonymous_visit_reports).toContain('it cannot recognize everything an error might quote, and the rest of an error’s words are sent as they are')
  })
})
