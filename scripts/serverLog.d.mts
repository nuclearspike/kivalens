/** A log line's timestamp in microseconds since the epoch; NaN without one. */
export function stampOf(line: string): number

/** The fields of a Heroku router line, with quoted values unquoted; null for any other line. */
export function routerFields(line: string): Record<string, string> | null

/** The server's line for an RSS request it answered 503 while warming up, after Heroku's timestamp; groups dyno and id. */
export const WARMUP_MARK: RegExp

/** The size of the warm-up answer's body, as the router logs it in bytes=. */
export const WARMUP_BYTES: number

export interface ServerLog {
  /** Every line that starts with a timestamp, as delivered. */
  stamped: string[]
  /** The stamped lines at or after `since`, in timestamp order. */
  lines: string[]
  crashed: string[]
  /** Heroku's notices that it dropped log lines (L10 to L13). */
  lost: string[]
  /** RSS 503s of the warm-up answer's size that the server marked, from the same dyno, within 5 s. */
  rssWarmup: string[]
  errors: string[]
}

/** `since` is the release time in epoch milliseconds. */
export function readServerLog(text: string, window: { since: number }): ServerLog

export interface ServerLogJudgement {
  log: ServerLog
  notes: string[]
  /** Why the log cannot show that nothing went wrong; empty when it can. */
  incomplete: string[]
  crashed: string | null
  errors: string[]
  summary: Record<string, unknown>
  /** For the final DEPLOYED line; empty when there is nothing to add. */
  tail: string
}

export function judgeServerLog(logs: { status: number | null; text: string }, window: { since: number }): ServerLogJudgement
