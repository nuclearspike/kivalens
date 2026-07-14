import { readFile } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'
import dotenv from 'dotenv'
import OpenAI from 'openai'
import { buildResponsesRequest, buildSystemPrompt } from '../server/aiChat.mjs'

dotenv.config({ path: '.env.local' })
dotenv.config()

const dryRun = process.argv.includes('--dry-run')
const cases = JSON.parse(await readFile(new URL('../evals/ask-kivalens.json', import.meta.url), 'utf8'))

function validateCase(test) {
  if (!test?.id || !test?.input) throw new Error('Every eval needs id and input')
  for (const field of ['expectedTools', 'argumentIncludes', 'forbiddenText', 'requiredText']) {
    if (test[field] != null && !Array.isArray(test[field])) throw new Error(`${test.id}: ${field} must be an array`)
  }
}

for (const test of cases) validateCase(test)
if (dryRun) {
  console.log(`[ai-eval] ${cases.length} cases valid (dry run; no API calls)`)
  process.exit(0)
}

if (!process.env.OPENAI_API_KEY) {
  console.error('[ai-eval] OPENAI_API_KEY is required (or run npm run eval:ai:dry)')
  process.exit(2)
}

const sectors = [
  'Agriculture', 'Arts', 'Clean Energy', 'Clothing', 'Construction', 'Education',
  'Entertainment', 'Food', 'Health', 'Housing', 'Manufacturing', 'Personal Use',
  'Retail', 'Reuse & Recycle', 'Sanitation & Hygiene', 'Services', 'Transportation',
  'Water', 'Wholesale',
]
const state = {
  batch: 1,
  ready: true,
  allLoans: [],
  activePartners: [],
  partners: [],
  atheistListProcessed: false,
  optionsGz: gzipSync(Buffer.from(JSON.stringify({ sectors, activities: [], themes: [], tags: [] }))),
}
const instructions = buildSystemPrompt(state, null, { loan: {}, partner: {}, portfolio: {} }, {
  shown: 0,
  total: 0,
  page: 'the Search page',
  basket: [],
  savedSearches: [],
})
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
let passed = 0

for (const test of cases) {
  const request = buildResponsesRequest({
    instructions,
    input: [{ role: 'user', content: test.input }],
    clientId: `eval-${test.id}`,
  })
  const response = await client.responses.create({
    ...request,
    stream: false,
    max_output_tokens: 500,
  })
  const calls = (response.output || []).filter((item) => item.type === 'function_call')
  const toolNames = calls.map((call) => call.name)
  const args = calls.map((call) => call.arguments || '').join('\n')
  const text = response.output_text || ''
  const failures = []

  for (const expected of test.expectedTools || []) {
    if (!toolNames.includes(expected)) failures.push(`missing tool ${expected}; got ${toolNames.join(', ') || '(none)'}`)
  }
  for (const fragment of test.argumentIncludes || []) {
    if (!args.toLowerCase().includes(String(fragment).toLowerCase())) failures.push(`tool args missing ${fragment}`)
  }
  for (const pattern of test.forbiddenText || []) {
    if (new RegExp(pattern, 'i').test(text)) failures.push(`forbidden text matched /${pattern}/i`)
  }
  for (const pattern of test.requiredText || []) {
    if (!new RegExp(pattern, 'i').test(text)) failures.push(`required text missing /${pattern}/i`)
  }

  if (failures.length) {
    console.error(`✗ ${test.id}: ${failures.join('; ')}`)
  } else {
    passed++
    console.log(`✓ ${test.id}`)
  }
}

console.log(`[ai-eval] ${passed}/${cases.length} passed`)
if (passed !== cases.length) process.exit(1)
