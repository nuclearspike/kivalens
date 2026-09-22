import type { ComponentPropsWithoutRef, MouseEvent, ReactNode } from 'react'
import { createContext, useContext, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { cx } from './types'
import { useI18n } from '../i18n'

const ModalContext = createContext<{ onHide?: () => void }>({})

// The platforms' default double-click interval (Windows and macOS both ship 500 ms).
// A modal opened by the first click of a double-click appears under the pointer, so
// the second click lands on its backdrop: that press belongs to the double-click and
// is not a request to close. Later presses on the backdrop close it as usual.
const DOUBLE_CLICK_MS = 500

type ModalProps = {
  show: boolean
  onHide?: () => void
  size?: 'sm' | 'lg'
  backdrop?: boolean | 'static'
  className?: string
  children?: ReactNode
}

function ModalRoot({
  show,
  onHide,
  size,
  backdrop = true,
  className,
  children,
}: ModalProps) {
  // When this modal opened: the double-click window runs from here, not from each render.
  const openedAt = useRef(0)
  useEffect(() => {
    if (show) openedAt.current = Date.now()
  }, [show])

  useEffect(() => {
    if (!show) return
    document.body.classList.add('modal-open')

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && backdrop !== 'static') onHide?.()
    }
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.classList.remove('modal-open')
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [show, onHide, backdrop])

  if (!show) return null

  const onBackdropClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return // a press inside the dialog is the dialog's own
    // A press that does not close the modal also must not move focus out of it or
    // select text: the rest of the double-click that opened it, or any press on a
    // static backdrop.
    if (Date.now() - openedAt.current < DOUBLE_CLICK_MS || backdrop === 'static') {
      e.preventDefault()
      return
    }
    onHide?.()
  }

  return createPortal(
    <ModalContext.Provider value={{ onHide }}>
      <div className="modal-backdrop fade-in" />
      <div
        className={cx('modal', 'show', 'fade-in', className)}
        role="dialog"
        aria-modal="true"
        onMouseDown={onBackdropClick}
      >
        <div
          className={cx(
            'modal-dialog',
            size && `modal-${size}`,
          )}
        >
          <div className="modal-content">{children}</div>
        </div>
      </div>
    </ModalContext.Provider>,
    document.body,
  )
}

function ModalHeader({
  closeButton,
  className,
  children,
  ...rest
}: ComponentPropsWithoutRef<'div'> & { closeButton?: boolean }) {
  const { onHide } = useContext(ModalContext)
  const { t } = useI18n()
  return (
    <div className={cx('modal-header', className)} {...rest}>
      {children}
      {closeButton && (
        <button
          type="button"
          className="btn-close"
          aria-label={t('close')}
          onClick={onHide}
        />
      )}
    </div>
  )
}

function ModalTitle({ className, ...rest }: ComponentPropsWithoutRef<'h4'>) {
  return <h4 className={cx('modal-title', className)} {...rest} />
}

function ModalBody({ className, ...rest }: ComponentPropsWithoutRef<'div'>) {
  return <div className={cx('modal-body', className)} {...rest} />
}

function ModalFooter({ className, ...rest }: ComponentPropsWithoutRef<'div'>) {
  return <div className={cx('modal-footer', className)} {...rest} />
}

export const Modal = Object.assign(ModalRoot, {
  Header: ModalHeader,
  Title: ModalTitle,
  Body: ModalBody,
  Footer: ModalFooter,
})
