import { beforeEach, describe, expect, it } from 'vitest'
import { feedbackFromChatReport, openFeedbackWithChatReport } from './chatReport'
import { EMPTY_DRAFT, useSupportStore } from '../support/supportStore'

/**
 * A problem told to Ask KivaLens lands in Send Feedback, the one channel (Paul,
 * 2026-09-28: do away with GitHub reporting and emailing him directly).
 */

const t = (key: string) => ({ report_expected: 'Expected', report_actual: 'What happened', report_where: 'Where' })[key] ?? key

beforeEach(() => useSupportStore.setState({ open: null, draft: EMPTY_DRAFT }))

describe('a problem reported in chat', () => {
  it('becomes the report text: the summary, then only what the lender said', () => {
    expect(feedbackFromChatReport({ type: 'open_feedback', kind: 'bug', summary: ' basket empties ', actual: 'all gone', where: '' }, t)).toBe(
      'basket empties\nWhat happened: all gone',
    )
    expect(feedbackFromChatReport({ type: 'open_feedback', kind: 'bug', summary: 'x', expected: 'y', actual: 'z', where: 'Basket' }, t)).toBe(
      'x\nExpected: y\nWhat happened: z\nWhere: Basket',
    )
  })

  it('opens Send Feedback on Bug with it filled in', () => {
    openFeedbackWithChatReport('basket empties')
    const s = useSupportStore.getState()
    expect(s.open).toBe('feedback')
    expect(s.draft).toMatchObject({ kind: 'bug', message: 'basket empties' })
  })

  it('never replaces words the lender already wrote in the dialog', () => {
    useSupportStore.setState({ draft: { ...EMPTY_DRAFT, message: 'my own words' } })
    openFeedbackWithChatReport('from chat')
    expect(useSupportStore.getState().draft.message).toBe('my own words')
  })
})
