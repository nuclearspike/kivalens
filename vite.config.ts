import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { klDevServer } from './server/klDevPlugin'

// The klDevServer plugin mounts the same /api/*, /graphql, and /proxy/*
// endpoints the production server (server/prod.mjs) serves, so dev and prod
// share one implementation (server/klCore.mjs).
// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), klDevServer()],
})
