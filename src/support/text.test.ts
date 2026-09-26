import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import catalog from './shared-support.json'
import lock from './shared-support.lock.json'
import { EXTRA_LOCALES } from './extraLocales'
import { reportHeadline, supportKey, supportText } from './text'
import { LOCALES, translate } from '../i18n'

const dir = path.join(process.cwd(), 'src/support')
const placeholders = (s: string) => (s.match(/\{[a-zA-Z]+\}/g) ?? []).sort().join()

/** Every shared key the support screens render: literal keys, and the families built from a status or kind. */
function renderedKeys(): string[] {
  const keys = new Set<string>()
  for (const file of readdirSync(dir).filter((f) => /\.tsx?$/.test(f) && !/\.test\./.test(f))) {
    const source = readFileSync(path.join(dir, file), 'utf8')
    for (const m of source.matchAll(/\bs\(\s*'([a-zA-Z.]+)'/g)) keys.add(supportKey(m[1]))
    for (const m of source.matchAll(/'((?:feedback|reports|facts|common|menu)\.[a-zA-Z.]+)'/g)) {
      if (m[1] in catalog.strings || m[1] in (catalog.entryPoints.web_app.copyVariants as Record<string, string>)) keys.add(supportKey(m[1]))
    }
  }
  for (const status of Object.keys(catalog.reports.statuses)) {
    keys.add(`reports.status.${status}`)
    keys.add(`reports.status.${status}.help`)
  }
  for (const kind of ['idea', 'bug', 'language']) keys.add(`feedback.kind.${kind}`)
  for (const d of ['web', 'development']) keys.add(`facts.distribution.${d}`)
  return [...keys].sort()
}

describe('the vendored shared definition', () => {
  it('is the exact snapshot its lock pins', () => {
    const bytes = readFileSync(path.join(dir, 'shared-support.json'))
    expect(`sha256:${createHash('sha256').update(bytes).digest('hex')}`).toBe(lock.fileSha256)
    expect(catalog.version).toBe(lock.version)
    expect(catalog.fingerprint).toBe(lock.fingerprint)
  })

  it('is the web realization, one Send Feedback entry and My Reports', () => {
    expect(catalog.entryPoints.web_app.footer.map((e: { opens: string }) => e.opens)).toEqual(['feedback', 'myReports'])
  })
})

describe('every rendered string, in all nine languages', () => {
  const keys = renderedKeys()

  it('exists in the shared definition', () => {
    const missing = keys.filter((k) => !(k in catalog.strings))
    expect(missing).toEqual([])
    expect(keys.length).toBeGreaterThan(90)
  })

  it('has Italian and Dutch, with the same placeholders as English', () => {
    for (const locale of ['it', 'nl'] as const) {
      for (const key of keys) {
        const value = EXTRA_LOCALES[locale][key]
        expect(value, `${locale}:${key}`).toBeTruthy()
        expect(placeholders(value), `${locale}:${key}`).toBe(placeholders((catalog.strings as Record<string, { en: string }>)[key].en))
      }
    }
  })

  it('carries no Italian or Dutch for a key the definition does not have', () => {
    for (const locale of ['it', 'nl'] as const) {
      expect(Object.keys(EXTRA_LOCALES[locale]).filter((k) => !(k in catalog.strings))).toEqual([])
    }
  })

  it('reads in each language as the definition or KivaLens wrote it, never quietly English', () => {
    for (const { code } of LOCALES) {
      if (code === 'en') continue
      const title = supportText(code, 'feedback.title')
      expect(title, code).not.toBe('Send Feedback')
    }
  })

  it('uses the browser wording where the definition has one', () => {
    expect(supportText('en', 'reports.subtitle')).toBe('Only reports sent from this browser.')
    expect(supportText('de', 'feedback.upgradeRequired')).toMatch(/Seite/)
    expect(supportText('nl', 'reports.empty.body')).toMatch(/browser/)
  })

  it('fills named values', () => {
    expect(supportText('en', 'reports.status.fixedIn', { version: '2.0' })).toBe('Fixed in 2.0')
    expect(supportText('ja', 'feedback.send.language', { language: 'Kiswahili' })).toContain('Kiswahili')
  })
})

describe('the entry labels KivaLens keeps in its own catalogs', () => {
  // The footer shows them on every page, so they live in the small app catalog
  // rather than the lazily loaded shared one; they must still say the same.
  const pairs = { send_feedback: 'menu.sendFeedback', my_reports: 'menu.myReports', suggest_language: 'menu.suggestLanguage' }
  it.each(Object.entries(pairs))('%s says what the shared %s says, in every language', async (appKey, sharedKey) => {
    for (const { code } of LOCALES) {
      const own = (await import(`../i18n/locales/${code}.ts`)).default as Record<string, string>
      expect(translate(code, appKey, { language: '{language}' }, own), code).toBe(supportText(code, sharedKey))
    }
  })
})

describe('report headlines', () => {
  it('are the first line the lender wrote', () => {
    expect(reportHeadline('\n  \nFirst line\nsecond')).toBe('First line')
  })

  it('stop at 160 whole characters, with an ellipsis', () => {
    const long = '😀'.repeat(200)
    const headline = reportHeadline(long)
    expect([...headline]).toHaveLength(161)
    expect(headline.endsWith('…')).toBe(true)
    expect(reportHeadline('x'.repeat(160))).toBe('x'.repeat(160))
  })
})
