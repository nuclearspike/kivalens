import type { ComponentPropsWithoutRef, ElementType } from 'react'
import { cx, type PolymorphicProps } from './types'
import { useI18n } from '../i18n'

// ---------------------------------------------------------------- Card

function CardRoot({
  className,
  ...rest
}: ComponentPropsWithoutRef<'div'>) {
  return <div className={cx('card', className)} {...rest} />
}

function CardHeader({ className, ...rest }: ComponentPropsWithoutRef<'div'>) {
  return <div className={cx('card-header', className)} {...rest} />
}

function CardBody({ className, ...rest }: ComponentPropsWithoutRef<'div'>) {
  return <div className={cx('card-body', className)} {...rest} />
}

function CardTitle({ className, ...rest }: ComponentPropsWithoutRef<'div'>) {
  return <div className={cx('card-title', className)} {...rest} />
}

function CardFooter({ className, ...rest }: ComponentPropsWithoutRef<'div'>) {
  return <div className={cx('card-footer', className)} {...rest} />
}

export const Card = Object.assign(CardRoot, {
  Header: CardHeader,
  Body: CardBody,
  Title: CardTitle,
  Footer: CardFooter,
})

// ---------------------------------------------------------- ListGroup

type ListGroupProps = ComponentPropsWithoutRef<'div'> & {
  variant?: 'flush'
}

function ListGroupRoot({ variant, className, ...rest }: ListGroupProps) {
  return (
    <div
      className={cx('list-group', variant === 'flush' && 'list-group-flush', className)}
      {...rest}
    />
  )
}

type ListGroupItemProps<T extends ElementType = 'div'> = PolymorphicProps<
  T,
  {
    action?: boolean
    active?: boolean
    disabled?: boolean
    variant?: string
  }
>

function ListGroupItem<T extends ElementType = 'div'>({
  as,
  action,
  active,
  disabled,
  variant,
  className,
  ...rest
}: ListGroupItemProps<T>) {
  const Component: ElementType = as ?? (action ? 'button' : 'div')
  const extra: Record<string, unknown> = {}
  if (Component === 'button') extra.type = 'button'

  return (
    <Component
      className={cx(
        'list-group-item',
        action && 'list-group-item-action',
        active && 'active',
        disabled && 'disabled',
        variant && `list-group-item-${variant}`,
        className,
      )}
      {...extra}
      {...rest}
    />
  )
}

export const ListGroup = Object.assign(ListGroupRoot, {
  Item: ListGroupItem,
})

// --------------------------------------------------------------- Badge

type BadgeProps = ComponentPropsWithoutRef<'span'> & {
  bg?: string
  pill?: boolean
  text?: string
}

export function Badge({ bg = 'secondary', pill, text, className, ...rest }: BadgeProps) {
  return (
    <span
      className={cx(
        'badge',
        `bg-${bg}`,
        pill && 'rounded-pill',
        text && `text-${text}`,
        className,
      )}
      {...rest}
    />
  )
}

// --------------------------------------------------------------- Alert

type AlertProps = ComponentPropsWithoutRef<'div'> & {
  variant?: string
  dismissible?: boolean
  show?: boolean
  onClose?: () => void
}

function AlertRoot({
  variant = 'primary',
  dismissible,
  show = true,
  onClose,
  className,
  children,
  ...rest
}: AlertProps) {
  const { t } = useI18n()
  if (!show) return null
  return (
    <div
      role="alert"
      className={cx(
        'alert',
        `alert-${variant}`,
        dismissible && 'alert-dismissible',
        className,
      )}
      {...rest}
    >
      {children}
      {dismissible && (
        <button
          type="button"
          className="btn-close"
          aria-label={t('Close alert')}
          onClick={onClose}
        />
      )}
    </div>
  )
}

function AlertHeading({ className, ...rest }: ComponentPropsWithoutRef<'h4'>) {
  return <h4 className={cx('alert-heading', className)} {...rest} />
}

function AlertLink({ className, ...rest }: ComponentPropsWithoutRef<'a'>) {
  return <a className={cx('alert-link', className)} {...rest} />
}

export const Alert = Object.assign(AlertRoot, {
  Heading: AlertHeading,
  Link: AlertLink,
})
