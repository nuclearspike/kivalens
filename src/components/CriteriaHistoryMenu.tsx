import { useId, useState } from 'react'
import { Dropdown } from '../ui'
import { formatRelativeTime, useI18n } from '../i18n'
import { getKivaLoans } from '../api/kiva'
import { criteriaKey } from '../lib/criteriaHistory'
import { criteriaDetails, criteriaSummary, describeCriteria } from '../lib/describeCriteria'
import { useCriteriaHistory } from '../stores/criteriaHistoryStore'
import { useCriteriaStore } from '../stores'

/**
 * History, between Reset and Saved Searches: every search the lender has had,
 * newest first, each line starting with how long ago it was, then what it set.
 * A line too long for the menu ends in "…" and its hover shows everything.
 * Choosing one goes back to that search. Paul, 2026-09-25.
 */
export default function CriteriaHistoryMenu() {
  const { t, data, locale, date } = useI18n()
  const entries = useCriteriaHistory((s) => s.history.entries)
  const restore = useCriteriaHistory((s) => s.restore)
  const clear = useCriteriaHistory((s) => s.clear)
  const cleared = useCriteriaHistory((s) => s.cleared)
  const undoClear = useCriteriaHistory((s) => s.undoClear)
  const current = useCriteriaStore((s) => s.lastKnown)
  // When the menu was opened; null while it is closed. "3 minutes ago" is read
  // at opening, and the lines are worked out only while it is open: the history
  // changes on every keystroke of a Name search, and a closed menu must cost
  // that typing nothing.
  const [openedAt, setOpenedAt] = useState<number | null>(null)
  const clearReasonId = useId()

  let lines: Array<{ entry: (typeof entries)[number]; summary: string; details: string; isCurrent: boolean }> = []
  if (openedAt !== null) {
    // Not memoized: a field partner's name may arrive after the page, from a list
    // that is not React state, and each opening describes afresh.
    const currentKey = criteriaKey(current)
    const describeDeps = { t, data, partnerName: (id: string) => getKivaLoans().getPartner(Number(id))?.name }
    lines = entries.map((entry) => {
      const described = describeCriteria(entry.criteria, describeDeps)
      return {
        entry,
        summary: criteriaSummary(described, t),
        details: criteriaDetails(described, t),
        isCurrent: criteriaKey(entry.criteria) === currentKey,
      }
    })
  }
  // Never "in 3 minutes": an entry made while the menu is open is at most now.
  const now = Math.max(openedAt ?? 0, entries[0]?.at ?? 0)
  const nothingToClear = lines.length < 2

  return (
    <Dropdown className="kl-history-dropdown" onToggle={(open) => setOpenedAt(open ? Date.now() : null)}>
      <Dropdown.Toggle size="sm" id="criteria-history-dropdown" title={t('criteria_history_hint')} data-aikl="criteria-history">
        {t('criteria_history')}
      </Dropdown.Toggle>
      <Dropdown.Menu className="kl-criteria-history" aria-label={t('criteria_history')}>
        {lines.length === 0 ? (
          <Dropdown.Header>{t('criteria_history_empty')}</Dropdown.Header>
        ) : (
          lines.map(({ entry, summary, details, isCurrent }) => (
            <Dropdown.Item
              key={entry.id}
              active={isCurrent}
              aria-current={isCurrent ? 'true' : undefined}
              title={`${date(entry.at, { dateStyle: 'medium', timeStyle: 'short' })}\n${details}`}
              onClick={() => restore(entry.id)}
              className="kl-criteria-history-item"
            >
              <span className="kl-criteria-history-when">{formatRelativeTime(locale, entry.at, now)}</span>
              <span className="kl-criteria-history-summary">{summary}</span>
            </Dropdown.Item>
          ))
        )}
        {lines.length > 0 && (
          <>
            <Dropdown.Divider />
            {/* One entry that is Clear, or, right after a clear, Restore (undo over a
                confirmation, rule 18): the menu stays open so the result shows at once,
                and focus stays on the same entry. Clear is shown even with nothing to
                clear yet, unavailable and saying why (rule 39): aria-disabled rather
                than disabled, so a keyboard or screen-reader user can still reach it. */}
            {cleared ? (
              <Dropdown.Item key="clear" keepOpen onClick={undoClear}>
                {t('restore_history')}
              </Dropdown.Item>
            ) : (
              <Dropdown.Item
                key="clear"
                keepOpen
                onClick={() => {
                  if (!nothingToClear) clear()
                }}
                aria-disabled={nothingToClear || undefined}
                aria-describedby={nothingToClear ? clearReasonId : undefined}
                className={nothingToClear ? 'disabled' : undefined}
                title={nothingToClear ? t('criteria_history_nothing_to_clear') : undefined}
              >
                {t('clear_history')}
                {nothingToClear && (
                  <span id={clearReasonId} className="visually-hidden">
                    {t('criteria_history_nothing_to_clear')}
                  </span>
                )}
              </Dropdown.Item>
            )}
          </>
        )}
      </Dropdown.Menu>
    </Dropdown>
  )
}
