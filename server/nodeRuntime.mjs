/**
 * nodeRuntime.mjs — the storage the Node server uses (prod.mjs on Heroku and the
 * Vite dev plugin): files in the OS temp directory for the cache, and Redis for
 * the warm-start snapshot and the Ask KivaLens usage store when REDISCLOUD_URL
 * is set (each falls back quietly without it). See runtime.mjs.
 */
import { configureRuntime } from './runtime.mjs'
import { diskCache } from './diskCache.mjs'
import { redisSnapshots } from './klCache.mjs'
import { redisUsage } from './redisUsage.mjs'

export function configureNodeRuntime() {
  configureRuntime({ cache: diskCache, snapshots: redisSnapshots, usage: redisUsage() })
}
