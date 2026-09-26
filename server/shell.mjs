/**
 * shell.mjs — the app shell as a page is served: index.html with this page's own
 * title, description, canonical address and share card written in (pageMeta.mjs),
 * and a validator over the finished body. Shared by the Node server and the
 * Cloudflare Worker.
 *
 * no-cache means "ask me first", which needs something to ask WITH: without a
 * validator the browser re-downloads the whole shell on every move. The tag is
 * over the finished body, so it changes when the page's own head does — a
 * partner renamed, a loan that has since expired.
 */
import crypto from 'node:crypto'
import { applyPageMeta, pageMeta } from './pageMeta.mjs'

export function renderShell(html, { pathname, search, lookup }) {
  const body = applyPageMeta(html, pageMeta({ pathname, search, lookup }))
  const etag = `W/"${crypto.createHash('sha1').update(body).digest('base64url').slice(0, 20)}"`
  return { body, etag }
}
