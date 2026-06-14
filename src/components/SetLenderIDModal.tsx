import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Form, Modal } from '../ui'
import { getKivaLoans } from '../api/kiva'
import { companion, companionEnabled } from '../api/companion'
import { showLenderIDModal } from '../lib/showLenderIdModal'
import { useUtilsStore } from '../stores'

const lenderIdTester = /^[a-z0-9]{0,24}$/i

function KivaLink({ path, children }: { path: string; children: React.ReactNode }) {
  return (
    <a href={`https://www.kiva.org/${path}`} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  )
}

export default function SetLenderIDModal() {
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

  useEffect(() => {
    setInput(lenderId)
    setChecking(false)
    setFailed(false)
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
    setCompanionBusy(true)
    setCompanionNote(null)
    setFailed(false)
    try {
      const status = await companion.getStatus().catch(() => null)
      if (status && !status.hasToken) {
        setCompanionNote(
          'The Companion is installed but not authenticated yet. Open kiva.org in another tab and log in, then try again.',
        )
        return
      }
      const lender = await companion.detectLender()
      if (!lender) {
        setCompanionNote('Could not read your Kiva account. Make sure you are logged in at kiva.org, then try again.')
        return
      }
      // Pass only the id so the standard pipeline fetches the FULL lender object
      // (image, member_since, location, invitee_count) - same as manual entry.
      setLenderId(lender.lender_id)
      closeModal()
    } catch (e) {
      setCompanionNote('Companion error: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setCompanionBusy(false)
    }
  }

  const handleSave = async () => {
    if (!trimmed || badRegEx || checking) return

    setChecking(true)
    setFailed(false)
    try {
      const lender = await getKivaLoans()?.fetchLender(trimmed)
      if (!lender) {
        setFailed(true)
        return
      }
      setLenderId(lender.lender_id, lender)
      closeModal()
    } catch {
      setFailed(true)
    } finally {
      setChecking(false)
    }
  }

  return (
    <Modal show={show} onHide={closeModal}>
      <Modal.Header closeButton>
        <Modal.Title>Set Kiva Lender ID</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <Form.Label style={{ marginBottom: 6 }}>Kiva Lender ID</Form.Label>
        <Form.Control
          autoFocus
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value)
            setFailed(false)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void handleSave()
            }
          }}
          placeholder="Letters and numbers only"
        />
        <p style={{ marginTop: 10 }}>
          Your Kiva Lender ID is not your email address.{' '}
          <KivaLink path="myLenderId">Click here if you don&apos;t know yours.</KivaLink>
        </p>

        {companionEnabled ? (
          <>
            <hr />
            {companionAvailable ? (
              <div>
                <p style={{ marginBottom: 6 }}>
                  <b>KivaLens Companion detected.</b> Detect your Lender ID automatically from your
                  logged-in Kiva session — no typing required.
                </p>
                <Button
                  variant="outline-primary"
                  onClick={() => void handleDetect()}
                  disabled={companionBusy}
                >
                  {companionBusy ? 'Detecting…' : 'Detect with Companion'}
                </Button>
              </div>
            ) : (
              <p style={{ marginBottom: 6, color: '#6b7280' }}>
                Install the <b>KivaLens Companion</b> extension to auto-detect your Lender ID.
              </p>
            )}
            {companionNote ? (
              <Alert variant="info" style={{ marginTop: 10 }}>
                {companionNote}
              </Alert>
            ) : null}
          </>
        ) : null}
        {checking ? <Alert variant="info">Checking with Kiva...</Alert> : null}
        {failed || badRegEx ? (
          <Alert variant="danger">
            Invalid Lender ID
            {badRegEx ? ': Only letters and numbers up to 24 characters allowed.' : ''}
          </Alert>
        ) : null}
      </Modal.Body>

      <Modal.Footer>
        <Button onClick={() => void handleSave()} disabled={badRegEx || !trimmed || checking}>
          Set Lender ID
        </Button>
        <Button variant="outline-secondary" onClick={closeModal}>
          Cancel
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
