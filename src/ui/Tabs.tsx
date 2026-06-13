import type { ComponentPropsWithoutRef, ReactElement, ReactNode } from 'react'
import { Children, isValidElement, useState } from 'react'
import { cx } from './types'

type TabProps = {
  eventKey: string
  title: ReactNode
  disabled?: boolean
  tabClassName?: string
  children?: ReactNode
} & Omit<ComponentPropsWithoutRef<'div'>, 'title'>

/** Declarative pane — rendered by the parent <Tabs>, never directly. */
export function Tab(_props: TabProps) {
  return null
}

type TabsProps = {
  activeKey?: string
  defaultActiveKey?: string
  onSelect?: (key: string | null) => void
  id?: string
  className?: string
  children?: ReactNode
}

export function Tabs({
  activeKey,
  defaultActiveKey,
  onSelect,
  id,
  className,
  children,
}: TabsProps) {
  const panes = Children.toArray(children).filter(
    (child): child is ReactElement<TabProps> =>
      isValidElement(child) && child.type === Tab,
  )

  const [internalKey, setInternalKey] = useState<string | undefined>(
    defaultActiveKey ?? panes[0]?.props.eventKey,
  )
  const currentKey = activeKey ?? internalKey

  const select = (key: string) => {
    if (activeKey === undefined) setInternalKey(key)
    onSelect?.(key)
  }

  return (
    <>
      <ul className={cx('nav', 'nav-tabs', className)} id={id} role="tablist">
        {panes.map((pane) => {
          const { eventKey, title, disabled, tabClassName } = pane.props
          const isActive = eventKey === currentKey
          return (
            <li className="nav-item" role="presentation" key={eventKey}>
              <button
                type="button"
                role="tab"
                aria-selected={isActive}
                className={cx(
                  'nav-link',
                  isActive && 'active',
                  disabled && 'disabled',
                  tabClassName,
                )}
                disabled={disabled}
                onClick={() => select(eventKey)}
              >
                {title}
              </button>
            </li>
          )
        })}
      </ul>
      <div className="tab-content">
        {panes.map((pane) => {
          const {
            eventKey,
            title: _title,
            disabled: _disabled,
            tabClassName: _tabClassName,
            className: paneClassName,
            children: paneChildren,
            ...paneRest
          } = pane.props
          const isActive = eventKey === currentKey
          // Match react-bootstrap's default: only the active pane mounts.
          if (!isActive) return null
          return (
            <div
              role="tabpanel"
              className={cx('tab-pane', 'active', paneClassName)}
              key={eventKey}
              {...paneRest}
            >
              {paneChildren}
            </div>
          )
        })}
      </div>
    </>
  )
}
