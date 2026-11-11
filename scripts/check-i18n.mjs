#!/usr/bin/env node
// Parity checker for KivaLens's key-based i18n catalogs (src/i18n/locales/*.ts).
//
// Every user-visible string is keyed by a short symbolic key (never by its
// English text — see src/i18n/index.tsx and the locale files themselves).
// This script is the guard that keeps that true as the app changes:
//
//   1. Every key actually referenced from source (via t('literal') calls, or
//      via a *_OPTIONS/_SLIDERS/_HELP array/dynamic-const feeding t(variable))
//      must exist in en.ts — catches a new string shipped without a catalog
//      entry.
//   2. Every key in en.ts must exist in all five other locale files, with a
//      non-empty value — catches a new key added without real translations.
//   3. No locale file may carry a key en.ts doesn't have — catches an orphan
//      left behind after a key was renamed or removed.
//
// This tool does NOT machine-translate. A new key needs real translations
// added by hand (or by Claude) in the same change that introduces it, per
// house i18n policy — machine translation drifts quality over time (the prior
// generator's unofficial Google Translate endpoint mistranslated at least one
// term — "Turkey" (the country) as "pavo" (the bird) — which is exactly the
// failure mode a hand/AI-authored translation doesn't have).
//
// Run via `npm run i18n:check`. Exits non-zero on any violation.

import ts from 'typescript'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const LOCALES = ['en', 'es', 'fr', 'de', 'it', 'nl', 'pt-BR', 'ja', 'zh-Hans']
const SECONDARY = LOCALES.filter((l) => l !== 'en')

// Suffix marking a variable declaration as containing user-facing label/help
// text referenced dynamically (e.g. t(TIPS_HELP[i]), t(option.label)) rather
// than via a literal t('...') call — mirrors the shape catalogCoverage.test.ts
// used to rely on.
const DYNAMIC_SUFFIX = /(?:_OPTIONS|_SLIDERS|_HELP)$/

function sourceFiles(root) {
  return fs.readdirSync(root).flatMap((name) => {
    const p = path.join(root, name)
    if (name === 'node_modules' || name === 'dist') return []
    return fs.statSync(p).isDirectory()
      ? sourceFiles(p)
      : /\.(ts|tsx)$/.test(name) && !/\.(test|spec)\.tsx?$/.test(name) ? [p] : []
  })
}

function collectStringLiterals(node, keys) {
  const isCanonicalValue =
    (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
    ts.isPropertyAssignment(node.parent) &&
    ((ts.isIdentifier(node.parent.name) || ts.isStringLiteral(node.parent.name)) && node.parent.name.text === 'value')
  if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && node.text.trim() && !isCanonicalValue) {
    keys.add(node.text)
  }
  ts.forEachChild(node, (child) => collectStringLiterals(child, keys))
}

// Bare-identifier t(NAME) call sites: NAME might be (a) a same-file `const
// NAME = '...'` whose value should already be a catalog key — traced and
// verified below, so a declaration some rewrite missed is caught rather than
// relying on a hand-maintained allowlist (that's exactly how the first version
// of this migration silently left AskKivaLens.tsx's `GREETING` unrewritten:
// it wasn't on the allowlist), or (b) genuinely dynamic runtime data (a loop
// variable, a destructured prop, a saved-search name) with no fixed literal to
// check — left alone, since there's nothing static to verify.
// Recursively pulls every string-literal branch out of an arbitrary expression
// tree (ConditionalExpression, `??`/`||` BinaryExpression, parens, nested
// combinations of these) — the shapes actually used in t(...) call arguments
// throughout this codebase for a two-way (or chained) translated choice, e.g.
// `t(cond ? 'a' : 'b')` or `t(value ?? 'fallback')`. Anything else (a property
// access, a function call, a template literal with an expression) bottoms out
// with no literals found, which is correct — those are genuinely dynamic data,
// not a translatable literal this checker can verify.
function literalBranches(node) {
  if (ts.isParenthesizedExpression(node)) return literalBranches(node.expression)
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return [node]
  if (ts.isConditionalExpression(node)) return [...literalBranches(node.whenTrue), ...literalBranches(node.whenFalse)]
  if (ts.isBinaryExpression(node) && [ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.BarBarToken].includes(node.operatorToken.kind)) {
    return [...literalBranches(node.left), ...literalBranches(node.right)]
  }
  return []
}

