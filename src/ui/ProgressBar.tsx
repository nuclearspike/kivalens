import type { ReactElement, ReactNode } from 'react'
import { Children, isValidElement } from 'react'
import { cx } from './types'

type ProgressBarProps = {
  now?: number
  min?: number
  max?: number
  label?: ReactNode
  variant?: 'success' | 'info' | 'warning' | 'danger'
  striped?: boolean
  animated?: boolean
  className?: string
  style?: React.CSSProperties
  children?: ReactNode
  /** Set internally when rendered inside a stacked <ProgressBar>. */
  isChild?: boolean
}

function Segment({
  now = 0,
  min = 0,
  max = 100,
  label,
  variant,
  striped,
  animated,
}: ProgressBarProps) {
  const pct = ((now - min) / (max - min)) * 100
  return (
    <div
      role="progressbar"
      className={cx(
        'progress-bar',
        variant && `bg-${variant}`,
        (striped || animated) && 'progress-bar-striped',
        animated && 'progress-bar-animated',
      )}
      style={{ width: `${pct}%` }}
      aria-valuenow={now}
      aria-valuemin={min}
      aria-valuemax={max}
    >
      {label}
    </div>
  )
}

export function ProgressBar(props: ProgressBarProps) {
  const { children, className, style, isChild } = props

  if (isChild) return <Segment {...props} />

  const segments = Children.toArray(children).filter(
    (child): child is ReactElement<ProgressBarProps> =>
      isValidElement(child) && child.type === ProgressBar,
  )

  return (
    <div className={cx('progress', className)} style={style}>
      {segments.length > 0 ? (
        segments.map((seg, i) => (
          <Segment key={seg.key ?? i} {...seg.props} />
        ))
      ) : (
        <Segment {...props} />
      )}
    </div>
  )
}
