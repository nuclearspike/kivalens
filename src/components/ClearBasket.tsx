import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../i18n'

// Kiva's basket-set callback lands here (in the checkout tab). We deliberately
// do NOT blind-clear the basket — a callback fires when the basket is *set*, not
// when payment completes, so clearing here would assume a lend that may not have
// happened. Instead we notify any open tab and route to the basket, where the
// outcome is reconciled (confirm against Kiva, or ask) per T1.1.
export default function ClearBasket() {
  const { t } = useI18n()
  const navigate = useNavigate()

  useEffect(() => {
    try {
      if ('BroadcastChannel' in window) {
        const bc = new BroadcastChannel('kivalens')
        bc.postMessage({ type: 'checkout-returned' })
        bc.close()
      }
    } catch {
      /* BroadcastChannel unavailable — the basket page reconciles on mount anyway */
    }
    navigate('/basket', { replace: true })
  }, [navigate])

  return <div><span>{t('One moment…')}</span></div>
}
