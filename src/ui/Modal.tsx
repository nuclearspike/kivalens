import type { ComponentPropsWithoutRef, MouseEvent, ReactNode } from 'react'
import { createContext, useContext, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { cx } from './types'
import { useI18n } from '../i18n'

const ModalContext = createContext<{ onHide?: () => void }>({})

type ModalProps = {
  show: boolean
  onHide?: () => void
  size?: 'sm' | 'lg'
  centered?: boolean
  backdrop?: boolean | 'static'
  className?: string
  children?: ReactNode
}

function ModalRoot({
  show,
  onHide,
  size,
  centered,
  backdrop = true,
  className,
  children,
}: ModalProps) {
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
    if (e.target === e.currentTarget && backdrop !== 'static') onHide?.()
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
            centered && 'modal-dialog-centered',
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
          aria-label={t('Close')}
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
