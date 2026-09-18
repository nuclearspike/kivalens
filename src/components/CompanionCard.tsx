import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Card } from '../ui'
import { companion } from '../api/companion'
import { useI18n } from '../i18n'

const muted = { color: 'var(--kl-text-muted)' }

/**
 * Surfaces the optional KivaLens Companion extension on the Options page. Only rendered when
 * the integration is enabled (VITE_COMPANION_EXT_ID set) - the parent gates on companionEnabled.
 */
export default function CompanionCard() {
  const { t } = useI18n()
  const [available, setAvailable] = useState<boolean | null>(null)
  const [version, setVersion] = useState<string | null>(null)
  const [hasToken, setHasToken] = useState(false)
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    setBusy(true)
    try {
      const ok = await companion.ping()
      setAvailable(ok)
      if (ok) {
        const f = await companion.getFeatures().catch(() => null)
        setVersion(f?.version ?? null)
        const s = await companion.getStatus().catch(() => null)
        setHasToken(!!s?.hasToken)
      }
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return (
    <Card className="mb-3">
      <Card.Header>{t('kivalens_companion_browser_extension')}</Card.Header>
      <Card.Body>
        <p>
          {t('optional_kivalens_companion_browser')}
        </p>

        {available === null ? <p style={muted}>{t('checking_extension_ellipsis')}</p> : null}

        {available === true ? (
          <Alert variant="success">
            {t('connected')}{version ? ` (v${version})` : ''}.{' '}
            {hasToken
              ? t('authenticated_kiva_session')
              : t('open_kiva_org_another_tab')}
          </Alert>
        ) : null}

        {available === false ? (
          <Alert variant="secondary">
            {t('not_detected_install_kivalens_companion')}
          </Alert>
        ) : null}

        <p style={{ marginTop: 12, marginBottom: 4 }}>
          <b>{t('what_unlocks')}</b>
        </p>
        <ul className="spacedList">
          <li>{t('exact_portfolio_breakdowns_country')}</li>
          <li>{t('real_account_ledger_deposits_donations')}</li>
          <li>{t('auto_detect_lender_id_coming_soon')}</li>
        </ul>

        <Button variant="link" size="sm" onClick={() => void refresh()} disabled={busy}>
          {busy ? t('checking_ellipsis') : t('refresh')}
        </Button>
      </Card.Body>
    </Card>
  )
}
