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
// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), klDevServer()],
})
