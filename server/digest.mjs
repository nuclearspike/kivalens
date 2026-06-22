/**
 * digest.mjs — build + send the daily "Ask KivaLens" interaction digest,
 * grouped by user (clientId, labelled with lenderId when known), chronological.
 */
import { getDayLogs, claimDigest, clearLogsThrough } from './aiUsage.mjs'
import { sendEmail, emailConfigured } from './email.mjs'

const TO = process.env.DIGEST_TO || 'liquidmonkey@gmail.com'
// Display all digest times in Mountain Time (auto MST/MDT via the IANA zone).
const DIGEST_TZ = process.env.DIGEST_TZ || 'America/Denver'

function fmtTime(at) {
  const d = new Date(at)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('en-US', {
    timeZone: DIGEST_TZ,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  })
}

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

export function buildDigestHtml(day, logs) {
  const groups = new Map()
  for (const e of logs) {
    const key = e.clientId || e.lenderId || 'anonymous'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(e)
  }
  let totalCost = 0
  for (const e of logs) totalCost += Number(e.costUsd) || 0

  let html =
    `<div style="font-family:system-ui,Arial,sans-serif;max-width:760px">` +
    `<h2 style="color:#2C8C5E">Ask KivaLens — ${esc(day)}</h2>` +
    `<p>${logs.length} interactions · ${groups.size} users · est. cost $${totalCost.toFixed(4)}</p>`

  // Oldest-active user first; turns within a user chronological.
  const ordered = [...groups.entries()].sort(
    (a, b) =>
      Math.min(...a[1].map((x) => Date.parse(x.at) || Infinity)) -
      Math.min(...b[1].map((x) => Date.parse(x.at) || Infinity)),
  )
  for (const [key, items] of ordered) {
    items.sort((a, b) => String(a.at || '').localeCompare(String(b.at || '')))
    const lender = items.find((i) => i.lenderId)?.lenderId
    html +=
      `<h3 style="margin-top:24px;border-bottom:1px solid #ddd;padding-bottom:4px">` +
      `User ${esc(key)}${lender ? ` (lender ${esc(lender)})` : ''} — ${items.length} turn(s)</h3>`
    for (const it of items) {
      const time = fmtTime(it.at)
      const tools = (it.tools || []).map((t) => t.name).join(', ')
      html +=
        `<div style="margin:0 0 12px;padding:8px 10px;border-left:3px solid #2C8C5E;background:#f7faf8">` +
        `<div style="color:#888;font-size:12px">${esc(time)}${it.page ? ` · ${esc(it.page)}` : ''}${tools ? ` · tools: ${esc(tools)}` : ''}</div>` +
        `<div style="margin-top:4px"><b>User:</b> ${esc(it.userMessage)}</div>` +
        `<div style="margin-top:2px"><b>KivaLens:</b> ${esc(it.response)}</div>` +
        `</div>`
    }
  }
  html += `</div>`
  return html
}

// Manual send (admin test): skips the once-a-day claim, returns the send result.
export async function sendDigestNow(day, log = console.log) {
  if (!emailConfigured()) return { ok: false, error: 'RESEND_API_KEY not set' }
  const logs = await getDayLogs(day)
  const html = buildDigestHtml(day, logs)
  const r = await sendEmail({ to: TO, subject: `Ask KivaLens digest (test) — ${day} (${logs.length} chats)`, html })
  log(`[digest] manual ${day}: ${r.ok ? `sent to ${TO}` : `failed — ${r.error}`}`)
  return { ...r, day, to: TO, interactions: logs.length }
}

export async function sendDailyDigest(day, log = console.log) {
  if (!emailConfigured()) return
  // Claim first so only one dyno sends, exactly once per day.
  if (!(await claimDigest(day))) return
  const logs = await getDayLogs(day)
  if (!logs.length) {
    log(`[digest] ${day}: no interactions, nothing to send`)
    return
  }
  const html = buildDigestHtml(day, logs)
  const r = await sendEmail({ to: TO, subject: `Ask KivaLens digest — ${day} (${logs.length} chats)`, html })
  log(`[digest] ${day}: ${r.ok ? `sent to ${TO}` : `failed — ${r.error}`}`)
  // Redis is tight: once the day is emailed, wipe the chats it covered.
  if (r.ok) {
    await clearLogsThrough(day)
    log(`[digest] ${day}: wiped logged chats through ${day}`)
  }
}
