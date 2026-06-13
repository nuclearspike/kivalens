/**
 * klDevPlugin.ts — Vite plugin that mounts the KivaLens API server (shared
 * core in klCore.mjs) into the dev server, so `vite dev` serves the same
 * /api/*, /graphql, and /proxy/* endpoints as the production server
 * (server/prod.mjs). One source of truth, no drift.
 */

import type { Plugin, ViteDevServer } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { createState, startRefresh, handleApi, handleProxy } from './klCore.mjs'

export function klDevServer(): Plugin {
  const state = createState()
  const log = (msg: string) => console.log(`[KL Dev] ${msg}`)

  return {
    name: 'kl-dev-server',

    configureServer(server: ViteDevServer) {
      const refreshTimer = startRefresh(state, log)
      server.httpServer?.once('close', () => clearInterval(refreshTimer))

      server.middlewares.use(
        (req: IncomingMessage, res: ServerResponse, next: () => void) => {
          if (handleProxy(req, res)) return
          if (handleApi(state, req, res)) return
          next()
        },
      )
    },
  }
}
