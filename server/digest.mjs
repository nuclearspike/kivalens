/**
 * digest.mjs — build + send the daily "Ask KivaLens" interaction digest,
 * grouped by user (clientId, labelled with lenderId when known), chronological.
 */
import { getDayLogs, claimDigest, clearLogsThrough } from './aiUsage.mjs'
import { sendEmail, emailConfigured } from './email.mjs'

const TO = process.env.DIGEST_TO || 'contact@kivalens.org'
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

/**
 * Turns where the assistant filed a bug report. Most users have no GitHub
 * account, so the chat is the only channel they have — and a report rendered
 * like every other turn is a report that gets missed (a "my saved searches are
 * gone" report once sat inside a 103-chat digest, formatted exactly like "can
 * you make them pink"). These get hoisted above the per-user log.
 */
export function bugReports(logs) {
  return (logs || []).filter((e) => (e.tools || []).some((t) => t?.name === 'report_bug'))
}

/** Flatten {loan,partner,portfolio} into "loan.sector=Food" pairs for diffing. */
function flatCriteria(raw) {
  if (!raw) return {}
  let o = raw
  if (typeof o === 'string') { try { o = JSON.parse(o) } catch { return {} } }
  const out = {}
  for (const sec of ['loan', 'partner', 'portfolio']) {
    const g = o[sec] || {}
    for (const [k, v] of Object.entries(g)) {
      if (v === '' || v == null) continue
      out[`${sec}.${k}`] = typeof v === 'object' ? JSON.stringify(v) : String(v)
    }
  }
  return out
}

/**
 * What this turn actually did to the filter. The counts alone hide the failure
 * mode where a "refinement" silently DROPS a filter and widens the search, so
 * show removals explicitly — criteriaIn/criteriaOut were always logged, they
 * were just never rendered, which made one such report impossible to diagnose
 * after the logs were wiped.
 */
export function criteriaDiff(entry) {
  const before = flatCriteria(entry && entry.criteriaIn)
  const after = flatCriteria(entry && entry.criteriaOut)
  const added = [], changed = [], removed = []
  for (const [k, v] of Object.entries(after)) {
    if (!(k in before)) added.push(`${k}=${v}`)
    else if (before[k] !== v) changed.push(`${k}: ${before[k]} → ${v}`)
  }
  for (const k of Object.keys(before)) if (!(k in after)) removed.push(`${k}=${before[k]}`)
  return { added, changed, removed }
}

/**
 * What changed to the filter BETWEEN two turns — i.e. not by the assistant.
 * The client sends its live criteria with every turn, so a difference between
 * the previous turn's result and this turn's starting state means the user
 * edited the panel themselves (or loaded a saved search, or hit reset).
 * Without this, a hand-edit looks like the assistant silently changing the
 * search, and a count that jumps mid-conversation is unexplainable.
 */
export function manualChange(prevEntry, entry) {
  const before = flatCriteria(prevEntry && prevEntry.criteriaOut)
  const after = flatCriteria(entry && entry.criteriaIn)
  if (!Object.keys(before).length && !Object.keys(after).length) return null
  const added = [], changed = [], removed = []
  for (const [k, v] of Object.entries(after)) {
    if (!(k in before)) added.push(`${k}=${v}`)
    else if (before[k] !== v) changed.push(`${k}: ${before[k]} → ${v}`)
  }
  for (const k of Object.keys(before)) if (!(k in after)) removed.push(`${k}=${before[k]}`)
  return added.length || changed.length || removed.length ? { added, changed, removed } : null
}

function manualLine(prevEntry, entry) {
  const d = manualChange(prevEntry, entry)
  if (!d) return ''
  const bits = []
  if (d.added.length) bits.push(`+ ${esc(d.added.join(', '))}`)
  if (d.changed.length) bits.push(`~ ${esc(d.changed.join(', '))}`)
  if (d.removed.length) bits.push(`− ${esc(d.removed.join(', '))}`)
  return (
    `<div style="margin:6px 0;padding:4px 8px;border-left:3px solid #8a6d3b;background:#fcf8e3;` +
    `font-size:12px;font-family:ui-monospace,Menlo,monospace;color:#8a6d3b">` +
    `✎ user edited the filters directly · ${bits.join(' · ')}</div>`
  )
}

function criteriaLine(entry) {
  const { added, changed, removed } = criteriaDiff(entry)
  if (!added.length && !changed.length && !removed.length) return ''
  const bits = []
  if (added.length) bits.push(`<span style="color:#2C8C5E">+ ${esc(added.join(', '))}</span>`)
  if (changed.length) bits.push(`<span style="color:#8a6d3b">~ ${esc(changed.join(', '))}</span>`)
  // Removals are the ones worth noticing: they widen the search.
  if (removed.length) bits.push(`<span style="color:#c0392b">− ${esc(removed.join(', '))}</span>`)
  return `<div style="margin-top:2px;font-size:12px;font-family:ui-monospace,Menlo,monospace">${bits.join(' · ')}</div>`
}

