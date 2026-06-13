import { useMemo } from 'react'
import { Container, Row, Col } from '../ui'
import numeral from 'numeral'
import { formatDistanceToNow } from 'date-fns'
import { useLoanStore } from '../stores'
import { getKivaLoans } from '../api/kiva'

function AnimInt({ value }: { value: number }) {
  return <span>{numeral(Math.round(value)).format('0,0')}</span>
}

/**
 * Live Kiva lending statistics page.
 * Shows running totals since session start and current fundraising snapshot.
 */
export default function Live() {
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
      <Row>
        <h1>Kiva Lending</h1>
        <p>
          {startupTime ? (
            <>
              Session started {formatDistanceToNow(startupTime, { addSuffix: true })}.{' '}
            </>
          ) : null}
          Stats are updated from periodic syncs with Kiva&apos;s API.
        </p>
      </Row>
      <Row>
        <Col md={4}>
          <h3>Since session start</h3>
          <dl className="dl-horizontal" style={{ fontSize: 'large' }}>
            <dt>New Loans</dt>
            <dd><AnimInt value={totals.new_loans} /></dd>

            <dt>Fully Funded</dt>
            <dd><AnimInt value={totals.funded_loans} /></dd>

            <dt>Expired</dt>
            <dd><AnimInt value={totals.expired_loans} /></dd>

            <dt>Lending Total</dt>
            <dd>$<AnimInt value={totals.funded_amount} /></dd>
          </dl>
        </Col>
        <Col md={4}>
          <h3>Fundraising Loans</h3>
          <dl className="dl-horizontal" style={{ fontSize: 'large' }}>
            <dt>Fundraising</dt>
            <dd>$<AnimInt value={fundraisingAmount} /></dd>

            <dt>Funded Amount</dt>
            <dd>$<AnimInt value={fundedSum} /></dd>

            <dt>In Baskets</dt>
            <dd>$<AnimInt value={basketAmount} /></dd>

            <dt>Still Needed</dt>
            <dd>$<AnimInt value={stillNeeded} /></dd>

            <dt>Average Funded</dt>
            <dd><AnimInt value={avgPercentFunded} />%</dd>
          </dl>
        </Col>
      </Row>
    </Container>
  )
}
