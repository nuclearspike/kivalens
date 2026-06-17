import type { ComponentPropsWithoutRef, ReactElement } from 'react'
import { cloneElement, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cx } from './types'

// ------------------------------------------------------------- Popover

type PopoverProps = ComponentPropsWithoutRef<'div'>

function PopoverRoot({ className, ...rest }: PopoverProps) {
  return <div className={cx('popover', className)} {...rest} />
}

function PopoverHeader({ className, ...rest }: ComponentPropsWithoutRef<'h3'>) {
  return <h3 className={cx('popover-header', className)} {...rest} />
}

function PopoverBody({ className, ...rest }: ComponentPropsWithoutRef<'div'>) {
  return <div className={cx('popover-body', className)} {...rest} />
}

export const Popover = Object.assign(PopoverRoot, {
  Header: PopoverHeader,
  Body: PopoverBody,
})

// ------------------------------------------------------- OverlayTrigger

type TriggerType = 'hover' | 'focus' | 'click'
type Placement = 'top' | 'bottom' | 'left' | 'right'

type OverlayTriggerProps = {
  trigger?: TriggerType | TriggerType[]
  placement?: Placement
  overlay: ReactElement
  children: ReactElement
}

type Position = { top: number; left: number; placement: Placement }

/**
 * Hand-rolled replacement for react-bootstrap's OverlayTrigger.
 * Positions the overlay in a portal off the trigger element's rect;
 * no popper dependency.
 */
export function OverlayTrigger({
  trigger = ['hover', 'focus'],
  placement = 'top',
  overlay,
  children,
}: OverlayTriggerProps) {
  const [pos, setPos] = useState<Position | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  const triggers = Array.isArray(trigger) ? trigger : [trigger]

  const show = (target: Element) => {
    const rect = target.getBoundingClientRect()
    setPos({
      top: rect.top + window.scrollY,
      left: rect.left + window.scrollX + rect.width / 2,
      placement,
    })
  }

  const hide = () => setPos(null)

  const childProps: Record<string, unknown> = {}
  const existing = children.props as Record<string, unknown>

  const chain =
    (mine: (e: { currentTarget: Element }) => void, key: string) =>
    (e: { currentTarget: Element }) => {
      mine(e)
      const orig = existing[key]
      if (typeof orig === 'function') orig(e)
    }

  if (triggers.includes('hover')) {
    childProps.onMouseEnter = chain((e) => show(e.currentTarget), 'onMouseEnter')
    childProps.onMouseLeave = chain(() => hide(), 'onMouseLeave')
  }
  if (triggers.includes('focus')) {
    childProps.onFocus = chain((e) => show(e.currentTarget), 'onFocus')
    childProps.onBlur = chain(() => hide(), 'onBlur')
  }
  if (triggers.includes('click')) {
    childProps.onClick = chain(
      (e) => (pos ? hide() : show(e.currentTarget)),
      'onClick',
    )
  }

  return (
    <>
      {cloneElement(children, childProps)}
      {pos &&
        createPortal(
          <div
            ref={overlayRef}
            style={{
              position: 'absolute',
              top: pos.top,
              left: pos.left,
              // top placement: shift up by overlay height via translate
              transform:
                pos.placement === 'top'
                  ? 'translate(-50%, calc(-100% - 6px))'
                  : pos.placement === 'bottom'
                    ? 'translate(-50%, 6px)'
                    : 'translate(-50%, -50%)',
              zIndex: 1070,
              // Read-only help popover: let the cursor pass through to the
              // trigger beneath it. Without this, moving onto the tip fires
              // the trigger's mouseleave -> hide -> mouseenter -> show loop,
              // which flickers the fade transition (looks ~50% transparent).
              pointerEvents: 'none',
            }}
          >
            {overlay}
          </div>,
          document.body,
        )}
    </>
  )
}
