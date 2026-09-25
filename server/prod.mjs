/**
 * prod.mjs — KivaLens production server (Heroku).
 *
 * Serves the built SPA from dist/ and mounts the shared API + proxy handlers
 * (server/klCore.mjs) — the exact same endpoints the Vite dev plugin serves.
 * Runs on Node builtins plus a single runtime dependency (`redis`, a regular
 * dependency so it survives Heroku's devDependency prune) used only for the
 * optional warm-start cache (server/klCache.mjs). Start with `node server/prod.mjs`.
 */

import http from 'node:http'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createState, startRefresh, handleApi, handleProxy, handleRss } from './klCore.mjs'
import { handleChat } from './aiChat.mjs'
import { closeCache } from './klCache.mjs'
import { canonicalRedirect } from './canonicalUrl.mjs'
import { legacyRedirect } from './legacyRedirect.mjs'
import { applyPageMeta, pageMeta, shellLookup } from './pageMeta.mjs'
import { buildSitemap } from './sitemap.mjs'

const PORT = process.env.PORT || 3000
const DIST = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist')
const log = (msg) => console.log(`[KL] ${msg}`)

// ---------------------------------------------------------------------------
// Security headers — the same A+ posture the original cluster.js shipped,
// retuned for this app:
//   - script-src 'self' only (the build emits no inline scripts and the app
//     uses no GA/analytics — stricter than the old config)
//   - style-src allows 'unsafe-inline' (index.html's inline <style> + React/
//     recharts inline style attributes) and Google Fonts CSS
//   - img-src covers Kiva's image CDN + data: (CSS SVG backgrounds, favicons)
//   - connect-src covers the same-origin /api & /proxy plus the client's
//     direct Kiva-API and Google-Docs fallbacks, and the real-user
//     measurement collector (src/lib/rum, cloudflare/rum)
//   - form-action allows the basket checkout POST to Kiva (the POST and its
//     redirects can land on www/apex/other kiva.org subdomains, so allow the
//     whole kiva.org family or the browser blocks the submission)
// ---------------------------------------------------------------------------

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: https://www.kiva.org https://*.kivaws.org",
  "connect-src 'self' https://api.kivaws.org https://www.kiva.org https://docs.google.com https://rum.kivalens.org",
  "form-action 'self' https://www.kiva.org https://kiva.org https://*.kiva.org",
  "frame-ancestors 'none'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "worker-src 'self'",
].join('; ')

function setSecurityHeaders(res) {
  res.setHeader('Content-Security-Policy', CSP)
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader(
    'Permissions-Policy',
    'geolocation=(), microphone=(), camera=(), payment=(), usb=()',
  )
}

// ---------------------------------------------------------------------------
// Static file serving. The app's routes are real paths, so a request for a page
// is served the shell (the router takes it from there) and only a request that
// looks like a file it does not have is a 404.
// ---------------------------------------------------------------------------

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
}

const COMPRESSIBLE = new Set(['.css', '.html', '.js', '.json', '.mjs', '.svg', '.txt', '.webmanifest'])

// What a missing path has to look like to be answered 404 rather than the app
// shell. The list is the file kinds this site actually serves, so a path
// segment that merely contains a dot stays a page.
const ASSET_EXTENSION =
  /\.(js|mjs|css|map|json|webmanifest|html|png|jpe?g|gif|webp|svg|ico|woff2?|ttf|txt|xml)$/i

function acceptedEncoding(req, filePath) {
  const ext = path.extname(filePath).toLowerCase()
  if (!COMPRESSIBLE.has(ext)) return null
  const accepted = new Map(
    String(req.headers['accept-encoding'] || '')
      .split(',')
      .map((part) => {
        const [name, ...params] = part.trim().toLowerCase().split(';')
        const qParam = params.find((param) => param.trim().startsWith('q='))
        const q = qParam ? Number(qParam.trim().slice(2)) : 1
        return [name, Number.isFinite(q) ? q : 0]
      }),
  )
  const quality = (name) => accepted.get(name) ?? accepted.get('*') ?? 0
  if (quality('br') > 0 && fs.existsSync(`${filePath}.br`)) return { name: 'br', file: `${filePath}.br` }
  if (quality('gzip') > 0 && fs.existsSync(`${filePath}.gz`)) return { name: 'gzip', file: `${filePath}.gz` }
  return null
}

function sendFile(req, res, filePath, status = 200) {
  const ext = path.extname(filePath).toLowerCase()
  const encoded = acceptedEncoding(req, filePath)
  const source = encoded?.file || filePath
  fs.readFile(source, (err, data) => {
    if (err) {
      res.statusCode = 404
      res.end('Not found')
      return
    }
    res.statusCode = status
    res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream')
    if (COMPRESSIBLE.has(ext)) res.setHeader('Vary', 'Accept-Encoding')
    if (encoded) res.setHeader('Content-Encoding', encoded.name)
    res.setHeader('Content-Length', data.length)
    if (filePath.includes(`${path.sep}assets${path.sep}`)) {
      // Vite content-hashes asset filenames — safe to cache forever.
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    } else if (ext === '.html') {
      res.setHeader('Cache-Control', 'no-cache')
    } else {
      res.setHeader('Cache-Control', 'public, max-age=3600')
    }
    if (req.method === 'HEAD') res.end()
    else res.end(data)
  })
}

