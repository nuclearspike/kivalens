import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Card } from '../ui'
import { companion } from '../api/companion'
import { useI18n } from '../i18n'

const muted = { color: '#6b7280' }

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
      <Card.Header>{t('KivaLens Companion (browser extension)')}</Card.Header>
      <Card.Body>
        <p>
          {t('The optional KivaLens Companion browser extension securely connects KivaLens to your logged-in Kiva account, so KivaLens can read your exact portfolio, account balances, saved searches, and Auto-Lending settings. Your Kiva login and access token never leave your browser — KivaLens only receives the resulting data.')}
        </p>

        {available === null ? <p style={muted}>{t('Checking for the extension…')}</p> : null}

        {available === true ? (
          <Alert variant="success">
            {t('Connected')}{version ? ` (v${version})` : ''}.{' '}
            {hasToken
              ? t('Authenticated with your Kiva session.')
              : t('Open kiva.org in another tab and log in to authenticate.')}
          </Alert>
        ) : null}

        {available === false ? (
          <Alert variant="secondary">
            {t('Not detected. Install the KivaLens Companion extension to enable these features.')}
          </Alert>
        ) : null}

        <p style={{ marginTop: 12, marginBottom: 4 }}>
          <b>{t('What it unlocks:')}</b>
        </p>
        <ul className="spacedList">
          <li>{t('Exact portfolio breakdowns by country, sector, partner, and gender (instead of estimates).')}</li>
          <li>{t('Your real account ledger — deposits, donations, repayments, currency, and default losses.')}</li>
          <li>{t('Auto-detect your Lender ID and, coming soon, synchronize saved searches and Auto-Lending settings.')}</li>
        </ul>

        <Button variant="link" size="sm" onClick={() => void refresh()} disabled={busy}>
          {busy ? t('Checking…') : t('Refresh')}
        </Button>
      </Card.Body>
    </Card>
  )
}
