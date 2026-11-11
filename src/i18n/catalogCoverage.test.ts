import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import ts from 'typescript'
import { hasTranslation, type Locale } from './index'
import en from './locales/en'
import es from './locales/es'
import fr from './locales/fr'
import de from './locales/de'
import itCatalog from './locales/it'
import nl from './locales/nl'
import ptBR from './locales/pt-BR'
import ja from './locales/ja'
import zhHans from './locales/zh-Hans'

const locales: Locale[] = ['es', 'fr', 'de', 'it', 'nl', 'pt-BR', 'ja', 'zh-Hans']
const catalogs: Record<Locale, Record<string, string>> = { en, es, fr, de, it: itCatalog, nl, 'pt-BR': ptBR, ja, 'zh-Hans': zhHans }

const placeholders = (s: string) => new Set([...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))

function sourceFiles(root: string): string[] {
  return readdirSync(root).flatMap((name) => {
    const path = join(root, name)
    if (name === 'node_modules' || name === 'dist') return []
    return statSync(path).isDirectory()
      ? sourceFiles(path)
      // Excludes both suffixes vitest.config.ts's own test glob recognizes
      // (`*.{test,spec}.{ts,tsx}`) — a narrower check here excluded `.test.ts`
      // but not `.test.tsx`, so component tests using literal prop values
      // (e.g. label="...") were scanned as if they were product copy.
      : /\.(ts|tsx)$/.test(name) && !/\.(test|spec)\.tsx?$/.test(name) ? [path] : []
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

// Named top-level string constants referenced via t(CONST_NAME) rather than a
// literal argument or a *_OPTIONS/_SLIDERS/_HELP array (see src/lib/askKivaLensWelcome.ts).
const DYNAMIC_CONST_NAMES = new Set(['WELCOME_PROMPT', 'WELCOME_REPLY'])

// Pulls every string-literal branch out of a t(...) argument that isn't a bare
// literal — t(cond ? 'a' : 'b'), t(value ?? 'fallback'), and parenthesized or
// chained combinations of those. Anything else (a property access, a function
// call) yields no literals, correctly: that's dynamic runtime data, not a
// translatable literal this scan can verify. Without this, a call like
// t(showCriteria ? 'Hide Criteria' : 'Show Criteria') is invisible to the scan
// entirely — exactly how that one shipped unrewritten through the first pass
// of the key-based i18n migration.
function literalBranches(node: ts.Node): Array<ts.StringLiteral | ts.NoSubstitutionTemplateLiteral> {
  if (ts.isParenthesizedExpression(node)) return literalBranches(node.expression)
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return [node]
  if (ts.isConditionalExpression(node)) return [...literalBranches(node.whenTrue), ...literalBranches(node.whenFalse)]
  if (
    ts.isBinaryExpression(node) &&
    (node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken || node.operatorToken.kind === ts.SyntaxKind.BarBarToken)
  ) {
    return [...literalBranches(node.left), ...literalBranches(node.right)]
  }
  return []
}

function literalTranslationKeys(path: string): string[] {
  const source = readFileSync(path, 'utf8')
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, path.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const keys = new Set<string>()
  const visit = (node: ts.Node) => {
    // t() returns a string; tx() interpolates React elements into the same
    // catalog text. Both name a key in their first argument.
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      (node.expression.text === 't' || node.expression.text === 'tx') &&
      node.arguments.length > 0
    ) {
      const arg = node.arguments[0]
      if (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) {
        keys.add(arg.text)
      } else if (!ts.isIdentifier(arg)) {
        for (const lit of literalBranches(arg)) keys.add(lit.text)
      }
    }
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer
    ) {
      if (/(?:_OPTIONS|_SLIDERS|_HELP)$/.test(node.name.text)) {
        collectStringLiterals(node.initializer, keys)
      } else if (
        DYNAMIC_CONST_NAMES.has(node.name.text) &&
        (ts.isStringLiteral(node.initializer) || ts.isNoSubstitutionTemplateLiteral(node.initializer))
      ) {
        keys.add(node.initializer.text)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  return [...keys]
}

describe('localization catalog coverage', () => {
  it('keeps every locale catalog in exact key and {placeholder} parity with non-empty values', () => {
    const enKeys = Object.keys(en).sort()
    expect(new Set(enKeys).size).toBe(enKeys.length) // no duplicate keys
    for (const [key, value] of Object.entries(en)) {
      expect(value.trim().length, `en.ts['${key}'] is empty`).toBeGreaterThan(0)
    }
    for (const locale of locales) {
      const catalog = catalogs[locale]
      expect(Object.keys(catalog).sort(), `${locale}.ts key set differs from en.ts`).toEqual(enKeys)
      for (const [key, value] of Object.entries(catalog)) {
        expect(value.trim().length, `${locale}.ts['${key}'] is empty`).toBeGreaterThan(0)
        // A translation that drops or invents a {placeholder} renders a literal
        // "{count}" or silently loses the value it carried.
        expect([...placeholders(value)].sort(), `${locale}.ts['${key}'] placeholders differ from en.ts`)
          .toEqual([...placeholders(en[key])].sort())
      }
    }
  })

  it('has a catalog key for every t() call site in every source file', () => {
    const root = join(process.cwd(), 'src')
    const missing = new Set<string>()
    for (const path of sourceFiles(root)) {
      for (const key of literalTranslationKeys(path)) {
        if (!hasTranslation('en', key)) {
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
    // Checked by KEY, not by English text — keys are the stable identifier now;
    // see src/i18n/locales/en.ts for the current English text, or the commit
    // that introduced the key-based i18n rewrite for what each was rekeyed from.
    const required = [
      'welcome_prompt',
      'welcome_reply',
      'ai_chat_greeting',
      'expiring_soon',
      'pays_back_fast_ex_short',
      'popular',
      'only_one_more_lender_needed',
      'large_groups_evenly_men_women',
      'countries_i_dont_have',
      'balance_partner_risk',
      'young_parent',
    ]
    for (const key of required) {
      expect(key in en, `missing from en.ts: ${key}`).toBe(true)
      for (const locale of locales) {
        expect(hasTranslation(locale, key), `${locale}: ${key}`).toBe(true)
      }
    }
  })
})
