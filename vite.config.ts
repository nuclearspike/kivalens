import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import dotenv from 'dotenv'
import { klDevServer } from './server/klDevPlugin.ts'
import { execSync } from 'node:child_process'

// What the shared Feedback sends as this app's version and build, and shows the
// lender before it does: the build date and the commit. Heroku's build provides
// the commit as SOURCE_VERSION; a local build asks git.
function commit(): string {
  if (process.env.SOURCE_VERSION) return process.env.SOURCE_VERSION.slice(0, 12)
  try {
    return execSync('git rev-parse --short=12 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || 'dev'
  } catch {
    return 'dev'
  }
}
const built = new Date()
const KL_VERSION = `${built.getUTCFullYear()}.${built.getUTCMonth() + 1}.${built.getUTCDate()}`

// Load .env.local into process.env so the dev plugin (which runs the same
// server code as prod) can read OPENAI_API_KEY. The key is server-only and is
// NEVER exposed to the client (no VITE_ prefix). Shell env still wins:
// `OPENAI_API_KEY=sk-... npm run dev` also works.
dotenv.config({ path: '.env.local' })
dotenv.config()

// The klDevServer plugin mounts the same /api/*, /graphql, and /proxy/*
// endpoints the production server (server/prod.mjs) serves, so dev and prod
// share one implementation (server/klCore.mjs).
// When fronted by the `directory` hub (dev.kivalens.com:80 -> :5555), the hub
// starts vite with DIRECTORY_PROXY=1 so we can allow that Host and make HMR
// reconnect through port 80. Direct `localhost:5555` access is unaffected.
const viaProxy = process.env.DIRECTORY_PROXY === '1'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), klDevServer()],
  define: {
    __KL_VERSION__: JSON.stringify(KL_VERSION),
    __KL_BUILD__: JSON.stringify(commit()),
  },
  server: {
    port: 5555,
    ...(viaProxy
      ? {
          allowedHosts: ['dev.kivalens.com'],
          hmr: { host: 'dev.kivalens.com', clientPort: 80, protocol: 'ws' },
        }
      : {}),
  },
})
