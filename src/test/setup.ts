import { afterAll } from 'vitest'

// Runs in every test file (vitest.config.ts setupFiles).
//
// The catalog a file makes through getKivaLoans or createKivaLoans (src/api/kiva.ts, exposed as
// window.kivaloans) keeps its queue intervals and timers until it is killed, and createKivaLoans
// kills only the one it replaces. The file's last one is killed when the file ends, so it starts
// nothing more once its file is done (a request it had already asked for still finishes). Files
// that make catalogs with `new Loans()` kill those themselves, each case's own.
afterAll(() => {
  const page = (globalThis as { window?: { kivaloans?: { kill(): void } } }).window
  page?.kivaloans?.kill()
})
