import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Modal, Segmented } from '../ui'
import CopyButton from '../components/CopyButton'
import { useI18n, browserLanguageTags } from '../i18n'
import { APP_NAME } from './facts'
import { languageTitle, requestableLanguages, unsupportedBrowserLanguage } from './languages'
import { supportDeps } from './runtime'
import { submitFeedback } from './service'
import { SUPPORT_CATALOG, supportText } from './text'
import { useSupportStore, type FeedbackKindId } from './supportStore'
import type { ClientFacts } from './protocol'

/**
 * Send Feedback, as every HumansAreUseful app has it (definition 1.1.21,
 * screens.feedback, realized for a page dialog by entryPoints.web_app).
 *
 * One entry, the kind chosen inside: Idea, Bug or Language. Switching kind keeps
 * what was written. Send stays visible in the footer and is disabled until the
 * report is valid; Ctrl/Cmd+Enter sends. What is sent is shown before it is
 * sent (Show details), exactly. On acceptance the dialog closes and a brief
 * thanks appears; on any failure the draft stays, with Retry, Copy and Discard.
 */

const KIND_TO_WIRE = { idea: 'suggestion', bug: 'bug', language: 'languageRequest' } as const
const MIN = SUPPORT_CATALOG.feedback.minimumCharacters
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type Failure = { key: string; upgrade: boolean }

function languageName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'language' }).of(code) ?? code
  } catch {
    return code
  }
}

