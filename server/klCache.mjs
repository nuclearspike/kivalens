/**
 * klCache.mjs — optional Redis "warm start" cache for the KL server.
 *
 * On boot the server hydrates its served dataset from Redis so it can answer
 * /api/* immediately, instead of clients falling back to downloading straight
 * from Kiva for the few minutes the live fetch takes (the post-deploy gap).
 * Each successful refresh rewrites the snapshot.
 *
 * Purely additive and never fatal: if REDISCLOUD_URL is unset (local dev) or
 * Redis is unavailable / errors, every function quietly no-ops and the server
 * behaves exactly as it did before this module existed.
 *
 * ╔═ VERSIONING ══════════════════════════════════════════════════╗
 * The snapshot encodes the server's *served-data format*: klStart, the gzipped
 * partner / options / loan / keyword page buffers, and the per-loan details
 * (descriptions + kl_repayments) that /graphql serves. If you change any of
 * that format — compressLoan() output, klStart shape, the taxonomy shape, or the
 * snapshot shape below — BUMP CACHE_VERSION. The version is part of the key name,
 * so old-format data is never read back into a new build (clean miss -> the
 * server just does its normal live fetch). Stale/old-version keys self-evict via
 * the TTL.
 * ╚════════════════════════════════════════════════════╝
 */

import zlib from 'node:zlib'

const CACHE_VERSION = 2
const KEY = `kl:snapshot:v${CACHE_VERSION}`
const TTL_SECONDS = 7 * 24 * 60 * 60 // 7 days; refreshed on every save
const REDIS_URL =
  process.env.REDISCLOUD_URL || process.env.REDIS_URL || process.env.REDIS_TLS_URL || null

// Lazily-created, shared client. The redis package is only imported when a
// connection URL is configured, so local dev never loads it.
let clientPromise = null

async function getClient() {
  if (!REDIS_URL) return null
  if (!clientPromise) {
    clientPromise = (async () => {
      const { createClient } = await import('redis')
      const u = new URL(REDIS_URL)
      // The Redis Cloud instance is an older server, so we connect the way it
      // expects (verified against the live addon):
      //   - RESP: 2 — it doesn't support the RESP3 HELLO handshake node-redis v6
      //     sends by default; RESP2 skips HELLO. We only need plain GET/SET.
      //   - password-only AUTH — the URL carries a username ('rediscloud') that
      //     the instance rejects as an ACL user (WRONGPASS); it uses single
      //     `requirepass` auth, so we pass the password and drop the username.
      const client = createClient({
        socket: {
          host: u.hostname,
          port: Number(u.port) || 6379,
          // Honor TLS URLs (rediss://) generically, though this addon is plain.
          ...(u.protocol === 'rediss:' ? { tls: true, rejectUnauthorized: false } : {}),
        },
        password: u.password ? decodeURIComponent(u.password) : undefined,
        RESP: 2,
      })
      // A redis hiccup must never crash the server; node-redis auto-reconnects.
      client.on('error', () => {})
      await client.connect()
      return client
    })().catch(() => null) // connection failure -> null (handled below)
  }
  const client = await clientPromise
  // A failed initial connect resolves to null; clear the cached promise so a
  // later call (next save cycle) retries instead of staying disabled forever.
  // An established client persists — node-redis reconnects internally.
  if (!client) clientPromise = null
  return client
}

// Shared with server/aiUsage.mjs so the AI cost counter + interaction log reuse
// this single connection (and its RESP2/password-only handshake) instead of
// opening a second one. Returns null when Redis isn't configured/available.
export { getClient as getRedisClient }

const b64 = (buf) => (buf ? buf.toString('base64') : null)
const unb64 = (s) => (s ? Buffer.from(s, 'base64') : null)
const gzipAsync = (buf) =>
  new Promise((resolve, reject) => zlib.gzip(buf, { level: 6 }, (e, r) => (e ? reject(e) : resolve(r))))
const gunzipAsync = (buf) =>
  new Promise((resolve, reject) => zlib.gunzip(buf, (e, r) => (e ? reject(e) : resolve(r))))

/**
 * Persist the currently-published served dataset. Fire-and-forget: callers do
 * not await it, and it never throws into the caller.
 */
export async function saveSnapshot(state, log = () => {}) {
  try {
    const client = await getClient()
    if (!client) return
    const served = state.batches.get(state.batch)
    if (!served || !state.klStart) return // nothing published yet
    const snap = {
      v: CACHE_VERSION,
      savedAt: Date.now(),
      batch: state.batch,
      newestTime: state.newestTime,
      klStart: state.klStart,
      partners: b64(state.partnersGz),
      options: b64(state.optionsGz),
      loanPages: served.loanPages.map(b64),
      keywordPages: served.keywordPages.map(b64),
      // Per-loan descriptions + repayment schedules — the dataset /graphql serves.
      // gzip'd here because, unlike the page buffers, these are raw objects.
      details: b64(
        await gzipAsync(
          Buffer.from(
            JSON.stringify(
              (state.allLoans || []).map((l) => ({
                id: l.id,
                description: l.description,
                kl_repayments: l.kl_repayments,
              })),
            ),
          ),
        ),
      ),
    }
    const payload = JSON.stringify(snap)
    await client.set(KEY, payload, { EX: TTL_SECONDS })
    log(`[cache] saved snapshot (batch ${state.batch}, ${(payload.length / 1048576).toFixed(2)}MB)`)
  } catch (e) {
    log(`[cache] save failed (non-fatal): ${e}`)
  }
}

/**
 * Read the most recent snapshot, with gzipped buffers rehydrated. Returns null
 * if there's nothing cached, the cache is unavailable, or anything goes wrong.
 */
export async function loadSnapshot(log = () => {}) {
  try {
    const client = await getClient()
    if (!client) return null
    const payload = await client.get(KEY)
    if (!payload) return null
    const snap = JSON.parse(payload)
    if (snap.v !== CACHE_VERSION) return null // defensive; key already encodes version
    // Guard against a corrupt/partial snapshot — require the fields we serve
    // from before trusting it (options may be absent; taxonomy is non-essential).
    if (
      !snap.klStart ||
      !snap.partners ||
      !Array.isArray(snap.loanPages) || snap.loanPages.length === 0 ||
      !Array.isArray(snap.keywordPages)
    ) {
      log('[cache] snapshot incomplete; ignoring')
      return null
    }
    let details = []
    if (snap.details) {
      try {
        details = JSON.parse((await gunzipAsync(unb64(snap.details))).toString('utf8'))
      } catch (e) {
        log(`[cache] details decode failed (non-fatal): ${e}`)
      }
    }
    return {
      batch: snap.batch,
      newestTime: snap.newestTime,
      klStart: snap.klStart,
      partnersGz: unb64(snap.partners),
      optionsGz: unb64(snap.options),
      loanPages: (snap.loanPages || []).map(unb64),
      keywordPages: (snap.keywordPages || []).map(unb64),
      details,
      savedAt: snap.savedAt,
    }
  } catch (e) {
    log(`[cache] load failed (non-fatal): ${e}`)
    return null
  }
}

/** Best-effort close, called on shutdown. */
export async function closeCache() {
  try {
    const client = clientPromise ? await clientPromise : null
    if (client) await client.quit()
  } catch {
    // ignore
  }
}
