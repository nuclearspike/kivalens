import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import ts from 'typescript'
import { hasTranslation, type Locale } from './index'
import { EXTRA_TRANSLATION_ROWS } from './extraCatalog'
import generatedEs from './generated/es'
import generatedFr from './generated/fr'
import generatedDe from './generated/de'
import generatedIt from './generated/it'
import generatedNl from './generated/nl'
import { WELCOME_PROMPT, WELCOME_REPLY } from '../lib/askKivaLensWelcome'

const locales: Locale[] = ['es', 'fr', 'de', 'it', 'nl']
const generatedCatalogs = {
  es: generatedEs,
  fr: generatedFr,
  de: generatedDe,
  it: generatedIt,
  nl: generatedNl,
}

function sourceFiles(root: string): string[] {
  return readdirSync(root).flatMap((name) => {
    const path = join(root, name)
    if (name === 'node_modules' || name === 'dist') return []
    return statSync(path).isDirectory()
      ? sourceFiles(path)
      : /\.(ts|tsx)$/.test(name) && !name.endsWith('.test.ts') ? [path] : []
  })
}

function collectStringLiterals(node: ts.Node, keys: Set<string>) {
  const isCanonicalValue = (
    (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
    ts.isPropertyAssignment(node.parent) &&
    ((ts.isIdentifier(node.parent.name) || ts.isStringLiteral(node.parent.name)) && node.parent.name.text === 'value')
  )
  if (
    (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
    node.text.trim() &&
    !isCanonicalValue
  ) keys.add(node.text)
  ts.forEachChild(node, (child) => collectStringLiterals(child, keys))
}

function literalTranslationKeys(path: string): string[] {
  const source = readFileSync(path, 'utf8')
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, path.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const keys = new Set<string>()
  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 't' &&
      node.arguments.length > 0 &&
      (ts.isStringLiteral(node.arguments[0]) || ts.isNoSubstitutionTemplateLiteral(node.arguments[0]))
    ) keys.add(node.arguments[0].text)
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      /(?:_OPTIONS|_SLIDERS|_HELP)$/.test(node.name.text) &&
      node.initializer
    ) collectStringLiterals(node.initializer, keys)
    ts.forEachChild(node, visit)
  }
  visit(file)
  return [...keys]
}

describe('localization catalog coverage', () => {
  it('has no duplicate or empty row translations', () => {
    const keys = EXTRA_TRANSLATION_ROWS.map((row) => row[0])
    expect(new Set(keys).size).toBe(keys.length)
    for (const row of EXTRA_TRANSLATION_ROWS) {
      expect(row).toHaveLength(6)
      for (const value of row) expect(value.trim().length).toBeGreaterThan(0)
    }
    const generatedKeys = Object.keys(generatedCatalogs.es).sort()
    expect(new Set(generatedKeys).size).toBe(generatedKeys.length)
    for (const locale of locales) {
      const catalog = generatedCatalogs[locale]
      expect(Object.keys(catalog).sort()).toEqual(generatedKeys)
      for (const value of Object.values(catalog)) expect(value.trim().length).toBeGreaterThan(0)
    }
  })

  it('translates every static t() key in every supported locale', () => {
    const root = join(process.cwd(), 'src')
    const missing = new Set<string>()
    for (const path of sourceFiles(root)) {
      for (const key of literalTranslationKeys(path)) {
        if (locales.some((locale) =>
          !hasTranslation(locale, key) && !(key in generatedCatalogs[locale]),
        )) {
          missing.add(`${relative(root, path)}: ${key}`)
        }
      }
    }
    expect([...missing], [...missing].join('\n')).toEqual([])
  })

  it('does not leave static user-facing JSX text or accessibility attributes outside localization', () => {
    const root = join(process.cwd(), 'src')
    const violations: string[] = []
    const properNames = /^(?:Kiva(?:\.org|Lens)?|A\+ Team|IFTTT(?: \(If This Then That\))?|RSS|AI|K)$/
    for (const path of sourceFiles(root).filter((candidate) => candidate.endsWith('.tsx'))) {
      const source = readFileSync(path, 'utf8')
      const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
      const visit = (node: ts.Node) => {
        if (ts.isJsxText(node)) {
          const value = node.text.replace(/\s+/g, ' ').trim()
          const visibleValue = value.replace(/&\w+;/g, '').trim()
          if (/[A-Za-z]/.test(visibleValue) && !properNames.test(visibleValue)) {
            violations.push(`${relative(root, path)}: ${value}`)
          }
        }
        if (
          ts.isJsxAttribute(node) &&
          ['aria-label', 'alt', 'label', 'placeholder', 'title'].includes(node.name.text) &&
          node.initializer &&
          ts.isStringLiteral(node.initializer) &&
          /[A-Za-zÀ-ÿ]/.test(node.initializer.text)
        ) {
          violations.push(`${relative(root, path)}: ${node.name.text}="${node.initializer.text}"`)
        }
        if (
          ts.isCallExpression(node) &&
          ts.isIdentifier(node.expression) &&
          ['setError', 'setMessage', 'showAlert', 'showConfirm', 'showPrompt'].includes(node.expression.text) &&
          node.arguments[0] &&
          (
            ts.isStringLiteral(node.arguments[0]) ||
            ts.isNoSubstitutionTemplateLiteral(node.arguments[0]) ||
            ts.isTemplateExpression(node.arguments[0])
          ) &&
          node.arguments[0].getText(file).replace(/['"`]/g, '').trim()
        ) {
          violations.push(`${relative(root, path)}: untranslated ${node.expression.text} call`)
        }
        ts.forEachChild(node, visit)
      }
      visit(file)
    }
    expect(violations, violations.join('\n')).toEqual([])
  })

  it('covers AI startup copy and canonical default saved-search display names', () => {
    const required = [
      WELCOME_PROMPT,
      WELCOME_REPLY,
      "Hi! I'm the KivaLens assistant. Tell me what kind of loans you'd like to fund — a sector, a country, a cause, a type of borrower — and I'll build the search for you.",
      'Expiring Soon',
      'Pays Back Fast (ex: Short term, pre-disbursed, posted awhile ago)',
      'Popular',
      'Only one more lender needed',
      'Large Groups: Evenly Men & Women',
      "Countries I Don't Have",
      'Balance Partner Risk',
      'Young Parent',
    ]
    for (const key of required) {
      for (const locale of locales) {
        expect(
          hasTranslation(locale, key) || key in generatedCatalogs[locale],
          `${locale}: ${key}`,
        ).toBe(true)
      }
    }
  })
})
