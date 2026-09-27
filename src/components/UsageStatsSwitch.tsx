import { useSyncExternalStore, type ReactNode } from 'react'
import { Form } from '../ui'
import { useI18n } from '../i18n'
import { readUsageChoice, sendsGlobalPrivacyControl, setUsageChoice, subscribeUsageChoice, usageAllowed } from '../lib/rum/identity'

/**
 * Whether this browser shares usage statistics (src/lib/rum/identity.ts). The
 * same control on Options and on the Privacy page; either one, or another tab,
 * changing the choice updates every copy. `help` is the line under it, which
 * each page words for its own context.
 */
export default function UsageStatsSwitch({ id, help }: { id: string; help?: ReactNode }) {
  const { t } = useI18n()
  const choice = useSyncExternalStore(subscribeUsageChoice, () => readUsageChoice(), () => null)
  const gpc = sendsGlobalPrivacyControl()
  const on = usageAllowed(choice, gpc)
  return (
    <Form.Group>
      <Form.Check
        type="checkbox"
        id={id}
        label={t('usage_stats_switch')}
        checked={on}
        onChange={(e) => setUsageChoice(e.target.checked)}
      />
      {help ? <Form.Text className="text-muted d-block">{help}</Form.Text> : null}
      {/* Shown for as long as the browser sends the signal, not only until the lender
          chooses: it says why the switch started off, and it never leaves on the click. */}
      {gpc ? <Form.Text className="text-muted d-block">{t('usage_stats_gpc_note')}</Form.Text> : null}
    </Form.Group>
  )
}
