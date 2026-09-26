import { useCallback, useEffect, useId, useState } from 'react'
import { Modal } from '../ui'
import { formatRelativeTime, useI18n } from '../i18n'
import { supportDeps } from './runtime'
import { checkStatus, updateContact } from './service'
import type { StoredReport } from './storage'
import { reportHeadline, supportText } from './text'
import { useSupportStore } from './supportStore'

/**
 * My Reports, as every HumansAreUseful app has it (definition screens.myReports,
 * realized for a page dialog by entryPoints.web_app).
 *
 * Only this app's reports from this browser, newest first, each headed by the
 * first line the lender wrote with its date and one factual status. Opening,
 * expanding and switching language make no request; status is checked only
 * when the lender asks, after a once-only note saying what that sends. The
 * reply email is per report: add, change, remove (with a minute to undo a
 * verified one), each confirmed by the service before the row changes.
 */

const FIRST_CHECK_KEY = 'firstCheckAcknowledged'
const LAST_CHECK_KEY = 'lastChecked'
const KIND_LABEL = { bug: 'reports.kind.bug', suggestion: 'reports.kind.suggestion', languageRequest: 'reports.kind.language' } as const

type CheckState = 'idle' | 'checking' | 'offline' | 'partial'

export default function MyReportsDialog() {
  const { locale } = useI18n()
  const s = (key: string, params?: Record<string, string | number>) => supportText(locale, key, params)
  const { close, openFeedback } = useSupportStore()
  const [reports, setReports] = useState<StoredReport[] | null>(null)
  const [persistent, setPersistent] = useState(true)
  const [lastChecked, setLastChecked] = useState<string | null>(null)
  const [check, setCheck] = useState<CheckState>('idle')
  const [confirming, setConfirming] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const titleId = useId()

  // Reads only this browser's own records: no request, no key (definition
  // contactManagement.passiveInspection).
  const read = useCallback(async () => {
    const deps = await supportDeps(locale)
    const list = await deps.store.listReports(deps.facts().appId).catch(() => [])
    list.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    const checked = (await deps.store.getMeta<string>(LAST_CHECK_KEY).catch(() => undefined)) ?? null
    return { list, persistent: deps.store.persistent, checked }
  }, [locale])

  const load = useCallback(async () => {
    const { list, persistent, checked } = await read()
    setReports(list)
    setPersistent(persistent)
    setLastChecked(checked)
  }, [read])

  useEffect(() => {
    let live = true
    read().then(({ list, persistent, checked }) => {
      if (!live) return
      setReports(list)
      setPersistent(persistent)
      setLastChecked(checked)
    })
    return () => {
      live = false
    }
  }, [read])

  const runCheck = async () => {
    setConfirming(false)
    setCheck('checking')
    const deps = await supportDeps(locale)
    await deps.store.setMeta(FIRST_CHECK_KEY, true).catch(() => undefined)
    const list = reports ?? []
    const outcomes = await Promise.all(list.map((report) => checkStatus(deps, report)))
    const transport = outcomes.filter((o) => !o.ok && o.kind === 'transport').length
    const failed = outcomes.filter((o) => !o.ok).length
    if (failed < list.length || list.length === 0) {
      const now = new Date().toISOString()
      await deps.store.setMeta(LAST_CHECK_KEY, now).catch(() => undefined)
    }
    await load()
    setCheck(transport === list.length && list.length > 0 ? 'offline' : failed > 0 ? 'partial' : 'idle')
  }

  const askToCheck = async () => {
    const deps = await supportDeps(locale)
    const acknowledged = await deps.store.getMeta<boolean>(FIRST_CHECK_KEY).catch(() => undefined)
    if (acknowledged) void runCheck()
    else setConfirming(true)
  }

  const replace = (next: StoredReport) =>
    setReports((current) => current?.map((r) => (r.reportCode === next.reportCode ? next : r)) ?? current)

  const when = (iso: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))

  return (
    <Modal show onHide={close} size="lg" className="kl-support-dialog">
      <Modal.Header closeButton>
        <Modal.Title id={titleId}>{s('reports.title')}</Modal.Title>
      </Modal.Header>
      {/* The body owns the space between its parts (rule 3): none of them carries a margin. */}
      <Modal.Body className="d-flex flex-column gap-3">
        <p className="text-muted small mb-0">{s('reports.subtitle')}</p>
        {!persistent && <div className="alert alert-warning py-2 small mb-0">{s('reports.storageUnavailable')}</div>}

        {reports && reports.length > 0 && (
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <span className="small text-muted me-auto" role="status" aria-live="polite">
              {check === 'offline'
                ? s('reports.offline')
                : lastChecked
                  ? s('reports.lastChecked', { when: formatRelativeTime(locale, lastChecked) })
                  : s('reports.neverChecked')}
            </span>
            <button type="button" className="btn btn-outline-primary btn-sm" disabled={check === 'checking'} onClick={() => void askToCheck()}>
              {check === 'checking' ? s('reports.checking') : s('reports.check')}
            </button>
          </div>
        )}
        {check === 'partial' && <div className="alert alert-warning py-2 small mb-0">{s('reports.partialError')}</div>}

        {confirming && (
          <div className="card" role="group" aria-labelledby={`${titleId}-confirm`}>
            <div className="card-body">
              <h5 id={`${titleId}-confirm`} className="card-title">{s('reports.check.firstTime.title')}</h5>
              <p className="card-text">{s('reports.check.firstTime.body', { count: reports?.length ?? 0 })}</p>
              <div className="d-flex gap-2 justify-content-end">
                <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setConfirming(false)}>
                  {s('common.cancel')}
                </button>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => void runCheck()}>
                  {s('reports.check.confirm')}
                </button>
              </div>
            </div>
          </div>
        )}

        {reports && reports.length === 0 && (
          <div className="text-center py-4">
            <h5>{s('reports.empty.title')}</h5>
            <p className="text-muted">{s('reports.empty.body')}</p>
            <button type="button" className="btn btn-primary" onClick={() => openFeedback()}>
              {s('reports.empty.action')}
            </button>
          </div>
        )}

        {reports && reports.length > 0 && (
          <ul className="list-group kl-support-reports">
            {reports.map((report) => {
              const open = expanded === report.reportCode
              const outcome = report.outcome ?? 'unavailable'
              const statusParams = report.fixedVersion ? { version: report.fixedVersion } : undefined
              const headline = reportHeadline(report.message) || `${s(KIND_LABEL[report.kind])} · ${when(report.createdAt)}`
              return (
                <li key={report.reportCode} className="list-group-item d-flex flex-column gap-2">
                  <button
                    type="button"
                    className="kl-support-report-head btn btn-link text-start text-decoration-none p-0 w-100"
                    aria-expanded={open}
                    onClick={() => setExpanded(open ? null : report.reportCode)}
                  >
                    <span className="kl-support-report-line" title={report.message || undefined}>{headline}</span>
                    <span className="kl-support-report-meta small text-muted">
                      {when(report.createdAt)} · <span title={s(`reports.status.${outcome}.help`, statusParams)}>{s(`reports.status.${outcome}`, statusParams)}</span>
                    </span>
                  </button>
                  {open && <ReportDetail report={report} onChange={replace} />}
                </li>
              )
            })}
          </ul>
        )}
      </Modal.Body>
      <Modal.Footer>
        <button type="button" className="btn btn-primary" onClick={close}>
          {s('common.close')}
        </button>
      </Modal.Footer>
    </Modal>
  )
}

