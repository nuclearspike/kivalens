#!/usr/bin/env node
// Checks the live site's features the way a page uses them, including every one that depends on Kiva or
// Google answering. Run it after every deploy (scripts/deploy.mjs does) and whenever something looks off.
//
// On 2026-10-14 a release broke portfolio balancing and the Teams graphs for 29 hours: its tests passed
// against a mock of Kiva, and nothing checked the live site afterwards. Each check below is one of those
// features, asked of the real site, which asks the real Kiva.
//
//   node scripts/smoke-live.mjs [--url https://www.kivalens.org] [--wait <seconds>] [--json <file>]
//
// --wait keeps retrying a failing check for that long: right after a release the server starts from its
// cache, and RSS waits for its first own batch (about four minutes). Nothing here is paid: GETs, and one
// loan-detail POST to this site's own /graphql. Exit 0 when every check passes, 1 when any fails.
import fs from 'node:fs'

const opt = (name, fallback) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : fallback }
const BASE = opt('--url', 'https://www.kivalens.org').replace(/\/$/, '')
const WAIT_MS = Number(opt('--wait', '0')) * 1000
const JSON_OUT = opt('--json', null)
// The maintainer's public lender page: thousands of loans, so every lifetime slice has figures.
const LENDER = 'nuclearspike'
// A long-standing Kiva team with years of history.
const TEAM = '1'
const SHEET = '1KP7ULBAyavnohP4h8n2J2yaXNpIRnyIXdjJj_AwtwK0'

class CheckFailed extends Error {}
const must = (ok, what) => { if (!ok) throw new CheckFailed(what) }

async function get(path, init = {}) {
  const res = await fetch(BASE + path, { ...init, redirect: 'manual', signal: AbortSignal.timeout(30_000) })
  const text = await res.text()
  return { status: res.status, type: (res.headers.get('content-type') || '').toLowerCase(), headers: res.headers, text }
}
function json(r, what) {
  try {
    return JSON.parse(r.text)
  } catch {
    throw new CheckFailed(`${what}: not JSON (${r.status} ${r.type}): ${r.text.slice(0, 80)}`)
  }
}

