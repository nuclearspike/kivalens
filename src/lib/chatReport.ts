import type { ChatEvent } from '../api/aiChat'
import { useSupportStore } from '../support/supportStore'

type Translate = (key: string, params?: Record<string, string | number>) => string
export type ChatReportEvent = Extract<ChatEvent, { type: 'open_feedback' }>

/**
 * A problem the lender described to Ask KivaLens, as the text of a Send Feedback
 * report: the summary, then what they expected, what happened and where, each only
 * when they said it. The labels are in the lender's language; their words are theirs.
 */
export function feedbackFromChatReport(e: ChatReportEvent, t: Translate): string {
  const lines = [String(e.summary ?? '').trim()]
  const add = (key: string, value: string | undefined) => {
    const v = String(value ?? '').trim()
    if (v) lines.push(`${t(key)}: ${v}`)
  }
  add('report_expected', e.expected)
  add('report_actual', e.actual)
  add('report_where', e.where)
  return lines.filter(Boolean).join('\n')
}

/**
 * Opens Send Feedback on Bug with the report filled in, so a problem raised in chat
 * reaches the same inbox as every other report and can be followed under My
 * Reports. Words the lender already wrote in the dialog are never replaced.
 */
export function openFeedbackWithChatReport(text: string): void {
  const support = useSupportStore.getState()
  if (!support.draft.message.trim()) support.setDraft({ message: text })
  support.openFeedback({ kind: 'bug' })
}
