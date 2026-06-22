/**
 * email.mjs — minimal transactional email via the Resend HTTP API.
 * Set RESEND_API_KEY (and optionally DIGEST_FROM) as config vars. No-ops if the
 * key is absent, so dev / unconfigured deploys never error.
 */
const RESEND_API_KEY = process.env.RESEND_API_KEY
// The Resend key is scoped to kivalens.org, so send from that (verified) domain.
// Override with DIGEST_FROM; if the domain isn't verified yet, set it to
// 'KivaLens <onboarding@resend.dev>' (Resend's shared test sender).
const FROM = process.env.DIGEST_FROM || 'KivaLens <digest@kivalens.org>'

export function emailConfigured() {
  return !!RESEND_API_KEY
}

export async function sendEmail({ to, subject, html }) {
  if (!RESEND_API_KEY) return { ok: false, error: 'RESEND_API_KEY not set' }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: Array.isArray(to) ? to : [to], subject, html }),
    })
    if (!res.ok) {
      const t = await res.text().catch(() => '')
      return { ok: false, error: `HTTP ${res.status}: ${t.slice(0, 200)}` }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}
