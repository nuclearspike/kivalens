import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import dotenv from 'dotenv'
import { klDevServer } from './server/klDevPlugin'

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
