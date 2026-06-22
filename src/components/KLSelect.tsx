import { useMemo } from 'react'
import ReactSelect, { components as RSComponents } from 'react-select'
import type { GroupBase, Props, OptionProps, MenuListProps } from 'react-select'

type SortMode = 'abc' | 'count'

interface KLDistProps {
  /** option label -> count; when present, draws an in-list distribution bar +
   *  count behind each option and shows an ABC/Count sort toggle. */
  distribution?: Record<string, number>
  sortMode?: SortMode
  onSortMode?: (mode: SortMode) => void
}

const labelOf = (o: unknown): string => String((o as { label?: unknown })?.label ?? '')

// Extra props smuggled through react-select's `selectProps` so the custom
// components below can stay MODULE-LEVEL (stable identity). Recreating custom
// components per-render makes react-select REMOUNT the whole menu; under the
// app's frequent re-renders that remount lands between a click's mousedown and
// mouseup and swallows the selection. Stable identities reconcile like the
// default Option/MenuList, so clicks always register.
interface KLDistExtra {
  klDistribution?: Record<string, number>
  klMaxCount?: number
  klSortMode?: SortMode
  klOnSortMode?: (mode: SortMode) => void
}

type AnyOption = OptionProps<unknown, boolean, GroupBase<unknown>>
type AnyMenuList = MenuListProps<unknown, boolean, GroupBase<unknown>>

function DistOption(op: AnyOption) {
  const sp = op.selectProps as unknown as KLDistExtra
  const count = sp.klDistribution?.[labelOf(op.data)] ?? 0
  const max = sp.klMaxCount ?? 0
  const pct = max > 0 ? Math.min((count / max) * 100, 100) : 0
  // Bar = background gradient (no overlapping element); pointer-events:none on the
  // whole content layer so every pixel of the row falls through to react-select's
  // own Option click handler.
  return (
    <RSComponents.Option {...op}>
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          minHeight: 18,
          borderRadius: 3,
          pointerEvents: 'none',
          background:
            pct > 0
              ? `linear-gradient(to right, rgba(44, 140, 94, 0.20) ${pct}%, transparent ${pct}%)`
              : undefined,
        }}
      >
        <span style={{ flex: 1 }}>{op.children}</span>
        {count > 0 && <span style={{ fontSize: 11, color: '#6b7d72', marginLeft: 8 }}>{count}</span>}
      </span>
    </RSComponents.Option>
  )
}

function DistMenuList(ml: AnyMenuList) {
  const sp = ml.selectProps as unknown as KLDistExtra
  const sortMode: SortMode = sp.klSortMode ?? 'abc'
  const onSortMode = sp.klOnSortMode
  // Fire on mousedown (preventDefault keeps the menu open): inside an open menu the
  // click event is unreliable across re-renders.
  const tab = (mode: SortMode, text: string) => (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onSortMode?.(mode)
      }}
      style={{
        flex: 1,
        border: 'none',
        borderRadius: 4,
        background: sortMode === mode ? 'var(--kl-green, #2C8C5E)' : 'transparent',
        color: sortMode === mode ? '#fff' : 'var(--kl-green, #2C8C5E)',
        fontWeight: 600,
        fontSize: 13,
        padding: '8px 0',
        cursor: 'pointer',
        lineHeight: 1.2,
      }}
    >
      {text}
    </button>
  )
  return (
    <RSComponents.MenuList {...ml}>
      <div
        onMouseDown={(e) => e.preventDefault()}
        style={{ display: 'flex', gap: 4, padding: '2px 4px 6px', position: 'sticky', top: 0, background: '#fff', zIndex: 2, borderBottom: '1px solid rgba(0,0,0,0.08)' }}
      >
        {tab('abc', 'ABC')}
        {tab('count', 'Count')}
      </div>
      {ml.children}
    </RSComponents.MenuList>
  )
}

// Stable module-level identity — react-select reconciles these like its own defaults.
const DIST_COMPONENTS = { Option: DistOption, MenuList: DistMenuList }

/**
 * react-select with a stable class prefix so main.scss can restyle it. When
 * `distribution` is passed it also draws the per-option count graph INTO the
 * dropdown (light-green background bar + count behind each row) with a sticky
 * ABC/Count sort toggle — replacing the old side popup.
 */
export default function KLSelect<
  Option,
  IsMulti extends boolean = false,
  Group extends GroupBase<Option> = GroupBase<Option>,
>(props: Props<Option, IsMulti, Group> & KLDistProps) {
  const { distribution, sortMode = 'abc', onSortMode, options, components, ...rest } = props
  const hasDist = !!distribution && Array.isArray(options)

  const maxCount = useMemo(() => {
    if (!distribution) return 0
    return Object.values(distribution).reduce((m, v) => (v > m ? v : m), 0)
  }, [distribution])

  // Sort by the chosen mode (count desc then A–Z; or A–Z). react-select preserves
  // this order when it filters on typed text.
  const sortedOptions = useMemo(() => {
    if (!hasDist) return options
    const dist = distribution as Record<string, number>
    return [...(options as Option[])].sort((a, b) => {
      if (sortMode === 'count') {
        const d = (dist[labelOf(b)] ?? 0) - (dist[labelOf(a)] ?? 0)
        if (d !== 0) return d
      }
      return labelOf(a).localeCompare(labelOf(b))
    })
  }, [hasDist, options, distribution, sortMode])

  if (!hasDist) {
    return <ReactSelect classNamePrefix="Select" options={options} components={components} {...rest} />
  }

  // components is undefined for the criteria selects, so this is the stable
  // DIST_COMPONENTS constant (stable Option/MenuList refs either way). Per-instance
  // data rides through selectProps (kl* props) instead of through new closures.
  const mergedComponents = components ? { ...components, ...DIST_COMPONENTS } : DIST_COMPONENTS
  const allProps = {
    classNamePrefix: 'Select',
    options: sortedOptions,
    components: mergedComponents,
    klDistribution: distribution,
    klMaxCount: maxCount,
    klSortMode: sortMode,
    klOnSortMode: onSortMode,
    ...rest,
  } as unknown as Props<Option, IsMulti, Group>
  return <ReactSelect {...allProps} />
}