type Composer = { mode: 'add' | 'change'; email: string; consent: boolean; error: string | null; saving: boolean }

function ReportDetail({ report, onChange }: { report: StoredReport; onChange: (next: StoredReport) => void }) {
  const { locale } = useI18n()
  const s = (key: string, params?: Record<string, string | number>) => supportText(locale, key, params)
  const [composer, setComposer] = useState<Composer | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ key: string; undo: boolean } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const outcome = report.outcome ?? 'unavailable'
  const statusParams = report.fixedVersion ? { version: report.fixedVersion } : undefined
  const contact = report.contact
  const ids = { email: useId(), consent: useId() }

  // `reportChanged`: the report moved on since the last check (app-services
  // report-contact.ts); the lender checks status, then tries again.
  const failureKey = (code?: string) => (code === 'reportChanged' ? 'reports.email.conflict' : 'reports.email.failed')

  const act = async (action: 'remove' | 'undo') => {
    setBusy(true)
    setError(null)
    const deps = await supportDeps(locale)
    const outcome = await updateContact(deps, report, action)
    setBusy(false)
    if (!outcome.ok) {
      setError(action === 'undo' ? 'reports.email.undoFailed' : failureKey(outcome.kind === 'service' ? outcome.error.code : undefined))
      return
    }
    onChange(outcome.payload)
    // Undo is offered only for an address that was verified (definition
    // contactManagement.undoRequiresPreviouslyVerifiedEmail), for its minute.
    setNotice(action === 'remove' ? { key: 'reports.email.removedFromReport', undo: contact?.state === 'verified' } : { key: 'reports.email.restored', undo: false })
  }

  const submitEmail = async () => {
    if (!composer) return
    const email = composer.email.trim()
    if (!composer.consent || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setComposer({ ...composer, error: 'feedback.invalidEmail' })
      return
    }
    setComposer({ ...composer, saving: true, error: null })
    const deps = await supportDeps(locale)
    const outcome = await updateContact(deps, report, 'set', email)
    if (!outcome.ok) {
      setComposer({ ...composer, saving: false, error: failureKey(outcome.kind === 'service' ? outcome.error.code : undefined) })
      return
    }
    onChange(outcome.payload)
    setComposer(null)
    setNotice({ key: 'reports.verifyPending', undo: false })
  }

  const emailLine = !contact
    ? s('reports.email.unknown')
    : contact.state === 'verified' && contact.email
      ? s('reports.email.verified', { email: contact.email })
      : contact.state === 'pending' && contact.pendingEmail
        ? s('reports.email.pending', { email: contact.pendingEmail })
        : s('reports.email.none')

  return (
    <div className="kl-support-report-detail">
      <div className="small text-muted">{s('reports.detail.yourReport')}</div>
      {report.message ? (
        <p className="kl-support-report-text">{report.message}</p>
      ) : (
        <p className="text-muted small">{s('reports.detail.unavailable')}</p>
      )}
      <div className="small text-muted">{s('reports.detail.status')}</div>
      <p className="mb-2">
        {s(`reports.status.${outcome}`, statusParams)}
        <span className="d-block small text-muted">{s(`reports.status.${outcome}.help`, statusParams)}</span>
      </p>
      <div className="small text-muted">{s('reports.detail.email')}</div>
      {/* The email line and what follows it (a notice, an error, the form) share one gap. */}
      <div className="d-flex flex-column gap-2">
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <span className="me-auto">{emailLine}</span>
          {contact && !composer && (
            <>
              {(contact.state === 'none' || contact.state === 'removed') && (
                <button type="button" className="btn btn-outline-primary btn-sm" disabled={busy} onClick={() => setComposer({ mode: 'add', email: '', consent: false, error: null, saving: false })}>
                  {s('reports.email.add')}
                </button>
              )}
              {(contact.state === 'verified' || contact.state === 'pending') && (
                <>
                  <button type="button" className="btn btn-outline-secondary btn-sm" disabled={busy} onClick={() => setComposer({ mode: 'change', email: '', consent: false, error: null, saving: false })}>
                    {s('reports.email.change')}
                  </button>
                  <button type="button" className="btn btn-outline-secondary btn-sm" disabled={busy} onClick={() => void act('remove')}>
                    {busy ? s('reports.email.saving') : s('reports.email.remove')}
                  </button>
                </>
              )}
            </>
          )}
        </div>
        {notice && (
          <div className="small" role="status">
            {s(notice.key)}{' '}
            {notice.undo && (
              <button type="button" className="btn btn-link btn-sm p-0 align-baseline" disabled={busy} onClick={() => void act('undo')}>
                {s('reports.email.undo')}
              </button>
            )}
          </div>
        )}
        {error && <div className="small text-danger" role="alert">{s(error)}</div>}
        {composer && (
          <div className="card">
            {/* The form's body owns the space between its parts (rule 3). */}
            <div className="card-body d-flex flex-column gap-2">
              <h6 className="card-title mb-0">{s(composer.mode === 'change' ? 'reports.addEmail.changeTitle' : 'reports.addEmail.title')}</h6>
              <p className="small mb-0">{s(composer.mode === 'change' ? 'reports.addEmail.changeBody' : 'reports.addEmail.body')}</p>
              <div className="form-check mb-0">
                <input id={ids.consent} className="form-check-input" type="checkbox" checked={composer.consent} onChange={(e) => setComposer({ ...composer, consent: e.target.checked })} />
                <label className="form-check-label" htmlFor={ids.consent}>{s('feedback.consent')}</label>
              </div>
              <label className="form-label mb-0" htmlFor={ids.email}>{s('reports.addEmail.field')}</label>
              <input
                id={ids.email}
                className="form-control"
                type="email"
                autoComplete="email"
                placeholder={s('feedback.email.placeholder')}
                value={composer.email}
                onChange={(e) => setComposer({ ...composer, email: e.target.value, error: null })}
              />
              {composer.error && <div className="small text-danger" role="alert">{s(composer.error)}</div>}
              <div className="d-flex gap-2 justify-content-end">
                <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setComposer(null)}>
                  {s('common.cancel')}
                </button>
                <button type="button" className="btn btn-primary btn-sm" disabled={composer.saving || !composer.consent || !composer.email.trim()} onClick={() => void submitEmail()}>
                  {composer.saving ? s('reports.email.saving') : composer.error ? s('common.retry') : s('reports.addEmail.send')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
