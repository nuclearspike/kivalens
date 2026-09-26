// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { I18nProvider } from '../i18n'
import SupportHost from './SupportHost'
import FeedbackDialog from './FeedbackDialog'
import MyReportsDialog from './MyReportsDialog'
import SupportEntries from './SupportEntries'
import LanguageMenu from '../components/LanguageMenu'
import KLFooter from '../components/KLFooter'
import { EMPTY_DRAFT, useSupportStore } from './supportStore'
import { MemoryStore, resetSupportStoreForTests, type StoredReport } from './storage'

/**
 * The shared Feedback and My Reports as a lender meets them, against a fake
 * service. Each behaviour here is one the shared definition requires of every
 * HumansAreUseful app (definition 1.1.21, screens.feedback / screens.myReports).
 */

type Call = { path: string; body: { client: Record<string, unknown>; payload: Record<string, unknown> } }
let calls: Call[] = []
let feedbackResponse: () => Response
let store: MemoryStore

const json = (status: number, value: object) => new Response(JSON.stringify({ serverTime: new Date().toISOString(), ...value }), { status })
const accepted = () => json(202, { payload: { reportCode: 'LSS-AAAAA-BBBBB', receipt: 'r'.repeat(40), status: 'received', contactVerificationPending: false } })

beforeEach(() => {
  calls = []
  feedbackResponse = accepted
  store = new MemoryStore(true)
  resetSupportStoreForTests(store)
  useSupportStore.setState({ open: null, draft: EMPTY_DRAFT, thanks: null })
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      const path = new URL(url).pathname
      calls.push({ path, body: JSON.parse(init.body as string) })
      if (path === '/v1/installations/enroll') return json(201, { payload: { keyId: 'key-1' } })
      if (path === '/v1/feedback') return feedbackResponse()
      if (path === '/v1/reports/status') return json(200, { payload: { status: 'investigating', revision: 2, updatedAt: new Date().toISOString(), messages: [], outcome: { code: 'beingLookedAt' }, contact: { state: 'none' } } })
      return json(404, { error: { code: 'routeNotFound', message: '', retryable: false } })
    }),
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.useRealTimers()
  resetSupportStoreForTests()
  window.localStorage.clear()
})

const wrap = (ui: React.ReactNode) => render(<I18nProvider><MemoryRouter>{ui}</MemoryRouter></I18nProvider>)

function openFeedback(kind?: 'idea' | 'bug' | 'language') {
  act(() => useSupportStore.getState().openFeedback(kind ? { kind } : undefined))
  return wrap(<FeedbackDialog />)
}
const send = () => screen.getAllByRole('button').at(-1)!
// The browser's languages, keeping the rest of navigator (a spread copies only own
// properties, and userAgent is a getter the report's facts read).
const browserSays = (...languages: string[]) =>
  vi.stubGlobal('navigator', { ...navigator, userAgent: navigator.userAgent, languages, language: languages[0] })
const type = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } })

