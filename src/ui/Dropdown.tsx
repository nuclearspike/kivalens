import type { ComponentPropsWithoutRef, ElementType, ReactNode, RefObject } from 'react'
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { Button, type ButtonProps } from './Button'
import { cx } from './types'

type DropdownContextValue = {
  open: boolean
  setOpen: (open: boolean) => void
  anchorRef: RefObject<HTMLDivElement | null>
  menuRef: RefObject<HTMLDivElement | null>
  align: 'start' | 'end'
}

const DropdownContext = createContext<DropdownContextValue>({
  open: false,
  setOpen: () => {},
  anchorRef: { current: null },
  menuRef: { current: null },
  align: 'start',
})

type DropdownProps = ComponentPropsWithoutRef<'div'> & {
  onToggle?: (isOpen: boolean) => void
  align?: 'start' | 'end'
  children?: ReactNode
}

function DropdownRoot({
  onToggle,
  align: _align,
  className,
  children,
  ...rest
}: DropdownProps) {
  const [open, setOpenState] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const setOpen = (next: boolean) => {
    setOpenState(next)
    onToggle?.(next)
  }

  useEffect(() => {
    if (!open) return

    const onDocClick = (e: globalThis.MouseEvent) => {
      const target = e.target as Node
      const inRoot = rootRef.current?.contains(target)
      const inMenu = menuRef.current?.contains(target) // menu is portaled outside root
      if (!inRoot && !inMenu) {
        setOpenState(false)
        onToggle?.(false)
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenState(false)
        onToggle?.(false)
      }
    }

    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKeyDown)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return (
    <DropdownContext.Provider
      value={{ open, setOpen, anchorRef: rootRef, menuRef, align: _align ?? 'start' }}
    >
      <div ref={rootRef} className={cx('dropdown', className)} {...rest}>
        {children}
      </div>
    </DropdownContext.Provider>
  )
}

function DropdownToggle({ className, onClick, ...rest }: ButtonProps) {
  const { open, setOpen } = useContext(DropdownContext)
  return (
    <Button
      className={cx('dropdown-toggle', className)}
      aria-expanded={open}
      onClick={(e) => {
        setOpen(!open)
        onClick?.(e)
      }}
      {...rest}
    />
  )
}

function DropdownMenu({
  className,
  style,
  align,
  ...rest
}: ComponentPropsWithoutRef<'div'> & { align?: 'start' | 'end' }) {
  const { open, anchorRef, menuRef, align: ctxAlign } = useContext(DropdownContext)
  const useAlign = align ?? ctxAlign

  // Position the menu with position:fixed in a portal so it escapes any ancestor with
  // overflow:hidden/auto (e.g. the scrolling criteria column) instead of being clipped.
  // Anchored to the toggle and positioned imperatively (no state) so there's no flash and
  // it re-tracks on scroll/resize while open.
  useLayoutEffect(() => {
    if (!open) return
    const compute = () => {
      const el = menuRef.current
      const a = anchorRef.current?.getBoundingClientRect()
      if (!el || !a) return
      const menuW = el.offsetWidth
      let left = useAlign === 'end' ? a.right - menuW : a.left
      const vw = window.innerWidth
      if (left + menuW > vw - 8) left = vw - menuW - 8
      if (left < 8) left = 8
      el.style.top = `${a.bottom + 2}px`
      el.style.left = `${left}px`
      el.style.visibility = 'visible'
    }
    compute()
    window.addEventListener('scroll', compute, true)
    window.addEventListener('resize', compute)
    return () => {
      window.removeEventListener('scroll', compute, true)
      window.removeEventListener('resize', compute)
    }
  }, [open, useAlign, anchorRef, menuRef])

  if (!open) return null

  return createPortal(
    <div
      ref={menuRef}
      className={cx('dropdown-menu', 'show', className)}
      style={{
        ...style,
        position: 'fixed',
        top: 0,
        left: 0,
        visibility: 'hidden', // revealed by the layout effect once positioned
        zIndex: 2000,
      }}
      {...rest}
    />,
    document.body,
  )
}

type DropdownItemProps = ComponentPropsWithoutRef<'button'> & {
  as?: ElementType
  active?: boolean
  eventKey?: string
  href?: string
}

function DropdownItem({
  as,
  active,
  disabled,
  eventKey: _eventKey,
  className,
  onClick,
  href,
  ...rest
}: DropdownItemProps) {
  const { setOpen } = useContext(DropdownContext)
  const Component: ElementType = as ?? (href ? 'a' : 'button')
  const extra: Record<string, unknown> = {}
  if (Component === 'button') {
    extra.type = 'button'
    extra.disabled = disabled
  }
  if (href) extra.href = href

  return (
    <Component
      className={cx(
        'dropdown-item',
        active && 'active',
        disabled && 'disabled',
        className,
      )}
      onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(e)
        setOpen(false)
      }}
      {...extra}
      {...rest}
    />
  )
}

function DropdownDivider({
  className,
  ...rest
}: ComponentPropsWithoutRef<'hr'>) {
  return <hr className={cx('dropdown-divider', className)} {...rest} />
}

function DropdownHeader({
  className,
  ...rest
}: ComponentPropsWithoutRef<'div'>) {
  return <div className={cx('dropdown-header', className)} {...rest} />
}

export const Dropdown = Object.assign(DropdownRoot, {
  Toggle: DropdownToggle,
  Menu: DropdownMenu,
  Item: DropdownItem,
  Divider: DropdownDivider,
  Header: DropdownHeader,
})