function findLocalStringConst(sourceFile, name) {
  let found
  const visit = (node) => {
    if (
      !found &&
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === name &&
      node.initializer &&
      (ts.isStringLiteral(node.initializer) || ts.isNoSubstitutionTemplateLiteral(node.initializer))
    ) {
      found = node.initializer
    }
    if (!found) ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return found
}

function referencedKeys(root, enKeys) {
  const keys = new Set()
  const locations = new Map() // key -> first file:line seen, for error messages
  const staleConstRefs = [] // {file, line, identifier, text} — t(NAME) where NAME still holds raw text
  for (const file of sourceFiles(root)) {
    const rel = path.relative(ROOT, file)
    if (rel.startsWith(path.join('src', 'i18n') + path.sep)) continue
    const text = fs.readFileSync(file, 'utf8')
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
    const record = (key, node) => {
      keys.add(key)
      if (!locations.has(key)) {
        const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf))
        locations.set(key, `${rel}:${line + 1}`)
      }
    }
    const visit = (node) => {
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
          record(arg.text, arg)
        } else if (ts.isIdentifier(arg)) {
          const decl = findLocalStringConst(sf, arg.text)
          if (decl) {
            if (enKeys.has(decl.text)) {
              record(decl.text, decl)
            } else {
              const { line } = sf.getLineAndCharacterOfPosition(arg.getStart(sf))
              staleConstRefs.push({ file: rel, line: line + 1, identifier: arg.text, text: decl.text })
            }
          }
          // No local literal declaration found — genuinely dynamic (prop, loop
          // variable, destructured value); nothing statically checkable.
        } else {
          // t(cond ? 'a' : 'b'), t(value ?? 'fallback'), etc. — every literal
          // branch must already be a valid key (this is how AskKivaLens's
          // Search.tsx's t(showCriteria ? 'Hide Criteria' : 'Show Criteria')
          // shipped unrewritten through the first version of this migration:
          // the direct-literal scan only matched a bare t('...') call).
          for (const lit of literalBranches(arg)) {
            if (enKeys.has(lit.text)) {
              record(lit.text, lit)
            } else {
              const { line } = sf.getLineAndCharacterOfPosition(lit.getStart(sf))
              staleConstRefs.push({ file: rel, line: line + 1, identifier: `(literal in t() expression)`, text: lit.text })
            }
          }
        }
      }
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && DYNAMIC_SUFFIX.test(node.name.text)) {
        const found = new Set()
        collectStringLiterals(node.initializer, found)
        for (const key of found) record(key, node.initializer)
      }
      ts.forEachChild(node, visit)
    }
    visit(sf)
  }
  return { keys, locations, staleConstRefs }
}

// ---------------------------------------------------------------------------

