import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const srcRoot = join(projectRoot, 'src')
const outputPath = join(srcRoot, 'i18n', 'generatedCatalog.ts')
const outputDirectory = join(srcRoot, 'i18n', 'generated')
const locales = ['es', 'fr', 'de', 'it', 'nl']

function files(root) {
  return readdirSync(root).flatMap((name) => {
    const path = join(root, name)
    if (name === 'node_modules' || name === 'dist') return []
    return statSync(path).isDirectory()
      ? files(path)
      : /\.(ts|tsx)$/.test(name) && !name.endsWith('.test.ts') ? [path] : []
  })
}

function parse(path) {
  const source = readFileSync(path, 'utf8')
  return ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, path.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
}

function collectStringLiterals(node, keys) {
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

function staticTranslationKeys() {
  const keys = new Set()
  for (const path of files(srcRoot)) {
    const file = parse(path)
    const visit = (node) => {
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
  }
  return keys
}

const unwrap = (node) =>
  ts.isAsExpression(node) || ts.isSatisfiesExpression(node) ? unwrap(node.expression) : node

function existingBaseKeys() {
  const file = parse(join(srcRoot, 'i18n', 'index.tsx'))
  const keys = new Set()
  const visit = (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === 'catalogs' &&
      node.initializer
    ) {
      const root = unwrap(node.initializer)
      if (!ts.isObjectLiteralExpression(root)) return
      const firstLocale = root.properties.find((property) =>
        ts.isPropertyAssignment(property) &&
        ((ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) && property.name.text === 'es'),
      )
      if (!firstLocale || !ts.isPropertyAssignment(firstLocale)) return
      const catalog = unwrap(firstLocale.initializer)
      if (!ts.isObjectLiteralExpression(catalog)) return
      for (const property of catalog.properties) {
        if (
          ts.isPropertyAssignment(property) &&
          (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))
        ) keys.add(property.name.text)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  return keys
}

function existingExtraKeys() {
  const path = join(srcRoot, 'i18n', 'extraCatalog.ts')
  const file = parse(path)
  const keys = new Set()
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'EXTRA_TRANSLATION_ROWS' && node.initializer) {
      const rows = unwrap(node.initializer)
      if (ts.isArrayLiteralExpression(rows)) {
        for (const rowNode of rows.elements) {
          const row = unwrap(rowNode)
          if (!ts.isArrayLiteralExpression(row) || row.elements.length === 0) continue
          const key = row.elements[0]
          if (ts.isStringLiteral(key) || ts.isNoSubstitutionTemplateLiteral(key)) keys.add(key.text)
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  return keys
}

function protectPlaceholders(value) {
  const placeholders = []
  const text = value.replace(/\{\w+\}/g, (match) => {
    const token = `__KLS_PH_${placeholders.length}__`
    placeholders.push([token, match])
    return token
  })
  return { text, placeholders }
}

async function translateBatch(locale, entries) {
  const protectedEntries = entries.map(protectPlaceholders)
  const joined = protectedEntries.map((entry) => entry.text).join('\n[[[KLS_SPLIT]]]\n')
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${locale}&dt=t&q=${encodeURIComponent(joined)}`
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Translation request failed (${locale}): ${response.status}`)
  const data = await response.json()
  const translated = data[0].map((part) => part[0]).join('')
  const pieces = translated.split('[[[KLS_SPLIT]]]').map((piece) => piece.trim())
  if (pieces.length !== entries.length) {
    throw new Error(`Translation split mismatch (${locale}): expected ${entries.length}, got ${pieces.length}`)
  }
  return pieces.map((piece, index) => {
    let restored = piece
    for (const [token, placeholder] of protectedEntries[index].placeholders) {
      restored = restored.replaceAll(token, placeholder)
    }
    return restored
  })
}

function batches(entries, maxCharacters = 3500) {
  const result = []
  let current = []
  let size = 0
  for (const entry of entries) {
    if (current.length && size + entry.length > maxCharacters) {
      result.push(current)
      current = []
      size = 0
    }
    current.push(entry)
    size += entry.length + 24
  }
  if (current.length) result.push(current)
  return result
}

async function main() {
  const existing = new Set([...existingBaseKeys(), ...existingExtraKeys()])
  const keys = [...staticTranslationKeys()].filter((key) => !existing.has(key)).sort((a, b) => a.localeCompare(b))
  const translated = Object.fromEntries(locales.map((locale) => [locale, new Map()]))
  const jobs = locales.flatMap((locale) => batches(keys).map((batch) => ({ locale, batch })))
  let cursor = 0
  async function worker() {
    while (cursor < jobs.length) {
      const job = jobs[cursor++]
      const values = await translateBatch(job.locale, job.batch)
      job.batch.forEach((key, index) => translated[job.locale].set(key, values[index]))
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker))

  mkdirSync(outputDirectory, { recursive: true })
  for (const locale of locales) {
    const localeLines = [
      '// Generated by scripts/generate-i18n.mjs. Runtime translation is never used.',
      'const catalog: Record<string, string> = {',
      ...keys.map((key) => `  ${JSON.stringify(key)}: ${JSON.stringify(translated[locale].get(key))},`),
      '}',
      '',
      'export default catalog',
      '',
    ]
    writeFileSync(join(outputDirectory, `${locale}.ts`), localeLines.join('\n'))
  }

  const lines = [
    "import type { SecondaryLocale } from './extraCatalog'",
    '',
    '// Locale catalogs are split into on-demand chunks so English startup does not download every translation.',
    'export async function loadGeneratedCatalog(locale: SecondaryLocale): Promise<Record<string, string>> {',
    '  switch (locale) {',
    "    case 'es': return (await import('./generated/es')).default",
    "    case 'fr': return (await import('./generated/fr')).default",
    "    case 'de': return (await import('./generated/de')).default",
    "    case 'it': return (await import('./generated/it')).default",
    "    case 'nl': return (await import('./generated/nl')).default",
    '  }',
    '}',
    '',
  ]
  writeFileSync(outputPath, `${lines.join('\n')}\n`)
  process.stdout.write(`Generated ${keys.length} translation entries per locale in ${relative(projectRoot, outputDirectory)}\n`)
}

await main()
