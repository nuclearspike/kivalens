import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import { cx } from './types'

export interface SegmentedOption<T extends string> {
  value: T
  label: ReactNode
}

/**
 * A pick-one row of buttons (Idea · Bug · Language): the chosen one filled, the
 * others outlined.
 *
 * Pointing at an option tints it and never fills it: a hover that looks like the
 * chosen state makes the row read as two choices at once (Paul, 2026-09-25; UX
 * rule 44). The styling is `.kl-segmented` in src/styles/base/_buttons.scss.
 *
 * A radio group to the keyboard: Tab reaches the chosen option only, the arrow
 * keys (and Home/End) move the choice, as native radio buttons do.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  size = 'sm',
  className,
}: {
  options: ReadonlyArray<SegmentedOption<T>>
  value: T
  onChange: (value: T) => void
  /** What the choice is, for assistive technology ("Send Feedback"). */
  label: string
  size?: 'sm' | 'lg'
  className?: string
}) {
  const buttons = useRef<Array<HTMLButtonElement | null>>([])
  const current = Math.max(0, options.findIndex((o) => o.value === value))

  const move = (event: KeyboardEvent<HTMLButtonElement>) => {
    const last = options.length - 1
    const next =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? current === last ? 0 : current + 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? current === 0 ? last : current - 1
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : null
    if (next === null) return
    event.preventDefault()
    onChange(options[next].value)
    buttons.current[next]?.focus()
  }

  return (
    <div className={cx('btn-group', 'kl-segmented', className)} role="radiogroup" aria-label={label}>
      {options.map((option, index) => {
        const checked = index === current
        return (
          <button
            key={option.value}
            ref={(el) => {
              buttons.current[index] = el
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            className={cx('btn', `btn-${size}`, checked ? 'btn-primary' : 'btn-outline-primary')}
            onClick={() => onChange(option.value)}
            onKeyDown={move}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