function loadCatalogKeys(locale) {
  const file = path.join(ROOT, `src/i18n/locales/${locale}.ts`)
  const text = fs.readFileSync(file, 'utf8')
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const catalog = {}
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'catalog' && node.initializer && ts.isObjectLiteralExpression(node.initializer)) {
      for (const prop of node.initializer.properties) {
        if (!ts.isPropertyAssignment(prop)) continue
        const key = ts.isStringLiteral(prop.name) || ts.isIdentifier(prop.name) ? prop.name.text : null
        if (key == null) continue
        catalog[key] = ts.isStringLiteral(prop.initializer) || ts.isNoSubstitutionTemplateLiteral(prop.initializer)
          ? prop.initializer.text
          : undefined
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return catalog
}

const catalogs = Object.fromEntries(LOCALES.map((l) => [l, loadCatalogKeys(l)]))
const enKeys = new Set(Object.keys(catalogs.en))
const { keys: used, locations, staleConstRefs } = referencedKeys(path.join(ROOT, 'src'), enKeys)

let failed = false
const fail = (msg) => { console.error(`✘ ${msg}`); failed = true }

// 1. Every referenced key must exist in en.ts.
const missingFromEn = [...used].filter((k) => !enKeys.has(k))
if (missingFromEn.length) {
  fail(`${missingFromEn.length} key(s) referenced from source but missing from src/i18n/locales/en.ts:`)
  for (const k of missingFromEn) console.error(`    ${k}  (first seen at ${locations.get(k)})`)
}

// 1b. t(IDENTIFIER) where IDENTIFIER resolves to a same-file string constant
//    that ISN'T a valid key — almost always a missed rewrite (a t(CONST) call
//    site whose CONST still holds raw English/other text instead of a key).
if (staleConstRefs.length) {
  fail(`${staleConstRefs.length} t(IDENTIFIER) call site(s) reference a constant that isn't a catalog key:`)
  for (const s of staleConstRefs) console.error(`    ${s.file}:${s.line}  t(${s.identifier}) — ${s.identifier} = ${JSON.stringify(s.text.slice(0, 60))}`)
}

// 2a. English is one catalog among nine: an empty value there shows nothing too.
const emptyInEn = [...enKeys].filter((k) => !catalogs.en[k] || !catalogs.en[k].trim())
if (emptyInEn.length) {
  fail(`en.ts has ${emptyInEn.length} empty value(s):`)
  for (const k of emptyInEn.slice(0, 20)) console.error(`    ${k}`)
}

// 2. Every en.ts key must exist, non-empty, in every other locale.
for (const locale of SECONDARY) {
  const cat = catalogs[locale]
  const missing = [...enKeys].filter((k) => !(k in cat) || !cat[k] || !cat[k].trim())
  if (missing.length) {
    fail(`${locale}.ts is missing ${missing.length} translation(s) (present in en.ts):`)
    for (const k of missing.slice(0, 20)) console.error(`    ${k}`)
    if (missing.length > 20) console.error(`    ...and ${missing.length - 20} more`)
  }
}

// 3. No locale may carry keys en.ts doesn't have (orphans from a rename/removal).
for (const locale of LOCALES) {
  const extra = Object.keys(catalogs[locale]).filter((k) => !enKeys.has(k))
  if (extra.length) {
    fail(`${locale}.ts has ${extra.length} orphaned key(s) not present in en.ts:`)
    for (const k of extra.slice(0, 20)) console.error(`    ${k}`)
  }
}

// 3b. Every {placeholder} in the English text must appear in each translation,
//     and none invented — a dropped placeholder renders a literal "{count}" or
//     silently loses the value it carried.
const placeholders = (s) => new Set([...String(s ?? '').matchAll(/\{(\w+)\}/g)].map((m) => m[1]))
for (const locale of SECONDARY) {
  const cat = catalogs[locale]
  const mismatched = []
  for (const k of enKeys) {
    const want = placeholders(catalogs.en[k])
    const got = placeholders(cat[k])
    if (want.size !== got.size || [...want].some((p) => !got.has(p))) {
      mismatched.push(`${k}: en has {${[...want].join(', ')}}, ${locale} has {${[...got].join(', ')}}`)
    }
  }
  if (mismatched.length) {
    fail(`${locale}.ts has ${mismatched.length} key(s) whose {placeholders} don't match en.ts:`)
    for (const m of mismatched.slice(0, 20)) console.error(`    ${m}`)
    if (mismatched.length > 20) console.error(`    ...and ${mismatched.length - 20} more`)
  }
}

// 4. Every key actually in en.ts should still be referenced somewhere (a key
//    nothing calls is dead weight — warn only, since a key can legitimately be
//    reached only via a runtime string this static scan can't see).
const unreferenced = [...enKeys].filter((k) => !used.has(k))
if (unreferenced.length) {
  console.warn(`⚠ ${unreferenced.length} key(s) in en.ts have no statically-discoverable reference (may be dead, or reached dynamically in a way this scanner can't see):`)
  for (const k of unreferenced.slice(0, 10)) console.warn(`    ${k}`)
  if (unreferenced.length > 10) console.warn(`    ...and ${unreferenced.length - 10} more`)
}

if (failed) {
  console.error(`\ni18n check FAILED. Add missing keys/translations directly to src/i18n/locales/*.ts.`)
  process.exit(1)
}
console.log(`✓ i18n check passed — ${enKeys.size} keys, ${LOCALES.length} locales, fully in parity.`)
