import { useMemo } from 'react'
import { Alert, Button } from '../ui'
import { useCriteriaStore } from '../stores/criteriaStore'
import { useUtilsStore } from '../stores/utilsStore'
import { getKivaLoans } from '../api/kiva'
import { activeCriteria } from '../lib/criteriaActive'
import { useI18n } from '../i18n'

// Shown in place of the plain "no matching loans" alert: lists the active filters
// causing zero results, with the count each removal would yield and a one-click
// remove, plus an "Ask KivaLens" suggestion shortcut.
export function NoResultsHelp() {
  const { t } = useI18n()
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

  const chipBase: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    border: '1px solid rgba(0,0,0,0.15)',
    borderRadius: 999,
    padding: '4px 10px',
    margin: '3px',
    background: '#fff',
    cursor: 'pointer',
    fontSize: 13,
  }

  return (
    <div className="no-results-help">
      <Alert variant="info" className="not-rounded-top" style={{ marginBottom: 0 }}>
         {t('No loans match your current criteria. Remove a filter below, loosen the criteria, or reset to start over.')}
      </Alert>
      <div style={{ background: '#eef5f1', padding: '10px 12px' }}>
        {items.length > 0 ? (
          <>
            <div style={{ fontSize: 12, color: '#557', marginBottom: 4 }}>
               {t('Your active filters — tap ✕ to remove (the number is how many loans you would get back):')}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap' }}>
              {items.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  style={{
                    ...chipBase,
                    borderColor: it.count > 0 ? 'var(--kl-green, #2C8C5E)' : 'rgba(0,0,0,0.15)',
                  }}
                   title={t('Remove “{label}: {value}” → {count} loans', { label: t(it.label), value: t(it.value), count: it.count })}
                  onClick={() => setCriteria(it.without(lastKnown))}
                >
                  <span>
                    <strong>{t(it.label)}:</strong> {t(it.value)}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: it.count > 0 ? 'var(--kl-green, #2C8C5E)' : '#999',
                    }}
                  >
                    {it.count > 0 ? `+${it.count}` : '0'}
                  </span>
                  <span style={{ color: '#b33', fontWeight: 700 }}>✕</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div style={{ fontSize: 13, color: '#557' }}>{t('No removable filters detected.')}</div>
        )}
        <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {aiServerEnabled ? (
            <Button
              size="sm"
              variant="success"
              onClick={() =>
                openAskKl(
                   t('My search has no matching loans. Break down which of my current filters are causing that, and suggest which to remove or loosen to get results.'),
                )
              }
            >
               ✨ {t('Ask KivaLens for a suggestion')}
            </Button>
          ) : null}
          <Button size="sm" variant="outline-secondary" onClick={() => startFresh()}>
             {t('Reset all filters')}
          </Button>
        </div>
      </div>
    </div>
  )
}
