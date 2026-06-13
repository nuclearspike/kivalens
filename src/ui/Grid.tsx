import type { ComponentPropsWithoutRef } from 'react'
import { cx } from './types'

type ContainerProps = ComponentPropsWithoutRef<'div'> & {
  fluid?: boolean | string
}

export function Container({ fluid, className, ...rest }: ContainerProps) {
  return (
    <div
      className={cx(fluid ? 'container-fluid' : 'container', className)}
      {...rest}
    />
  )
}

export function Row({
  className,
  ...rest
}: ComponentPropsWithoutRef<'div'>) {
  return <div className={cx('row', className)} {...rest} />
}

type ColSize = number | 'auto' | true
type ColProps = ComponentPropsWithoutRef<'div'> & {
  xs?: ColSize
  sm?: ColSize
  md?: ColSize
  lg?: ColSize
  xl?: ColSize
}

function colClass(infix: string, size?: ColSize): string | false {
  if (size === undefined) return false
  const suffix = size === true ? '' : `-${size}`
  return infix ? `col-${infix}${suffix}` : `col${suffix}`
}

export function Col({ xs, sm, md, lg, xl, className, ...rest }: ColProps) {
  const classes = [
    colClass('', xs),
    colClass('sm', sm),
    colClass('md', md),
    colClass('lg', lg),
    colClass('xl', xl),
  ].filter(Boolean) as string[]

  return (
    <div
      className={cx(classes.length ? classes.join(' ') : 'col', className)}
      {...rest}
    />
  )
}
