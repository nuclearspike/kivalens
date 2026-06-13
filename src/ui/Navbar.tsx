import type { ComponentPropsWithoutRef, ElementType } from 'react'
import { createContext, useContext, useState } from 'react'
import { cx, type PolymorphicProps } from './types'

const NavbarContext = createContext<{
  expanded: boolean
  toggle: () => void
}>({ expanded: false, toggle: () => {} })

type NavbarProps = ComponentPropsWithoutRef<'nav'> & {
  bg?: string
  variant?: string
  expand?: boolean | 'sm' | 'md' | 'lg' | 'xl'
  sticky?: 'top'
  fixed?: 'top' | 'bottom'
}

function NavbarRoot({
  bg,
  variant,
  expand,
  sticky,
  fixed,
  className,
  children,
  ...rest
}: NavbarProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <NavbarContext.Provider
      value={{ expanded, toggle: () => setExpanded((v) => !v) }}
    >
      <nav
        className={cx(
          'navbar',
          expand && `navbar-expand${expand === true ? '' : `-${expand}`}`,
          bg && `bg-${bg}`,
          variant && `navbar-${variant}`,
          sticky && `sticky-${sticky}`,
          fixed && `fixed-${fixed}`,
          className,
        )}
        {...rest}
      >
        {children}
      </nav>
    </NavbarContext.Provider>
  )
}

function NavbarBrand<T extends ElementType = 'a'>({
  as,
  className,
  ...rest
}: PolymorphicProps<T>) {
  const Component: ElementType = as ?? 'a'
  return <Component className={cx('navbar-brand', className)} {...rest} />
}

function NavbarToggle({
  className,
  'aria-controls': ariaControls,
  ...rest
}: ComponentPropsWithoutRef<'button'>) {
  const { expanded, toggle } = useContext(NavbarContext)
  return (
    <button
      type="button"
      className={cx('navbar-toggler', className)}
      aria-controls={ariaControls}
      aria-expanded={expanded}
      aria-label="Toggle navigation"
      onClick={toggle}
      {...rest}
    >
      <span className="navbar-toggler-bar" />
      <span className="navbar-toggler-bar" />
      <span className="navbar-toggler-bar" />
    </button>
  )
}

function NavbarCollapse({
  className,
  ...rest
}: ComponentPropsWithoutRef<'div'>) {
  const { expanded } = useContext(NavbarContext)
  return (
    <div
      className={cx('navbar-collapse', expanded && 'show', className)}
      {...rest}
    />
  )
}

export const Navbar = Object.assign(NavbarRoot, {
  Brand: NavbarBrand,
  Toggle: NavbarToggle,
  Collapse: NavbarCollapse,
})

// ------------------------------------------------------------------ Nav

function NavRoot({ className, ...rest }: ComponentPropsWithoutRef<'div'>) {
  // Inside a navbar this renders the link strip; `navbar-nav` provides
  // the layout, matching what react-bootstrap emits in that context.
  return <div className={cx('navbar-nav', className)} {...rest} />
}

type NavLinkProps<T extends ElementType = 'a'> = PolymorphicProps<
  T,
  { active?: boolean; disabled?: boolean; eventKey?: string }
>

function NavLink<T extends ElementType = 'a'>({
  as,
  active,
  disabled,
  eventKey: _eventKey,
  className,
  ...rest
}: NavLinkProps<T>) {
  const Component: ElementType = as ?? 'a'
  return (
    <Component
      className={cx(
        'nav-link',
        active && 'active',
        disabled && 'disabled',
        className,
      )}
      {...rest}
    />
  )
}

function NavItem({ className, ...rest }: ComponentPropsWithoutRef<'div'>) {
  return <div className={cx('nav-item', className)} {...rest} />
}

export const Nav = Object.assign(NavRoot, {
  Link: NavLink,
  Item: NavItem,
})
