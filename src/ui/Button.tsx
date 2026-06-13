import type { ComponentPropsWithoutRef, ElementType } from 'react'
import { cx, type Variant } from './types'

export type ButtonProps = ComponentPropsWithoutRef<'button'> & {
  variant?: Variant
  size?: 'sm' | 'lg' | 'xs'
  active?: boolean
  as?: ElementType
  // anchor-mode props (react-bootstrap renders an <a> when href is set)
  href?: string
  target?: string
  rel?: string
}

export function Button({
  as,
  variant = 'secondary',
  size,
  active,
  disabled,
  className,
  href,
  ...rest
}: ButtonProps) {
  const Component: ElementType = as ?? (href ? 'a' : 'button')
  const classes = cx(
    'btn',
    `btn-${variant}`,
    size && `btn-${size}`,
    active && 'active',
    disabled && Component !== 'button' && 'disabled',
    className,
  )

  const extra: Record<string, unknown> = {}
  if (Component === 'button') {
    extra.type = (rest as { type?: string }).type ?? 'button'
    extra.disabled = disabled
  }
  if (href) extra.href = href

  return <Component className={classes} {...extra} {...rest} />
}

type ButtonGroupProps = ComponentPropsWithoutRef<'div'> & {
  size?: 'sm' | 'lg'
  vertical?: boolean
}

export function ButtonGroup({
  size,
  vertical,
  className,
  ...rest
}: ButtonGroupProps) {
  return (
    <div
      role="group"
      className={cx(
        vertical ? 'btn-group-vertical' : 'btn-group',
        size && `btn-group-${size}`,
        className,
      )}
      {...rest}
    />
  )
}
