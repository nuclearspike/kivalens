import { useMemo } from 'react'
import { Alert, Button } from '../ui'
import { useCriteriaStore } from '../stores/criteriaStore'
import { useUtilsStore } from '../stores/utilsStore'
import { getKivaLoans } from '../api/kiva'
import { activeCriteria } from '../lib/criteriaActive'
import { labelOf as criteriaLabel, valueOf as criteriaValue } from '../lib/describeCriteria'
import { useI18n } from '../i18n'

// Shown in place of the plain "no matching loans" alert: lists the active filters
// causing zero results, with the count each removal would yield and a one-click
// remove, plus an "Ask KivaLens" suggestion shortcut.
export function NoResultsHelp() {
  const { t, data } = useI18n()
  const lastKnown = useCriteriaStore((s) => s.lastKnown)
  const setCriteria = useCriteriaStore((s) => s.setCriteria)
  const startFresh = useCriteriaStore((s) => s.startFresh)
  const aiServerEnabled = useUtilsStore((s) => s.aiServerEnabled)
  const openAskKl = useUtilsStore((s) => s.openAskKl)
  const lenderId = useUtilsStore((s) => s.lenderId)

  const items = useMemo(() => {
    const kl = getKivaLoans()
    const ready = kl.isReady()
    return activeCriteria(lastKnown)
      // "Exclude loans I funded" only constrains results when a lender id is set.
      .filter((a) => a.id !== 'portfolio.exclude' || !!lenderId)
      .map((a) => {
        let count = 0
        try {
          count = ready ? kl.filter(a.without(lastKnown), false).length : 0
        } catch {
          count = 0
        }
        return { ...a, count }
      })
      .sort((x, y) => y.count - x.count)
  }, [lastKnown, lenderId])

  // Said the way the criteria history says it (src/lib/describeCriteria.ts):
  // countries and field partners by name, exclusions as exclusions.
  const labelOf = (it: Parameters<typeof criteriaLabel>[0]) => criteriaLabel(it, t)
  const valueOf = (it: Parameters<typeof criteriaValue>[0]) =>
    criteriaValue(it, { t, data, partnerName: (id) => getKivaLoans().getPartner(Number(id))?.name }) ?? t('on')

  const chipBase: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    border: '1px solid var(--kl-overlay-border)',
    borderRadius: 999,
    padding: '4px 10px',
    margin: '3px',
    background: 'var(--kl-surface-raised)',
    cursor: 'pointer',
    fontSize: 13,
  }

  return (
    <div className="no-results-help">
      <Alert variant="info" className="not-rounded-top" style={{ marginBottom: 0 }}>
         {t('no_loans_match_current_criteria')}
      </Alert>
      <div style={{ background: 'var(--kl-green-light)', padding: '10px 12px' }}>
        {items.length > 0 ? (
          <>
            <div style={{ fontSize: 12, color: 'var(--kl-text-muted)', marginBottom: 4 }}>
               {t('active_filters_tap_remove_number')}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap' }}>
              {items.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  style={{
                    ...chipBase,
                    borderColor: it.count > 0 ? 'var(--kl-green)' : 'var(--kl-border-strong)',
                  }}
                   title={t('remove_label_value_count_loans', { label: labelOf(it), value: valueOf(it), count: it.count })}
                  onClick={() => setCriteria(it.without(lastKnown))}
                >
                  <span>
                    <strong>{labelOf(it)}:</strong> {valueOf(it)}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: it.count > 0 ? 'var(--kl-green-text)' : 'var(--kl-text-muted)',
                    }}
                  >
                    {it.count > 0 ? `+${it.count}` : '0'}
                  </span>
                  <span style={{ color: 'var(--kl-danger-text)', fontWeight: 700 }}>✕</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--kl-text-muted)' }}>{t('no_removable_filters_detected')}</div>
        )}
        <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {aiServerEnabled ? (
            <Button
              size="sm"
              variant="success"
              onClick={() =>
                openAskKl(
                   t('my_search_has_no_matching'),
                )
              }
            >
               ✨ {t('ask_kivalens_suggestion')}
            </Button>
          ) : null}
          <Button size="sm" variant="outline-secondary" onClick={() => startFresh()}>
             {t('reset_all_filters')}
          </Button>
        </div>
      </div>
    </div>
  )
}
