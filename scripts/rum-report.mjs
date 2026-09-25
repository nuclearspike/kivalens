#!/usr/bin/env node
/**
 * rum-report — what real visitors experienced, per host, from the collector's D1
 * (cloudflare/rum). Read-only.
 *
 *   node scripts/rum-report.mjs                    last 7 days, every host
 *   node scripts/rum-report.mjs --days 30          a longer window
 *   node scripts/rum-report.mjs --from 2026-10-01 --to 2026-10-31
 *   node scripts/rum-report.mjs --local            the local D1 (wrangler dev)
 *
 * Percentiles come from the raw rows (kept 45 days), so any window inside that is
 * exact; older days read the nightly summaries instead (--summaries).
 */
import { execFileSync } from 'node:child_process'
import { METRIC_LABELS } from './rum-metrics.mjs'

const args = process.argv.slice(2)
const flag = (name) => args.includes(`--${name}`)
const value = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}
const dayOf = (ms) => new Date(ms).toISOString().slice(0, 10)
const days = Number(value('days', 7))
const to = value('to', dayOf(Date.now()))
const from = value('from', dayOf(Date.parse(`${to}T00:00:00Z`) - (days - 1) * 86_400_000))
if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
  console.error('Dates are YYYY-MM-DD.')
  process.exit(1)
}

function query(sql) {
  const out = execFileSync(
    'npx',
    ['wrangler', 'd1', 'execute', 'kivalens-rum', flag('local') ? '--local' : '--remote', '-c', 'cloudflare/rum/wrangler.jsonc', '--json', '--command', sql],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] },
  )
  return JSON.parse(out)[0].results
}

const range = `day BETWEEN '${from}' AND '${to}'`
console.log(`KivaLens real-user report, ${from} to ${to} (${flag('local') ? 'local' : 'production'} collector)\n`)

if (flag('summaries')) {
  const rows = query(`SELECT host, metric, SUM(n) AS n, ROUND(AVG(p50)) AS p50, ROUND(AVG(p75)) AS p75, ROUND(AVG(p95)) AS p95
    FROM daily WHERE ${range} AND route = '*' GROUP BY host, metric ORDER BY host, metric`)
  console.table(rows)
  console.log('Summaries: n is summed; percentiles are the average of the daily values.')
  process.exit(0)
}

const traffic = query(`SELECT host, COUNT(*) AS views, COUNT(DISTINCT day) AS days,
    COALESCE(SUM(source = 'kl'), 0) AS from_server, COALESCE(SUM(source = 'kiva'), 0) AS from_kiva, COALESCE(SUM(device = 'mobile'), 0) AS mobile
  FROM views WHERE ${range} GROUP BY host ORDER BY host`)
console.log('Traffic')
console.table(traffic)

const metrics = Object.keys(METRIC_LABELS)
const rows = []
for (const metric of metrics) {
  for (const r of query(`SELECT host, n,
      MIN(CASE WHEN rn >= 0.50 * n THEN x END) AS p50,
      MIN(CASE WHEN rn >= 0.75 * n THEN x END) AS p75,
      MIN(CASE WHEN rn >= 0.95 * n THEN x END) AS p95
    FROM (SELECT host, ${metric} AS x,
            ROW_NUMBER() OVER (PARTITION BY host ORDER BY ${metric}) AS rn,
            COUNT(*) OVER (PARTITION BY host) AS n
          FROM views WHERE ${range} AND ${metric} IS NOT NULL)
    GROUP BY host`)) {
    rows.push({ metric: METRIC_LABELS[metric], host: r.host, n: r.n, p50: r.p50, p75: r.p75, p95: r.p95 })
  }
}
console.log('\nTimings (ms; CLS is unitless), every page')
console.table(rows)

const byRoute = query(`SELECT host, route, COUNT(*) AS views FROM views WHERE ${range} GROUP BY host, route ORDER BY host, views DESC`)
console.log('\nViews by page')
console.table(byRoute)

const errors = query(`SELECT host, message, SUM(count) AS times, COUNT(DISTINCT day) AS days, MAX(route) AS route
  FROM errors WHERE ${range} GROUP BY host, fingerprint ORDER BY times DESC LIMIT 25`)
console.log('\nBrowser errors (top 25)')
if (errors.length) console.table(errors.map((e) => ({ ...e, message: String(e.message).slice(0, 90) })))
else console.log('None reported.')
