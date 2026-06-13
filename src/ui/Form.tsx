import type {
  ComponentPropsWithoutRef,
  ElementType,
  ReactNode,
} from 'react'
import { useId } from 'react'
import { cx } from './types'

function FormRoot(props: ComponentPropsWithoutRef<'form'>) {
  return <form {...props} />
}

function Group({
  className,
  controlId: _controlId,
  ...rest
}: ComponentPropsWithoutRef<'div'> & { controlId?: string }) {
  return <div className={cx('form-group', className)} {...rest} />
}

function Label({
  className,
  column: _column,
  ...rest
}: ComponentPropsWithoutRef<'label'> & { column?: boolean | string }) {
  return <label className={cx('form-label', className)} {...rest} />
}

type ControlProps = Omit<ComponentPropsWithoutRef<'input'>, 'size'> & {
  as?: ElementType
  size?: 'sm' | 'lg'
  isInvalid?: boolean
  htmlSize?: number
  rows?: number // when rendered as a textarea
}

function Control({
  as: Component = 'input',
  size,
  isInvalid,
  className,
  htmlSize,
  ...rest
}: ControlProps) {
  return (
    <Component
      className={cx(
        'form-control',
        size && `form-control-${size}`,
        isInvalid && 'is-invalid',
        className,
      )}
      size={htmlSize}
      {...rest}
    />
  )
}

function Select({
  size,
  className,
  ...rest
}: Omit<ComponentPropsWithoutRef<'select'>, 'size'> & { size?: 'sm' | 'lg' }) {
  return (
    <select
      className={cx('form-select', size && `form-select-${size}`, className)}
      {...rest}
    />
  )
}

type CheckProps = Omit<ComponentPropsWithoutRef<'input'>, 'type' | 'size'> & {
  type?: 'checkbox' | 'radio' | 'switch'
  label?: ReactNode
  inline?: boolean
}

function Check({
  type = 'checkbox',
  label,
  inline,
  className,
  id,
  ...rest
}: CheckProps) {
  const fallbackId = useId()
  const inputId = id ?? fallbackId
  const inputType = type === 'switch' ? 'checkbox' : type

  return (
    <div
      className={cx(
        'form-check',
        type === 'switch' && 'form-switch',
        inline && 'form-check-inline',
        className,
      )}
    >
      <input
        type={inputType}
        className="form-check-input"
        id={inputId}
        {...rest}
      />
      {label !== undefined && label !== null && (
        <label className="form-check-label" htmlFor={inputId}>
          {label}
        </label>
      )}
    </div>
  )
}

function Range({
  className,
  ...rest
}: Omit<ComponentPropsWithoutRef<'input'>, 'type'>) {
  return <input type="range" className={cx('form-range', className)} {...rest} />
}

function Text({
  className,
  muted,
  ...rest
}: ComponentPropsWithoutRef<'small'> & { muted?: boolean }) {
  return (
    <small
      className={cx('form-text', muted && 'text-muted', className)}
      {...rest}
    />
  )
}

export const Form = Object.assign(FormRoot, {
  Group,
  Label,
  Control,
  Select,
  Check,
  Range,
  Text,
})
