import type { IncomingMessage, ServerResponse } from 'node:http'
import type { KLState } from './klCore.mjs'

/** Handle POST /api/chat (the Ask KivaLens SSE assistant). Returns true if handled. */
export function handleChat(state: KLState, req: IncomingMessage, res: ServerResponse): boolean
export function validateCriteria(input: unknown, vocab: Record<string, string[]>): {
  loan: Record<string, unknown>
  partner: Record<string, unknown>
  portfolio: Record<string, unknown>
}
