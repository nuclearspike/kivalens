import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Form, Modal } from '../ui'
import { getKivaLoans } from '../api/kiva'
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

  useEffect(() => {
    setInput(lenderId)
    setChecking(false)
    setFailed(false)
  }, [lenderId, show])

  useEffect(() => {
    const win = window as Window & { showLenderIDModal?: () => void }
    win.showLenderIDModal = showLenderIDModal
    return () => {
      delete win.showLenderIDModal
    }
  }, [])

  const trimmed = input.trim()
  const badRegEx = useMemo(() => trimmed.length > 0 && !lenderIdTester.test(trimmed), [trimmed])

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
