import type { KLState } from './klCore.mjs'

/**
 * The Ask KivaLens routes (/api/chat, /api/translate, /api/ai-*): a Response, or
 * null when the request is not theirs. `waitUntil` keeps a streamed turn running
 * on hosts that end work when the response is returned (Cloudflare).
 */
export function handleChat(state: KLState, request: Request, options?: { waitUntil?: (p: Promise<unknown>) => void }): Promise<Response | null>
export function validateCriteria(input: unknown, vocab: Record<string, string[]>): {
  loan: Record<string, unknown>
  partner: Record<string, unknown>
  portfolio: Record<string, unknown>
}