/**
 * The app shell, with this page's own title, description, canonical address and
 * share card written into it.
 *
 * The site is one page driven by the History API, so the shell is the only HTML
 * there is: a crawler or a link preview reads whatever this writes, and the app
 * writes the same fields again in the lender's language as they move around.
 * The file is read from disk each time (the OS caches it) and sent
 * uncompressed — it is a few kilobytes, already no-cache, and the precompressed
 * copies on disk are of the untouched file.
 */
function serveShell(state, req, res, pathname, search) {
  fs.readFile(path.join(DIST, 'index.html'), 'utf8', (err, html) => {
    if (err) {
      res.statusCode = 500
      res.end('Shell unavailable')
      return
    }
    const body = applyPageMeta(html, pageMeta({ pathname, search, lookup: shellLookup(state, pathname) }))
    // no-cache means "ask me first", which needs something to ask WITH: without
    // a validator the browser re-downloads the whole shell on every move. The
    // tag is over the finished body, so it changes when the page's own head
    // does — a partner renamed, a loan that has since expired.
    const etag = `W/"${crypto.createHash('sha1').update(body).digest('base64url').slice(0, 20)}"`
    res.setHeader('Content-Type', MIME['.html'])
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('ETag', etag)
    if (req.headers['if-none-match'] === etag) {
      res.statusCode = 304
      res.end()
      return
    }
    res.statusCode = 200
    res.setHeader('Content-Length', Buffer.byteLength(body))
    if (req.method === 'HEAD') res.end()
    else res.end(body)
  })
}

/**
 * A path, decoded where it can be. `decodeURIComponent` throws on a half-written
 * escape — `/%FF` — which anyone can send, so a throw here would take the whole
 * process with it. The raw path stands in; it will match no file and no route,
 * and the visitor gets the app.
 */
function safeDecode(pathname) {
  try {
    return decodeURIComponent(pathname)
  } catch {
    return pathname
  }
}

function serveStatic(state, req, res) {
  const [rawPath, rawQuery] = (req.url || '/').split('?')
  const search = rawQuery ? `?${rawQuery}` : ''

  // Strip query, decode, normalize
  let pathname = safeDecode(rawPath)
  if (pathname === '/') return serveShell(state, req, res, '/', search)

  // Resolve against DIST and guard against path traversal
  const resolved = path.normalize(path.join(DIST, pathname))
  if (!resolved.startsWith(DIST + path.sep)) {
    res.statusCode = 403
    res.end('Forbidden')
    return
  }

  fs.stat(resolved, (err, stat) => {
    if (!err && stat.isFile()) return sendFile(req, res, resolved)
    // No file. A request a browser makes for a page is a client route and gets
    // the app shell; anything else is a genuine 404. Asking whether the request
    // accepts HTML rather than whether the path has a file extension keeps a
    // path segment containing a dot — a loan or partner id one day — from being
    // mistaken for a file.
    const accept = String(req.headers.accept || '')
    const wantsPage = accept.includes('text/html') || accept.includes('*/*') || accept === ''
    if (wantsPage && !ASSET_EXTENSION.test(pathname)) {
      serveShell(state, req, res, pathname, search)
    } else {
      res.statusCode = 404
      res.end('Not found')
    }
  })
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

const state = createState()
const refreshTimer = startRefresh(state, log)

const server = http.createServer((req, res) => {
  try {
    handleRequest(req, res)
  } catch (e) {
    // One bad request is not a reason for every other lender to lose the site.
    console.error('Request failed:', req.method, req.url, e)
    if (!res.headersSent) {
      res.statusCode = 500
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    }
    res.end('Server error')
  }
})

function handleRequest(req, res) {
  setSecurityHeaders(res)

  // One permanent redirect to the canonical origin (https://www.kivalens.org)
  // for plain-HTTP and bare-apex requests; see canonicalUrl.mjs.
  const location = canonicalRedirect(req)
  if (location) {
    res.statusCode = 301
    res.setHeader('Location', location)
    res.end()
    return
  }

  // The pages worth finding, listed from the partners already in memory.
  if ((req.url || '').split('?')[0] === '/sitemap.xml') {
    const body = buildSitemap(state.partners ?? [])
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/xml; charset=utf-8')
    res.setHeader('Cache-Control', 'public, max-age=3600')
    res.setHeader('Content-Length', Buffer.byteLength(body))
    if (req.method === 'HEAD') res.end()
    else res.end(body)
    return
  }

  if (handleProxy(req, res)) return
  if (handleRss(state, req, res)) return
  if (handleChat(state, req, res)) return
  if (handleApi(state, req, res)) return

  // A page that moved answers with one permanent redirect, after the data and
  // proxy endpoints have claimed their own paths and before the shell is served.
  const moved = legacyRedirect(req)
  if (moved) {
    res.statusCode = 301
    res.setHeader('Location', moved)
    res.end()
    return
  }

  serveStatic(state, req, res)
}

server.listen(PORT, () => log(`KivaLens server listening on :${PORT} (serving ${DIST})`))

process.on('SIGTERM', () => {
  clearInterval(refreshTimer)
  closeCache()
  server.close(() => process.exit(0))
})