function bugSection(reports) {
  if (!reports.length) return ''
  let html =
    `<div style="margin:16px 0;padding:12px 14px;border:2px solid #c0392b;border-radius:6px;background:#fdf3f2">` +
    `<h3 style="margin:0 0 8px;color:#c0392b">⚠️ ${reports.length} bug report(s)</h3>`
  for (const r of reports) {
    const who = r.lenderId ? `lender ${esc(r.lenderId)}` : esc(r.clientId || 'anonymous')
    // The report text lives in the tool call's arguments; fall back to the
    // user's own words so a malformed call still shows something actionable.
    const call = (r.tools || []).find((t) => t?.name === 'report_bug')
    // args is stored as a JSON STRING truncated to 300 chars, so it may not
    // parse; fall back to the user's own words rather than showing nothing.
    const a = (() => {
      const raw = call && (call.args ?? call.arguments)
      if (!raw) return {}
      if (typeof raw === 'object') return raw
      try { return JSON.parse(raw) } catch { return {} }
    })()
    const detail = [a.summary, a.actual && `actual: ${a.actual}`, a.expected && `expected: ${a.expected}`, a.where && `where: ${a.where}`]
      .filter(Boolean)
      .join(' · ')
    html +=
      `<div style="margin:0 0 8px">` +
      `<div style="color:#888;font-size:12px">${esc(fmtTime(r.at))} · ${who}</div>` +
      `<div>${esc(detail || r.userMessage)}</div>` +
      `</div>`
  }
  return `${html}</div>`
}

// How a turn ended, when it did not simply complete (aiUsage.logInteraction).
const OUTCOME_NOTES = {
  abandoned: 'left before the reply finished',
  cut: 'reply cut by KivaLens',
  failed: 'failed',
}
const INCOMPLETE_NOTES = {
  max_output_tokens: 'reply reached its length limit',
  content_filter: "reply stopped by OpenAI's content filter",
}
function outcomeNote(turn) {
  if (turn.outcome === 'incomplete') return INCOMPLETE_NOTES[turn.incompleteReason] || 'reply stopped early by OpenAI'
  return OUTCOME_NOTES[turn.outcome]
}

export function buildDigestHtml(day, logs) {
  const groups = new Map()
  for (const e of logs) {
    const key = e.clientId || e.lenderId || 'anonymous'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(e)
  }
  let totalCost = 0
  for (const e of logs) totalCost += Number(e.costUsd) || 0
  const left = logs.filter((e) => e.outcome === 'abandoned').length

  let html =
    `<div style="font-family:system-ui,Arial,sans-serif;max-width:760px">` +
    `<h2 style="color:#2C8C5E">Ask KivaLens — ${esc(day)}</h2>` +
    `<p>${logs.length} interactions · ${groups.size} users · est. cost $${totalCost.toFixed(4)}` +
    `${left ? ` · ${left} abandoned before the reply finished` : ''}</p>` +
    bugSection(bugReports(logs))

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
    for (let idx = 0; idx < items.length; idx++) {
      const it = items[idx]
      // Surface any change the user made between turns before showing this turn.
      if (idx > 0) html += manualLine(items[idx - 1], it)
      const time = fmtTime(it.at)
      const tools = (it.tools || []).map((t) => t.name).join(', ')
      const ended = outcomeNote(it)
      const endedNote = ended ? ` · ${ended}${it.estimated ? ' (cost estimated)' : ''}` : ''
      html +=
        `<div style="margin:0 0 12px;padding:8px 10px;border-left:3px solid #2C8C5E;background:#f7faf8">` +
        `<div style="color:#888;font-size:12px">${esc(time)}${it.page ? ` · ${esc(it.page)}` : ''}${tools ? ` · tools: ${esc(tools)}` : ''}${esc(endedNote)}</div>` +
        `<div style="margin-top:4px"><b>User:</b> ${esc(it.userMessage)}</div>` +
        `<div style="margin-top:2px"><b>KivaLens:</b> ${esc(it.response)}</div>` +
        criteriaLine(it) +
        `</div>`
    }
  }
  html += `</div>`
  return html
}

// Manual send (admin test): skips the once-a-day claim, returns the send result.
/** ", 2 bug reports" — so the inbox line alone shows something needs attention. */
export function subjectSuffix(logs) {
  const n = bugReports(logs).length
  return n ? `, ${n} bug report${n === 1 ? '' : 's'}` : ''
}

export async function sendDigestNow(day, log = console.log) {
  if (!emailConfigured()) return { ok: false, error: 'RESEND_API_KEY not set' }
  const logs = await getDayLogs(day)
  const html = buildDigestHtml(day, logs)
  const r = await sendEmail({ to: TO, subject: `Ask KivaLens digest (test) — ${day} (${logs.length} chats${subjectSuffix(logs)})`, html })
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
  const r = await sendEmail({ to: TO, subject: `Ask KivaLens digest — ${day} (${logs.length} chats${subjectSuffix(logs)})`, html })
  log(`[digest] ${day}: ${r.ok ? `sent to ${TO}` : `failed — ${r.error}`}`)
  // Redis is tight: once the day is emailed, wipe the chats it covered.
  if (r.ok) {
    await clearLogsThrough(day)
    log(`[digest] ${day}: wiped logged chats through ${day}`)
  }
}