const state = {}
const CHECKS = [
  ['The page and its script', async () => {
    const r = await get('/')
    must(r.status === 200 && r.type.startsWith('text/html'), `/ answered ${r.status} ${r.type}`)
    const entry = /\/assets\/index-[\w-]+\.js/.exec(r.text)?.[0]
    must(entry, 'no entry script in the page')
    const js = await get(entry)
    must(js.status === 200 && js.type.includes('javascript'), `${entry} answered ${js.status} ${js.type}`)
    state.entry = entry
    return entry
  }],
  ['The Lite app privacy notice', async () => {
    for (const language of ['en', 'de', 'fr', 'es', 'pt-BR', 'ja', 'zh-Hans']) {
      const r = await get(`/${language}/lite-privacy`)
      must(r.status === 200 && r.type.startsWith('text/html'), `/${language}/lite-privacy answered ${r.status} ${r.type}`)
      must(r.headers.get('x-robots-tag') === 'noindex', `/${language}/lite-privacy is missing noindex`)
      must(r.text.includes(`<html lang="${language}">`) && r.text.includes('KivaLens Lite'), `/${language}/lite-privacy returned the wrong page`)
      must(!r.text.includes('/search') && !r.text.includes('/assets/index-'), `/${language}/lite-privacy fell back to the loan app`)
    }
    return 'seven standalone, noindex notices'
  }],
  ['The loan catalog', async () => {
    const start = json(await get('/api/start'), '/api/start')
    must(start.batch > 0 && start.pages > 0, `/api/start says batch ${start.batch}, ${start.pages} pages`)
    const page = await get(`/api/loans/${start.batch}/1`)
    must(page.status === 200, `the first page answered ${page.status}`)
    const loans = json(page, 'the first page')
    must(Array.isArray(loans) && loans.length >= 100, `the first page holds ${Array.isArray(loans) ? loans.length : 'no'} loans`)
    // A loan without terms came without its details, and makes an older page give up the whole batch.
    const bare = loans.filter((l) => !l || !l.terms).length
    must(bare === 0, `${bare} loans on the first page have no terms`)
    const words = json(await get(`/api/loans/${start.batch}/keywords/1`), 'the first keywords page')
    must(Array.isArray(words) && words.length > 0, 'the first keywords page is empty')
    state.loanId = loans[0].id
    const ageMin = start.builtAt ? Math.round((Date.now() - start.builtAt) / 60_000) : null
    return `batch ${start.batch}, ${start.pages} pages, ${loans.length} loans on the first${ageMin !== null ? `, built ${ageMin} min ago` : ''}`
  }],
  ['Partners', async () => {
    const partners = json(await get('/api/partners'), '/api/partners')
    must(Array.isArray(partners) && partners.length >= 100 && partners.every((p) => p.id && p.name), `${Array.isArray(partners) ? partners.length : 'no'} partners`)
    return `${partners.length} partners`
  }],
  ['A loan’s story and schedule', async () => {
    must(state.loanId, 'no loan from the catalog to ask about')
    const r = await get('/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json;charset=UTF-8', Accept: 'application/json,*/*' },
      body: JSON.stringify({ query: `{loans(ids:[${state.loanId}]){id status description{texts{en}} kl_repayments:repayments {date amount}}}` }),
    })
    must(r.status === 200, `/graphql answered ${r.status}`)
    const loan = json(r, '/graphql').data?.loans?.[0]
    must(loan && loan.id === state.loanId, 'the loan did not come back')
    must(loan.description?.texts?.en, 'the loan came back without its story')
    return `loan ${loan.id}: ${loan.status}, ${loan.kl_repayments?.length ?? 0} repayments`
  }],
  ['Portfolio balancing (Kiva, through the proxy)', async () => {
    const r = await get(`/proxy/kiva/ajax/getSuperGraphData?sliceBy=country&include=all&measure=count&subject_id=${LENDER}&type=lender&granularity=cumulative`)
    must(r.status === 200 && r.type.startsWith('application/json'), `answered ${r.status} ${r.type}: ${r.text.slice(0, 60)}`)
    const data = json(r, 'the portfolio figures')
    must(Array.isArray(data.data) && data.data.length > 0, `no figures: ${r.text.slice(0, 80)}`)
    return `${data.data.length} countries`
  }],
  ['Team graphs (Kiva, through the proxy)', async () => {
    const r = await get(`/proxy/kiva/ajax/getGraphData?graphName=team_loan_count&id=${TEAM}`)
    must(r.status === 200 && r.type.startsWith('application/json'), `answered ${r.status} ${r.type}: ${r.text.slice(0, 60)}`)
    const data = json(r, 'the team graph')
    must(Array.isArray(data.graphData) && data.graphData.length > 0, `no points: ${r.text.slice(0, 80)}`)
    return `${data.graphData.length} points`
  }],
  ['The research sheet (Google, through the proxy)', async () => {
    const r = await get(`/proxy/gdocs/spreadsheets/d/${SHEET}/export?gid=1&format=csv`)
    must(r.status === 200 && r.type.startsWith('text/csv') && r.text.startsWith('ID,'), `answered ${r.status} ${r.type}: ${r.text.slice(0, 40)}`)
    return `${r.text.split('\n').length - 1} rows`
  }],
  ['An RSS feed', async () => {
    const criteria = encodeURIComponent(JSON.stringify({ feed: { link_to: 'kiva' }, loan: { repaid_in_max: 6 } }))
    const r = await get(`/rss/${criteria}`)
    must(r.status === 200 && r.type.startsWith('application/rss+xml'), `answered ${r.status} ${r.type}`)
    const items = (r.text.match(/<item>/g) || []).length
    must(items > 0, 'the feed has no items')
    return `${items} items`
  }],
  ['Ask KivaLens is switched on', async () => {
    const r = json(await get('/api/ai-enabled'), '/api/ai-enabled')
    must(typeof r.enabled === 'boolean', 'no answer')
    return r.enabled ? 'on' : 'off'
  }],
]

const results = []
for (const [name, run] of CHECKS) {
  const t0 = Date.now()
  let tries = 0
  for (;;) {
    tries++
    try {
      const detail = await run()
      results.push({ name, ok: true, detail, ms: Date.now() - t0, tries })
      break
    } catch (e) {
      const cause = e?.cause?.code ?? e?.cause?.message
      const detail = e instanceof CheckFailed ? e.message : `${e?.name ?? 'Error'}: ${e?.message ?? e}${cause ? ` (${cause})` : ''}`
      if (Date.now() - t0 + 15_000 > WAIT_MS) {
        results.push({ name, ok: false, detail, ms: Date.now() - t0, tries })
        break
      }
      await new Promise((r) => setTimeout(r, 15_000))
    }
  }
  const last = results.at(-1)
  console.log(`${last.ok ? 'PASS' : 'FAIL'}  ${name} — ${last.detail} (${(last.ms / 1000).toFixed(1)} s${last.tries > 1 ? `, ${last.tries} tries` : ''})`)
}
const failed = results.filter((r) => !r.ok)
console.log(failed.length ? `\n${failed.length} of ${results.length} checks FAILED on ${BASE}` : `\nall ${results.length} checks passed on ${BASE}`)
if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify({ at: new Date().toISOString(), base: BASE, entry: state.entry ?? null, results }, null, 2) + '\n')
process.exit(failed.length ? 1 : 0)