export default function FeedbackDialog() {
  const { locale } = useI18n()
  const s = (key: string, params?: Record<string, string | number>) => supportText(locale, key, params)
  const { draft, setDraft, close, discardDraft, accepted } = useSupportStore()
  const [sending, setSending] = useState(false)
  const [failure, setFailure] = useState<Failure | null>(null)
  const [touched, setTouched] = useState(false)
  const [facts, setFacts] = useState<ClientFacts | null>(null)
  const [query, setQuery] = useState('')
  const messageRef = useRef<HTMLTextAreaElement>(null)
  const ids = { message: useId(), email: useId(), language: useId(), note: useId(), details: useId(), status: useId() }

  const systemLanguage = browserLanguageTags()[0] ?? locale
  const systemRequest = useMemo(() => unsupportedBrowserLanguage(browserLanguageTags()), [])

  useEffect(() => {
    let live = true
    supportDeps(locale).then((deps) => live && setFacts(deps.facts()))
    return () => {
      live = false
    }
  }, [locale])

  // The Language kind starts from the browser's own language when KivaLens does
  // not speak it, however the lender arrived (the language menu's Suggest
  // Language included), and never replaces a language already chosen.
  useEffect(() => {
    if (draft.kind !== 'language' || draft.language || !systemRequest) return
    setDraft({ language: { code: systemRequest, label: languageTitle(systemRequest, locale) } })
  }, [draft.kind, draft.language, systemRequest, locale, setDraft])

  useEffect(() => {
    if (draft.kind !== 'language') messageRef.current?.focus()
  }, [draft.kind])

  const email = draft.email.trim()
  // The address is optional even with consent (the native composer sends
  // without one); only a malformed address stops the send.
  const emailInvalid = draft.consent && email.length > 0 && !EMAIL.test(email)
  const bodyValid =
    draft.kind === 'language' ? Boolean(draft.language?.label.trim()) : draft.message.trim().length >= MIN
  const valid = bodyValid && !emailInvalid
  const withEmail = draft.consent && EMAIL.test(email)

  const languageLabel = draft.language?.code ? languageName(draft.language.code, locale) : draft.language?.label ?? ''
  const sendLabel =
    draft.kind === 'language'
      ? draft.language
        ? s('feedback.send.language', { language: languageLabel })
        : s('feedback.send.languageUnselected')
      : s(draft.kind === 'bug' ? 'feedback.send.bug' : 'feedback.send.idea')

  /**
   * Exactly the words sent. A language request is written the way the native
   * composer writes it, in the page's language: the request, then any note.
   */
  const wireMessage = () => {
    if (draft.kind !== 'language') return draft.message.trim()
    const request = s('feedback.send.language', { language: languageLabel })
    const note = draft.languageNote.trim()
    return note ? `${request}\n\n${note}` : request
  }

  const send = async () => {
    setTouched(true)
    if (!valid || sending || failure?.upgrade) return
    setSending(true)
    setFailure(null)
    try {
      const deps = await supportDeps(locale)
      const outcome = await submitFeedback(deps, {
        kind: KIND_TO_WIRE[draft.kind],
        message: wireMessage(),
        systemLanguage,
        ...(withEmail ? { email } : {}),
      })
      if (outcome.ok) {
        accepted()
        return
      }
      if (outcome.kind === 'transport') setFailure({ key: 'feedback.failedDetail', upgrade: false })
      else if (outcome.error.code === 'upgrade_required') setFailure({ key: 'feedback.upgradeRequired', upgrade: true })
      else if (outcome.error.retryable && outcome.status >= 500) setFailure({ key: 'feedback.failedDetail', upgrade: false })
      else setFailure({ key: 'feedback.serviceUnavailable', upgrade: false })
    } catch {
      setFailure({ key: 'feedback.failedDetail', upgrade: false })
    } finally {
      setSending(false)
    }
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      void send()
    }
  }

  const choices = useMemo(() => requestableLanguages(locale), [locale])
  const q = query.trim().toLowerCase()
  const matches = q ? choices.filter((c) => c.title.toLowerCase().includes(q) || c.code.toLowerCase() === q) : choices

  const kinds: FeedbackKindId[] = ['idea', 'bug', 'language']
  const summary = facts
    ? s(withEmail ? 'feedback.willSend.withEmail' : 'feedback.willSend', {
        app: APP_NAME,
        version: facts.appVersion,
        os: facts.osVersion,
      })
    : ''

  return (
    <Modal show onHide={close} size="lg" className="kl-support-dialog">
      <div className="kl-support-frame" onKeyDown={onKeyDown}>
        <Modal.Header closeButton>
          <Modal.Title>{s('feedback.title')}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="mb-3">
            <Segmented
              className="kl-support-kinds"
              label={s('feedback.title')}
              value={draft.kind}
              onChange={(kind) => setDraft({ kind })}
              options={kinds.map((kind) => ({ value: kind, label: s(`feedback.kind.${kind}`) }))}
            />
          </div>

          {draft.kind === 'language' ? (
            <>
              <label className="form-label" htmlFor={ids.language}>
                {s('feedback.language.field')}
              </label>
              {/* Always present, so choosing a language never pushes the search down. */}
              <div className="kl-support-chosen mb-2" aria-live="polite">
                {draft.language ? (
                  <>
                    <strong lang={draft.language.code ?? undefined}>{draft.language.label}</strong>
                    {draft.language.code && draft.language.code === systemRequest && (
                      <span className="badge bg-secondary ms-2">{s('feedback.language.system')}</span>
                    )}
                  </>
                ) : (
                  <span className="text-muted">—</span>
                )}
              </div>
              <input
                id={ids.language}
                className="form-control"
                type="search"
                autoFocus
                placeholder={s('feedback.language.other')}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-controls={`${ids.language}-list`}
              />
              <div id={`${ids.language}-list`} className="list-group kl-support-languages mt-1" role="listbox" aria-label={s('feedback.language.other')}>
                {q && !choices.some((c) => c.title.toLowerCase() === q) && (
                  <button
                    type="button"
                    role="option"
                    aria-selected={false}
                    className="list-group-item list-group-item-action"
                    onClick={() => {
                      setDraft({ language: { code: null, label: query.trim() } })
                      setQuery('')
                    }}
                  >
                    {s('feedback.language.useTyped', { typed: query.trim() })}
                  </button>
                )}
                {matches.map((choice) => (
                  <button
                    key={choice.code}
                    type="button"
                    role="option"
                    aria-selected={draft.language?.code === choice.code}
                    className={`list-group-item list-group-item-action${draft.language?.code === choice.code ? ' active' : ''}`}
                    onClick={() => {
                      setDraft({ language: { code: choice.code, label: choice.title } })
                      setQuery('')
                    }}
                  >
                    {choice.title}
                  </button>
                ))}
              </div>
              <label className="form-label mt-3" htmlFor={ids.note}>
                {s('feedback.language.note')}
              </label>
              <textarea
                id={ids.note}
                className="form-control kl-support-text"
                rows={2}
                value={draft.languageNote}
                onChange={(e) => setDraft({ languageNote: e.target.value })}
              />
            </>
          ) : (
            <>
              <label className="form-label" htmlFor={ids.message}>
                {s(draft.kind === 'bug' ? 'feedback.prompt.bug' : 'feedback.prompt.idea')}
              </label>
              <textarea
                id={ids.message}
                ref={messageRef}
                className="form-control kl-support-text"
                rows={5}
                autoFocus
                placeholder={s(draft.kind === 'bug' ? 'feedback.placeholder.bug' : 'feedback.placeholder.idea')}
                value={draft.message}
                aria-invalid={touched && !bodyValid}
                aria-describedby={touched && !bodyValid ? `${ids.message}-hint` : undefined}
                onChange={(e) => setDraft({ message: e.target.value })}
              />
              {touched && !bodyValid && (
                <div id={`${ids.message}-hint`} className="form-text text-danger">
                  {s('feedback.validation.minimum')}
                </div>
              )}
            </>
          )}

          <p className="text-muted small mt-3 mb-2">{s('feedback.privacyWarning')}</p>

          <div className="kl-support-contact">
            <div className="form-check">
              <input
                id={`${ids.email}-consent`}
                className="form-check-input"
                type="checkbox"
                checked={draft.consent}
                onChange={(e) => setDraft({ consent: e.target.checked })}
              />
              <label className="form-check-label" htmlFor={`${ids.email}-consent`}>
                {s('feedback.consent')}
              </label>
            </div>
            {draft.consent && (
              <div className="kl-support-email">
                <label className="form-label mb-0" htmlFor={ids.email}>
                  {s('feedback.optionalEmail')}
                </label>
                <input
                  id={ids.email}
                  className="form-control"
                  type="email"
                  autoComplete="email"
                  placeholder={s('feedback.email.placeholder')}
                  value={draft.email}
                  aria-invalid={emailInvalid}
                  onChange={(e) => setDraft({ email: e.target.value })}
                />
                <div className={`form-text${emailInvalid ? ' text-danger' : ''}`}>
                  {emailInvalid ? s('feedback.invalidEmail') : s('feedback.emailDetail')}
                </div>
              </div>
            )}
          </div>

          {facts && (
            <div className="kl-support-willsend mt-3">
              <div className="small">{summary}</div>
              <button
                type="button"
                className="btn btn-link btn-sm p-0"
                aria-expanded={draft.detailsOpen}
                aria-controls={ids.details}
                onClick={() => setDraft({ detailsOpen: !draft.detailsOpen })}
              >
                <span aria-hidden="true" className="kl-support-disclosure">{draft.detailsOpen ? '▾' : '▸'}</span>{' '}
                {s('feedback.willSend.details')}
              </button>
              {draft.detailsOpen && (
                <dl id={ids.details} className="kl-support-facts small mb-0">
                  <dt>{s('facts.app')}</dt>
                  <dd>{`${APP_NAME} ${facts.appVersion} (${s('facts.build')} ${facts.appBuild})`}</dd>
                  <dt>{s('facts.distribution')}</dt>
                  <dd>{s(`facts.distribution.${facts.distribution}`)}</dd>
                  <dt>{s('facts.feedbackSoftware')}</dt>
                  <dd>{`${facts.sdk.family} ${facts.sdk.version}`}</dd>
                  <dt>{s('facts.platform')}</dt>
                  <dd>{facts.osVersion}</dd>
                  <dt>{s('facts.architecture')}</dt>
                  <dd>{s('facts.architecture.unknown')}</dd>
                  <dt>{s('facts.locale')}</dt>
                  <dd>{`${languageName(facts.locale, locale)} (${facts.locale})`}</dd>
                  <dt>{s('facts.systemLanguage')}</dt>
                  <dd>{`${languageName(systemLanguage, locale)} (${systemLanguage})`}</dd>
                </dl>
              )}
            </div>
          )}
          <p className="text-muted small mt-2 mb-0">{s('feedback.processingNote')}</p>
        </Modal.Body>
        <Modal.Footer className="kl-support-actions">
          <div id={ids.status} className="kl-support-status me-auto small" role="status" aria-live="polite">
            {failure && (
              <>
                <strong>{s('feedback.failed')}</strong> {s(failure.key)}
              </>
            )}
          </div>
          {failure ? (
            <>
              <button type="button" className="btn btn-outline-secondary" onClick={discardDraft}>
                {s('common.discard')}
              </button>
              <CopyButton text={wireMessage()} label={s('common.copy')} variant="outline-secondary" />
              {!failure.upgrade && (
                <button type="button" className="btn btn-primary" disabled={sending} onClick={() => void send()}>
                  {sending ? s('common.submitting') : s('common.retry')}
                </button>
              )}
            </>
          ) : (
            <>
              <button type="button" className="btn btn-outline-secondary" onClick={discardDraft}>
                {s('common.cancel')}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!valid || sending}
                aria-describedby={ids.status}
                onClick={() => void send()}
              >
                {sending ? s('common.submitting') : sendLabel}
              </button>
            </>
          )}
        </Modal.Footer>
      </div>
    </Modal>
  )
}
