import { useEffect, useRef } from 'react'
import { Modal, Button } from '../ui'
import { useDialogStore } from '../lib/dialog'

/**
 * Renders the active imperative dialog (showAlert / showConfirm / showPrompt)
 * as a styled modal. Mount once at the app root.
 */
export default function DialogHost() {
  const current = useDialogStore((s) => s.current)
  const resolveCurrent = useDialogStore((s) => s.resolveCurrent)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)

  // Focus + select the prompt field once the modal paints (no setState here,
  // so it stays out of the render path).
  useEffect(() => {
    if (current?.kind !== 'prompt') return
    const t = setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 30)
    return () => clearTimeout(t)
  }, [current])

  if (!current) return null

  const confirm = () => {
    if (current.kind === 'prompt') resolveCurrent(inputRef.current?.value ?? '')
    else resolveCurrent(true)
  }
  const cancel = () => {
    // alert has no cancel; confirm -> false; prompt -> null
    resolveCurrent(current.kind === 'prompt' ? null : false)
  }
  // alert dismisses to "ok"; confirm/prompt dismiss = cancel
  const onHide = () => (current.kind === 'alert' ? confirm() : cancel())

  return (
    <Modal show onHide={onHide}>
      {current.title ? (
        <Modal.Header closeButton>
          <Modal.Title>{current.title}</Modal.Title>
        </Modal.Header>
      ) : null}
      <Modal.Body>
        <div style={{ whiteSpace: 'pre-wrap' }}>{current.message}</div>
        {current.kind === 'prompt' ? (
          current.multiline ? (
            <textarea
              key={current.id}
              ref={inputRef as React.RefObject<HTMLTextAreaElement>}
              className="form-control mt-2"
              rows={5}
              defaultValue={current.defaultValue ?? ''}
              style={{ fontFamily: 'monospace', fontSize: 12 }}
            />
          ) : (
            <input
              key={current.id}
              ref={inputRef as React.RefObject<HTMLInputElement>}
              type="text"
              className="form-control mt-2"
              defaultValue={current.defaultValue ?? ''}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  confirm()
                }
              }}
            />
          )
        ) : null}
      </Modal.Body>
      <Modal.Footer>
        {current.cancelLabel ? (
          <Button variant="outline-secondary" onClick={cancel}>
            {current.cancelLabel}
          </Button>
        ) : null}
        <Button variant={current.danger ? 'danger' : 'success'} onClick={confirm}>
          {current.confirmLabel}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
