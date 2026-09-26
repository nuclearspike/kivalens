import { clientFacts } from './facts'
import type { SupportDeps } from './service'
import { openSupportStore } from './storage'
import type { Transport } from './protocol'
import type { Locale } from '../i18n'

/**
 * Where the page talks to the service. Production is the shared public API;
 * `npm run dev` talks to the service running locally (`wrangler dev --env
 * local`, port 8787), which accepts this origin. VITE_HAU_API_BASE overrides
 * both, for a staging service.
 */
export const API_BASE: string =
  import.meta.env.VITE_HAU_API_BASE ?? (import.meta.env.DEV ? 'http://localhost:8787' : 'https://api.humansareuseful.ai')

const transport: Transport = { base: API_BASE, fetch: (...args) => fetch(...args), clockOffset: 0 }

export async function supportDeps(locale: Locale): Promise<SupportDeps> {
  const store = await openSupportStore()
  return {
    store,
    transport,
    facts: () => clientFacts(locale, { dev: import.meta.env.DEV, userAgent: navigator.userAgent }),
  }
}
