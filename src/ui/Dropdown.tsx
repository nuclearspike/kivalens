import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react'
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { Button, type ButtonProps } from './Button'
import { cx } from './types'

type DropdownContextValue = {
  open: boolean
  setOpen: (open: boolean) => void
}

const DropdownContext = createContext<DropdownContextValue>({
  open: false,
  setOpen: () => {},
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

  const setOpen = (next: boolean) => {
    setOpenState(next)
    onToggle?.(next)
  }

  useEffect(() => {
    if (!open) return

    const onDocClick = (e: globalThis.MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
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
    <DropdownContext.Provider value={{ open, setOpen }}>
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
  ...rest
}: ComponentPropsWithoutRef<'div'> & { align?: 'start' | 'end' }) {
  const { open } = useContext(DropdownContext)
  return (
    <div
      className={cx('dropdown-menu', open && 'show', className)}
      {...rest}
    />
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
