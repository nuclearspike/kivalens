import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Button, Form, Modal } from '../ui'
import { getKivaLoans } from '../api/kiva'
import { companion, companionEnabled } from '../api/companion'
import { showLenderIDModal } from '../lib/showLenderIdModal'
import { useUtilsStore } from '../stores'
import { useI18n } from '../i18n'

const lenderIdTester = /^[a-z0-9]{0,24}$/i

function KivaLink({ path, children }: { path: string; children: React.ReactNode }) {
  return (
    <a href={`https://www.kiva.org/${path}`} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  )
}

export default function SetLenderIDModal() {
  const { t } = useI18n()
  const show = useUtilsStore((s) => s.lenderModalOpen)
  const lenderId = useUtilsStore((s) => s.lenderId)
  const closeModal = useUtilsStore((s) => s.closeLenderIdModal)
  const setLenderId = useUtilsStore((s) => s.setLenderId)
  const [input, setInput] = useState(lenderId)
  const [checking, setChecking] = useState(false)
  const [failed, setFailed] = useState(false)
  const [companionAvailable, setCompanionAvailable] = useState(false)
  const [companionBusy, setCompanionBusy] = useState(false)
  const [companionNote, setCompanionNote] = useState<string | null>(null)

  // Each Save or Detect is one ask. Closing or reopening the dialog, typing, or asking again
  // supersedes it: an answer that comes back after that installs no lender and closes nothing.
  const ask = useRef(0)
  useEffect(() => {
    ask.current++
    setInput(lenderId)
    setChecking(false)
    setFailed(false)
    setCompanionBusy(false)
    setCompanionNote(null)
  }, [lenderId, show])

  // Feature-detect the Companion when the modal opens (only if the integration is enabled).
  useEffect(() => {
    if (!companionEnabled || !show) return
    setCompanionNote(null)
    let active = true
    void companion.ping().then((ok) => {
      if (active) setCompanionAvailable(ok)
    })
    return () => {
      active = false
    }
  }, [show])

  useEffect(() => {
    const win = window as Window & { showLenderIDModal?: () => void }
    win.showLenderIDModal = showLenderIDModal
    return () => {
      delete win.showLenderIDModal
    }
  }, [])

  const trimmed = input.trim()
  const badRegEx = useMemo(() => trimmed.length > 0 && !lenderIdTester.test(trimmed), [trimmed])

  const handleDetect = async () => {
    if (companionBusy) return
    const mine = ++ask.current
    const current = () => ask.current === mine
    // A Save under way is superseded: its answer is dropped, so it no longer shows as checking.
    setChecking(false)
    setCompanionBusy(true)
    setCompanionNote(null)
    setFailed(false)
    try {
      const status = await companion.getStatus().catch(() => null)
      if (!current()) return
      if (status && !status.hasToken) {
        setCompanionNote(
          t('companion_installed_but_not'),
        )
        return
      }
      const lender = await companion.detectLender()
      if (!current()) return
      if (!lender) {
        setCompanionNote(t('could_not_read_kiva_account'))
        return
      }
      // Pass only the id so the standard pipeline fetches the FULL lender object
      // (image, member_since, location, invitee_count) - same as manual entry.
      setLenderId(lender.lender_id)
      closeModal()
    } catch (e) {
      if (current()) setCompanionNote(t('companion_error_message', { message: e instanceof Error ? e.message : String(e) }))
    } finally {
      if (current()) setCompanionBusy(false)
    }
  }

  const handleSave = async () => {
    if (!trimmed || badRegEx || checking) return

    const mine = ++ask.current
    const current = () => ask.current === mine
    // A Detect under way is superseded the same way.
    setCompanionBusy(false)
    setChecking(true)
    setFailed(false)
    try {
      const lender = await getKivaLoans()?.fetchLender(trimmed)
      if (!current()) return
      if (!lender) {
        setFailed(true)
        return
      }
      setLenderId(lender.lender_id, lender)
      closeModal()
    } catch {
      if (current()) setFailed(true)
    } finally {
      if (current()) setChecking(false)
    }
  }

  return (
    <Modal show={show} onHide={closeModal}>
      <Modal.Header closeButton>
        <Modal.Title>{t('set_kiva_lender_id')}</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <Form.Label style={{ marginBottom: 6 }}>{t('kiva_lender_id')}</Form.Label>
        <Form.Control
          autoFocus
          type="text"
          value={input}
          onChange={(e) => {
            ask.current++
            setInput(e.target.value)
            setFailed(false)
            setChecking(false)
            setCompanionBusy(false)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void handleSave()
            }
          }}
          placeholder={t('letters_numbers_only')}
        />
        <p style={{ marginTop: 10 }}>
          {t('kiva_lender_id_not_email')}{' '}
          <KivaLink path="myLenderId">{t('click_here_if_dont_know')}</KivaLink>
        </p>

        {companionEnabled ? (
          <>
            <hr />
            {companionAvailable ? (
              <div>
                <p style={{ marginBottom: 6 }}>
                   {t('kivalens_companion_detected_detect')}
                </p>
                <Button
                  variant="outline-primary"
                  onClick={() => void handleDetect()}
                  disabled={companionBusy}
                >
                  {companionBusy ? t('detecting_ellipsis') : t('detect_companion')}
                </Button>
              </div>
            ) : (
              <p style={{ marginBottom: 6, color: 'var(--kl-text-muted)' }}>
                 {t('install_kivalens_companion_extension')}
              </p>
            )}
            {companionNote ? (
              <Alert variant="info" style={{ marginTop: 10 }}>
                {companionNote}
              </Alert>
            ) : null}
          </>
        ) : null}
        {checking ? <Alert variant="info">{t('checking_kiva_ellipsis')}</Alert> : null}
        {failed || badRegEx ? (
          <Alert variant="danger">
            {t('invalid_lender_id')}
            {badRegEx ? `: ${t('only_letters_numbers_up_24')}` : ''}
          </Alert>
        ) : null}
      </Modal.Body>

      <Modal.Footer>
        {/* The other way out: take the saved ID back off, from where it was set. */}
        {lenderId ? (
          <Button
            variant="outline-secondary"
            className="me-auto"
            aria-label={t('clear_lender_id')}
            onClick={() => {
              setLenderId('')
              closeModal()
            }}
          >
            {t('clear')}
          </Button>
        ) : null}
        <Button onClick={() => void handleSave()} disabled={badRegEx || !trimmed || checking}>
           {t('set_lender_id')}
        </Button>
        <Button variant="outline-secondary" onClick={closeModal}>
           {t('cancel')}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
