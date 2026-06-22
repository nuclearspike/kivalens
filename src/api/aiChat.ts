// Client SSE consumer for the Ask KivaLens assistant. The server (server/aiChat.mjs)
// streams `data: {json}\n\n` frames; we parse them across chunk boundaries and
// hand each event to onEvent. All AI calls happen server-side; this just relays.

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export type ChatEvent =
  | { type: 'token'; text: string }
  | { type: 'apply_criteria'; criteria: unknown }
  | { type: 'save_search'; name: string }
  | { type: 'open_lender_modal' }
  | { type: 'set_lender_id'; lenderId: string }
  | { type: 'open_url'; url: string }
  | { type: 'add_to_basket'; loanId: number; amount?: number }
  | { type: 'point_at'; target: string; message: string }
  | { type: 'navigate'; page: string }
  | { type: 'switch_tab'; tab: string }
  | { type: 'remove_from_basket'; loanId: number }
  | { type: 'set_lend_amount'; loanId: number; amount: number }
  | { type: 'clear_basket' }
  | { type: 'load_search'; name: string }
  | { type: 'delete_search'; name: string }
  | { type: 'reset_criteria' }
  | { type: 'chart'; chart: ChartSpec }
  | { type: 'error'; message: string }
  | { type: 'done' }

export interface ChartSpec {
  type: 'bar' | 'pie'
  title?: string
  data: { name: string; value: number }[]
}

export interface StreamChatBody {
  messages: ChatMessage[]
  lenderId?: string | null
  criteria?: unknown
  /** What the user currently sees in the result header ("Showing X of Y"). */
  shownCount?: number
  totalCount?: number
  /** The loan the user currently has open, if any. */
  selectedLoanId?: number | null
  /** A short description of the page the user is on. */
  page?: string
  /** Current basket contents (for basket-management tools). */
  basket?: { loanId: number; amount: number }[]
  /** Names of the user's saved searches. */
  savedSearches?: string[]
  /** Stable per-browser id so server logs can group a user's turns. */
  clientId?: string
}

const MAX_SENT_MESSAGES = 24

/** Parse a single SSE frame (the text between blank lines) into an event, or null. */
export function parseSseFrame(frame: string): ChatEvent | null {
  const line = frame.split('\n').find((l) => l.startsWith('data:'))
  if (!line) return null
  const json = line.slice(line.indexOf(':') + 1).trim()
  if (!json) return null
  try {
    return JSON.parse(json) as ChatEvent
  } catch {
    return null
  }
}

export async function streamChat(
  body: StreamChatBody,
  opts: { onEvent: (e: ChatEvent) => void; signal?: AbortSignal },
): Promise<void> {
  const trimmed: StreamChatBody = { ...body, messages: body.messages.slice(-MAX_SENT_MESSAGES) }
  let res: Response
  try {
    res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(trimmed),
      signal: opts.signal,
    })
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') return
    opts.onEvent({ type: 'error', message: 'Could not reach the assistant.' })
    opts.onEvent({ type: 'done' })
    return
  }
  if (!res.ok || !res.body) {
    opts.onEvent({ type: 'error', message: `The assistant is unavailable (${res.status}).` })
    opts.onEvent({ type: 'done' })
    return
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      let idx: number
      while ((idx = buf.indexOf('\n\n')) !== -1) {
        const evt = parseSseFrame(buf.slice(0, idx))
        buf = buf.slice(idx + 2)
        if (evt) opts.onEvent(evt)
      }
    }
  } catch (e) {
    if ((e as Error)?.name !== 'AbortError') {
      opts.onEvent({ type: 'error', message: 'The connection was interrupted.' })
      opts.onEvent({ type: 'done' })
    }
  }
}
