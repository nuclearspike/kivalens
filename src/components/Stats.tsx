import { useMemo } from 'react'
import { Container, Row, Col } from '../ui'
import { useLoanStore } from '../stores'
import { useI18n } from '../i18n'
import { getKivaLoans } from '../api/kiva'
import YourLending from './YourLending'

function AnimInt({ value }: { value: number }) {
  const { number } = useI18n()
  return <span>{number(Math.round(value))}</span>
}

/**
 * The Stats page: live Kiva lending totals.
 * Shows running totals since session start and current fundraising snapshot.
 */
export default function Stats() {
  const { t, relativeTime } = useI18n()
  const loans = useLoanStore((s) => s.loans)
  const runningTotals = useLoanStore((s) => s.runningTotals)

  const totals = runningTotals ?? {
    funded_amount: 0,
    funded_loans: 0,
    new_loans: 0,
    expired_loans: 0,
  }

  const {
    fundedSum,
    stillNeeded,
    basketAmount,
    fundraisingAmount,
    avgPercentFunded,
  } = useMemo(() => {
    const fundraisingLoans = loans.filter((loan) => loan.status === 'fundraising')
    const funded = fundraisingLoans.reduce((sum, loan) => sum + loan.funded_amount, 0)
    const needed = fundraisingLoans.reduce((sum, loan) => sum + (loan.kl_still_needed ?? 0), 0)
    const basket = fundraisingLoans.reduce((sum, loan) => sum + loan.basket_amount, 0)
    const fundraising = fundraisingLoans.reduce((sum, loan) => sum + loan.loan_amount, 0)
    const avgFunded = fundraisingLoans.length
      ? fundraisingLoans.reduce((sum, loan) => sum + (loan.kl_percent_funded ?? 0), 0) /
        fundraisingLoans.length
      : 0

    return {
      fundedSum: funded,
      stillNeeded: needed,
      basketAmount: basket,
      fundraisingAmount: fundraising,
      avgPercentFunded: avgFunded,
    }
  }, [loans])

  const startupTime = getKivaLoans()?.startupTime

  return (
    <Container className="py-3">
      <YourLending />
      <Row>
        <h1>{t('kiva_lending')}</h1>
        <p>
          {startupTime ? `${t('session_started_time', { time: relativeTime(startupTime) })} ` : null}
          {t('stats_updated_periodic_syncs_kivas')}
        </p>
      </Row>
      <Row>
        <Col md={4}>
          <h3>{t('since_session_start')}</h3>
          <dl className="dl-horizontal" style={{ fontSize: 'large' }}>
            <dt>{t('new_loans')}</dt>
            <dd><AnimInt value={totals.new_loans} /></dd>

            <dt>{t('fully_funded')}</dt>
            <dd><AnimInt value={totals.funded_loans} /></dd>

            <dt>{t('expired')}</dt>
            <dd><AnimInt value={totals.expired_loans} /></dd>

            <dt>{t('lending_total')}</dt>
            <dd>$<AnimInt value={totals.funded_amount} /></dd>
          </dl>
        </Col>
        <Col md={4}>
          <h3>{t('fundraising_loans')}</h3>
          <dl className="dl-horizontal" style={{ fontSize: 'large' }}>
            <dt>{t('fundraising')}</dt>
            <dd>$<AnimInt value={fundraisingAmount} /></dd>

            <dt>{t('funded_amount')}</dt>
            <dd>$<AnimInt value={fundedSum} /></dd>

            <dt>{t('baskets')}</dt>
            <dd>$<AnimInt value={basketAmount} /></dd>

            <dt>{t('still_needed')}</dt>
            <dd>$<AnimInt value={stillNeeded} /></dd>

            <dt>{t('average_funded')}</dt>
            <dd><AnimInt value={avgPercentFunded} />%</dd>
          </dl>
        </Col>
      </Row>
    </Container>
  )
}
