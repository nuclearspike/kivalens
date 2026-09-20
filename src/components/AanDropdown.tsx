import { useState } from 'react'
import { Dropdown } from '../ui'
import { useI18n } from '../i18n'

export type AanMode = 'all' | 'any' | 'none'
export type AanCounts = Partial<Record<AanMode, number>>

/**
 * The Any / All / None switch beside a multi-select.
 *
 * With `getCounts`, the open menu shows beside each mode the number of results
 * choosing it would give, with a bar so the modes compare at a glance. The counts
 * are taken in the same update that opens the menu, so the menu is never drawn
 * without them and never resizes while open. `getCounts` returns null when the
 * mode changes nothing (no value chosen in the select), and the menu stays plain.
 */
export default function AanDropdown({
  value,
  onChange,
  canAll,
  id = 'aan-dropdown',
  getCounts,
}: {
  value: string
  onChange: (val: AanMode) => void
  canAll?: boolean
  id?: string
  getCounts?: () => AanCounts | null
}) {
  const { t, number } = useI18n()
  const [counts, setCounts] = useState<AanCounts | null>(null)
  const selected = value || (canAll ? 'all' : 'any')
  const styles: Record<string, string> = canAll
    ? { all: 'success', any: 'primary', none: 'danger' }
    : { any: 'success', none: 'danger' }
  const modes: AanMode[] = canAll ? ['all', 'any', 'none'] : ['any', 'none']
  const label = (mode: AanMode) => (mode === 'all' ? t('all_these') : mode === 'any' ? t('any_these') : t('none_these'))
  const max = counts ? Math.max(0, ...modes.map((mode) => counts[mode] ?? 0)) : 0

  return (
    <Dropdown onToggle={(open) => setCounts(open && getCounts ? getCounts() : null)}>
      <Dropdown.Toggle
        size="sm"
        variant={styles[selected] ?? 'primary'}
        id={id}
        style={{ height: 34, padding: '4px 8px', minWidth: 53, width: 'max-content', whiteSpace: 'nowrap' }}
      >
        {t(selected)}
      </Dropdown.Toggle>
      <Dropdown.Menu>
        {modes.map((mode) => {
          const count = counts?.[mode]
          const pct = count !== undefined && max > 0 ? Math.min((count / max) * 100, 100) : 0
          return (
            <Dropdown.Item key={mode} onClick={() => onChange(mode)} data-aan-mode={mode}>
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  borderRadius: 3,
                  background: pct > 0 ? `linear-gradient(to right, rgba(44, 140, 94, 0.20) ${pct}%, transparent ${pct}%)` : undefined,
                }}
              >
                <span style={{ flex: 1 }}>{label(mode)}</span>
                {count !== undefined ? (
                  <span className="kl-aan-count" style={{ fontSize: 11, color: 'var(--kl-text-muted)' }}>{number(count)}</span>
                ) : null}
              </span>
            </Dropdown.Item>
          )
        })}
      </Dropdown.Menu>
    </Dropdown>
  )
}
