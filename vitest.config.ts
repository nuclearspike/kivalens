import { defineConfig } from 'vitest/config'

// Unit tests for the matching engine and pure helpers. Most run in the default
// node environment; files that import the browser-oriented kiva.ts module opt
// into jsdom with a `// @vitest-environment jsdom` pragma at the top of the file.
export default defineConfig({
  test: {
    environment: 'node',
    // cloudflare/: the Workers' own logic, tested in Node (D1 is SQLite; node:sqlite stands in).
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'cloudflare/**/*.test.ts'],
  },
})
