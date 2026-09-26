import { create } from 'zustand'

/**
 * Which shared support dialog is open, and the Feedback draft.
 *
 * Kept outside the dialogs so the draft survives closing them: Escape, the
 * backdrop and Close keep an unsent draft and its kind for the next ordinary
 * entry; only Cancel discards it (definition rules.feedbackReentry, and
 * entryPoints.web_app.presentation). This module is small on purpose: the
 * footer, About and the language menu import it on every page, while the
 * dialogs and the 100 KB shared catalog load only when one is opened.
 */

export type FeedbackKindId = 'idea' | 'bug' | 'language'

export interface FeedbackDraft {
  kind: FeedbackKindId
  message: string
  /** The requested language: a BCP-47 code, or the lender's own words when none matched. */
  language: { code: string | null; label: string } | null
  languageNote: string
  consent: boolean
  email: string
  detailsOpen: boolean
}

export const EMPTY_DRAFT: FeedbackDraft = {
  kind: 'idea',
  message: '',
  language: null,
  languageNote: '',
  consent: false,
  email: '',
  detailsOpen: false,
}

interface SupportState {
  open: null | 'feedback' | 'reports'
  draft: FeedbackDraft
  /** The brief thanks after an accepted report, and when it was shown. */
  thanks: number | null
  openFeedback: (options?: { kind?: FeedbackKindId }) => void
  openReports: () => void
  close: () => void
  setDraft: (patch: Partial<FeedbackDraft>) => void
  discardDraft: () => void
  accepted: () => void
  dismissThanks: () => void
}

export const useSupportStore = create<SupportState>((set, get) => ({
  open: null,
  draft: EMPTY_DRAFT,
  thanks: null,
  openFeedback: (options) => {
    const { draft } = get()
    // Ordinary entry keeps a draft and its kind; a context (the language menu)
    // chooses the kind, and never overwrites words already written.
    const kind = options?.kind ?? draft.kind
    set({ open: 'feedback', draft: { ...draft, kind } })
  },
  openReports: () => set({ open: 'reports' }),
  close: () => set({ open: null }),
  setDraft: (patch) => set({ draft: { ...get().draft, ...patch } }),
  discardDraft: () => set({ draft: EMPTY_DRAFT, open: null }),
  accepted: () => set({ draft: EMPTY_DRAFT, open: null, thanks: Date.now() }),
  dismissThanks: () => set({ thanks: null }),
}))