describe('Send Feedback', () => {
  it('opens on Idea, ready to type, and will not send until there are three characters', () => {
    openFeedback()
    expect(screen.getByRole('radio', { name: 'Idea' })).toHaveAttribute('aria-checked', 'true')
    const box = screen.getByLabelText('What would you like to suggest?')
    expect(box).toHaveFocus()
    expect(send()).toHaveTextContent('Send suggestion')
    expect(send()).toBeDisabled()
    type(box, 'ab')
    expect(send()).toBeDisabled()
    type(box, 'abc')
    expect(send()).toBeEnabled()
  })

  it('keeps what was written when the kind changes, and names the send for the kind', () => {
    openFeedback()
    type(screen.getByRole('textbox'), 'The chart legend overlaps.')
    fireEvent.click(screen.getByRole('radio', { name: 'Bug' }))
    expect(screen.getByLabelText('What happened?')).toHaveValue('The chart legend overlaps.')
    expect(send()).toHaveTextContent('Send report')
  })

  it('shows exactly the facts it sends', async () => {
    openFeedback('bug')
    type(screen.getByRole('textbox'), 'A synthetic report.')
    fireEvent.click(await screen.findByRole('button', { name: 'Show details' }))
    const shown = screen.getByRole('button', { name: 'Show details' }).nextElementSibling as HTMLElement
    fireEvent.click(send())
    await waitFor(() => expect(calls.some((c) => c.path === '/v1/feedback')).toBe(true))
    const client = calls.find((c) => c.path === '/v1/feedback')!.body.client
    expect(shown).toHaveTextContent(`KivaLens ${client.appVersion} (build ${client.appBuild})`)
    expect(shown).toHaveTextContent(String(client.osVersion))
    expect(shown).toHaveTextContent(client.distribution === 'web' ? 'Website' : 'Development build')
    expect(shown).toHaveTextContent(`web ${(client.sdk as { version: string }).version}`)
    expect(shown).toHaveTextContent(`(${client.locale})`)
  })

  it('asks for an address only with consent, and will not send a malformed one', async () => {
    openFeedback('bug')
    type(screen.getByRole('textbox'), 'Needs a reply.')
    expect(screen.queryByLabelText('Email address (optional)')).toBeNull()
    fireEvent.click(screen.getByLabelText('You may contact me about this report'))
    // Optional even with consent: an empty address sends anonymously.
    expect(send()).toBeEnabled()
    const email = screen.getByLabelText('Email address (optional)')
    type(email, 'not-an-address')
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument()
    expect(send()).toBeDisabled()
    type(email, 'lender@example.com')
    expect(send()).toBeEnabled()
    expect(await screen.findByText(/Sending: your message, your email/)).toBeInTheDocument()
  })

  it('on acceptance closes, starts the next report fresh, and thanks the lender', async () => {
    openFeedback('bug')
    type(screen.getByRole('textbox'), 'Accepted report.')
    fireEvent.click(send())
    await waitFor(() => expect(useSupportStore.getState().open).toBeNull())
    expect(useSupportStore.getState().thanks).not.toBeNull()
    expect(useSupportStore.getState().draft).toEqual(EMPTY_DRAFT)
    const sent = calls.find((c) => c.path === '/v1/feedback')!.body.payload
    expect(sent).toMatchObject({ kind: 'bug', message: 'Accepted report.', disclosureReviewed: true })
    expect((await store.listReports('kivalens-web'))[0].message).toBe('Accepted report.')
  })

  it('on failure keeps the draft, says why, and offers Retry, Copy and Discard', async () => {
    feedbackResponse = () => {
      throw new TypeError('Failed to fetch')
    }
    openFeedback('bug')
    type(screen.getByRole('textbox'), 'Sent while offline.')
    fireEvent.click(send())
    expect(await screen.findByText(/Check your connection and try again/)).toBeInTheDocument()
    expect(screen.getByRole('textbox')).toHaveValue('Sent while offline.')
    for (const name of ['Retry', 'Copy', 'Discard']) expect(screen.getByRole('button', { name })).toBeInTheDocument()
    expect(useSupportStore.getState().open).toBe('feedback')
  })

  it('when this page is too old to send, says reload and offers no Retry', async () => {
    feedbackResponse = () => json(426, { error: { code: 'upgrade_required', message: '', retryable: false } })
    openFeedback('bug')
    type(screen.getByRole('textbox'), 'From an old page.')
    fireEvent.click(send())
    expect(await screen.findByText(/Reload the page to send it/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument()
  })

  it('sends with Ctrl+Enter', async () => {
    openFeedback('bug')
    const box = screen.getByRole('textbox')
    type(box, 'Keyboard send.')
    fireEvent.keyDown(box, { key: 'Enter', ctrlKey: true })
    await waitFor(() => expect(calls.some((c) => c.path === '/v1/feedback')).toBe(true))
  })

  it('asks for a language by name, and sends the request the way the apps write it', async () => {
    openFeedback('language')
    expect(send()).toHaveTextContent('Send language request')
    expect(send()).toBeDisabled()
    type(screen.getByRole('searchbox'), 'swa')
    fireEvent.click(screen.getByRole('option', { name: /Kiswahili/ }))
    expect(send()).toHaveTextContent('Request Swahili')
    type(screen.getByLabelText('Anything else? (optional)'), 'Many lenders in Kenya.')
    fireEvent.click(send())
    await waitFor(() => expect(calls.some((c) => c.path === '/v1/feedback')).toBe(true))
    expect(calls.find((c) => c.path === '/v1/feedback')!.body.payload).toMatchObject({
      kind: 'languageRequest',
      message: 'Request Swahili\n\nMany lenders in Kenya.',
    })
  })

  it('keeps an unsent draft when closed, and discards it only on Cancel', () => {
    openFeedback('bug')
    type(screen.getByRole('textbox'), 'Half written.')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(useSupportStore.getState()).toMatchObject({ open: null, draft: { kind: 'bug', message: 'Half written.' } })
    cleanup()
    openFeedback()
    expect(screen.getByRole('textbox')).toHaveValue('Half written.')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(useSupportStore.getState().draft).toEqual(EMPTY_DRAFT)
  })
})

describe('My Reports', () => {
  const kept = (over: Partial<StoredReport>): StoredReport => ({
    appId: 'kivalens-web',
    reportCode: 'LSS-AAAAA-BBBBB',
    receipt: 'r'.repeat(40),
    kind: 'bug',
    message: 'A report',
    createdAt: '2026-09-20T10:00:00.000Z',
    outcome: 'received',
    ...over,
  })

  it('lists this browser’s reports newest first, by the words the lender wrote, without asking the service', async () => {
    await store.putReport(kept({ reportCode: 'LSS-OLDER-AAAAA', message: 'Older report\nmore', createdAt: '2026-09-01T10:00:00.000Z' }))
    await store.putReport(kept({ reportCode: 'LSS-NEWER-AAAAA', message: 'Newer report', createdAt: '2026-09-20T10:00:00.000Z' }))
    await store.putReport(kept({ appId: 'another-app', reportCode: 'LSS-OTHER-AAAAA', message: 'Not ours' }))
    act(() => useSupportStore.getState().openReports())
    wrap(<MyReportsDialog />)
    const items = await screen.findAllByRole('listitem')
    expect(items.map((i) => i.querySelector('.kl-support-report-line')!.textContent)).toEqual(['Newer report', 'Older report'])
    expect(screen.getByText('Only reports sent from this browser.')).toBeInTheDocument()
    expect(calls).toEqual([])
  })

  it('checks status only when asked, explains the first check once, and shows the service’s facts', async () => {
    await store.putReport(kept({}))
    act(() => useSupportStore.getState().openReports())
    wrap(<MyReportsDialog />)
    fireEvent.click(await screen.findByRole('button', { name: 'Check for status' }))
    expect(await screen.findByText(/check the status of reports sent from this browser \(1\)/)).toBeInTheDocument()
    expect(calls).toEqual([])
    fireEvent.click(screen.getByRole('button', { name: 'Check' }))
    expect(await screen.findByText('Being looked at')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Check for status' }))
    await waitFor(() => expect(calls.filter((c) => c.path === '/v1/reports/status')).toHaveLength(2))
    expect(screen.queryByText('Check for status?')).toBeNull()
  })

  it('says so when this browser cannot keep reports', async () => {
    resetSupportStoreForTests(new MemoryStore(false))
    act(() => useSupportStore.getState().openReports())
    wrap(<MyReportsDialog />)
    expect(await screen.findByText(/isn’t keeping data for this site/)).toBeInTheDocument()
    expect(screen.getByText('No reports yet')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Send feedback' }))
    expect(useSupportStore.getState().open).toBe('feedback')
  })
})

describe('the entries', () => {
  it('are in the footer on every page, and open the two dialogs', () => {
    wrap(<KLFooter />)
    fireEvent.click(screen.getByRole('button', { name: 'Send Feedback' }))
    expect(useSupportStore.getState().open).toBe('feedback')
    fireEvent.click(screen.getByRole('button', { name: 'My Reports' }))
    expect(useSupportStore.getState().open).toBe('reports')
  })

  it('are buttons on the About page’s support route', () => {
    wrap(<SupportEntries look="buttons" />)
    expect(screen.getByRole('button', { name: 'Send Feedback' })).toHaveClass('btn-primary')
  })

  // Paul, 2026-09-25: the language menu ends with a divider and Suggest Language,
  // which takes the lender to the form (definition entryPoints.web_app.languageMenu).
  it('in the language menu, Suggest Language opens Send Feedback on Language, ready to name one', async () => {
    wrap(<><LanguageMenu /><SupportHost /></>)
    fireEvent.click(screen.getByRole('button', { name: /choose language/i }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Suggest Language' }))
    expect(useSupportStore.getState()).toMatchObject({ open: 'feedback', draft: { kind: 'language' } })
    expect(await screen.findByRole('radio', { name: 'Language' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('searchbox')).toBeInTheDocument()
    expect(send()).toHaveTextContent('Send language request')
    // KivaLens speaks this browser's language, so the form names none (checked once
    // the form is up, since it is the form that would fill one in).
    expect(useSupportStore.getState().draft.language).toBeNull()
  })

  it('in the language menu, Suggest Language arrives with the browser’s language chosen when KivaLens lacks it', async () => {
    browserSays('sw-KE', 'en')
    wrap(<><LanguageMenu /><SupportHost /></>)
    fireEvent.click(screen.getByRole('button', { name: /choose language/i }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Suggest Language' }))
    await screen.findByRole('radio', { name: 'Language' })
    await waitFor(() => expect(send()).toHaveTextContent('Request Swahili'))
    expect(useSupportStore.getState().draft.language).toMatchObject({ code: 'sw' })
    expect(screen.getByText('System')).toBeInTheDocument()
  })

  it('in the language menu, Suggest Language is there in the lender’s own language too', async () => {
    browserSays('de-DE')
    wrap(<LanguageMenu />)
    fireEvent.click(screen.getByRole('button', { name: /sprache|language/i }))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Sprache vorschlagen' }))
    expect(useSupportStore.getState()).toMatchObject({ open: 'feedback', draft: { kind: 'language' } })
  })
})

describe('the thanks', () => {
  it('is announced, stays about four seconds, and asks nothing of the lender', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'], shouldAdvanceTime: true })
    wrap(<SupportHost />)
    act(() => useSupportStore.getState().accepted())
    const region = screen.getByRole('status')
    await waitFor(() => expect(within(region).getByText('Thank you for submitting feedback.')).toBeInTheDocument())
    expect(within(region).queryByRole('button')).toBeNull()
    act(() => vi.advanceTimersByTime(4000))
    expect(within(region).queryByText('Thank you for submitting feedback.')).toBeNull()
  })
})
