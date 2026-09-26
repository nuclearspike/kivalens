/**
 * klDevPlugin.ts — Vite plugin that mounts the KivaLens API server (shared
 * core in klCore.mjs) into the dev server, so `vite dev` serves the same
 * /api/*, /graphql, and /proxy/* endpoints as the production server
 * (server/prod.mjs). One source of truth, no drift.
 */

import type { Plugin, ViteDevServer } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { createState, startRefresh, handleApi, handleProxy, handleRss } from './klCore.mjs'
import { handleChat } from './aiChat.mjs'
import { legacyRedirect } from './legacyRedirect.mjs'
import { configureNodeRuntime } from './nodeRuntime.mjs'
import { sendResponse, toRequest } from './nodeAdapter.mjs'

export function klDevServer(): Plugin {
  const state = createState()
  const log = (msg: string) => console.log(`[KL Dev] ${msg}`)

  return {
    name: 'kl-dev-server',

    configureServer(server: ViteDevServer) {
      configureNodeRuntime()
      const refresh = startRefresh(state, log)
      // Vite restarts the server on config changes; the old refresh must stop with
      // it, or each restart leaves another loan dataset running in the process.
      server.httpServer?.once('close', () => refresh.stop())

      server.middlewares.use(
        async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
          // Only this server's own paths become Fetch requests; everything else goes
          // straight on to Vite untouched (its body is never read here).
          const url = req.url || ''
          if (/^\/(api\/|graphql|proxy\/|rss)/.test(url)) {
            try {
              const request = toRequest(req, res)
              const response =
                (await handleProxy(request)) ??
                (await handleRss(state, request)) ??
                (await handleChat(state, request)) ??
                (await handleApi(state, request))
              if (response) return await sendResponse(res, response)
            } catch (e) {
              // As on the production server: one bad request answers 500 and the
              // dev server keeps running.
              console.error('[KL Dev] request failed:', req.method, url, e)
              if (!res.headersSent) res.statusCode = 500
              res.end('Server error')
              return
            }
          }
          // The same permanent redirect production serves, so a retired address
          // behaves here exactly as it will there.
          const moved = legacyRedirect(req)
          if (moved) {
            res.statusCode = 301
            res.setHeader('Location', moved)
            res.end()
            return
          }
          next()
        },
      )
    },
  }
}
