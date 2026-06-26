import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Button } from '../ui'
import numeral from 'numeral'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts'
import type { Partner } from '../types'
import { useLoanStore, useCriteriaStore } from '../stores'
import KivaImage from './KivaImage'

interface PartnerDetailProps {
  partner: Partner
  showStatus?: boolean
}

const statusVariant: Record<string, string> = {
  active: 'success',
  inactive: 'secondary',
  paused: 'warning',
  closed: 'danger',
}

function KivaLink({ path, children }: { path: string; children: React.ReactNode }) {
  return (
    <a href={`https://www.kiva.org/${path}`} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  )
}

export default function PartnerDetail({ partner, showStatus = true }: PartnerDetailProps) {
  const navigate = useNavigate()
  const loans = useLoanStore((s) => s.loans)
  const setCriteria = useCriteriaStore((s) => s.setCriteria)
  const blankCriteria = useCriteriaStore((s) => s.blankCriteria)

  const fundraisingLoans = useMemo(
    () =>
      partner.status !== 'active'
        ? []
        : loans.filter((l) => l.partner_id === partner.id && l.status === 'fundraising'),
    [loans, partner.id, partner.status],
  )
  const loanCount = fundraisingLoans.length

  // Sector distribution of this partner's CURRENT fundraising loans. Lives in
  // PartnerDetail so it renders on BOTH the Partners page and the loan Partner tab.
  const sectorData = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const l of fundraisingLoans) {
      const s = l.sector || 'Unknown'
      counts[s] = (counts[s] || 0) + 1
    }
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [fundraisingLoans])

  const searchLoans = () => {
    const crit = blankCriteria()
    ;(crit.partner as Record<string, unknown>).partners = partner.id.toString()
    setCriteria(crit)
    navigate('/search')
  }

  const countryNames = partner.countries?.map((c) => c.name).join(', ') ?? '(unknown)'
  const atheistScore = partner.atheistScore
  const showAtheistResearch = !!atheistScore

  return (
    <div className="PartnerDetail">
      {loanCount > 0 && (
        <div
          className="d-flex align-items-center justify-content-between mb-2 p-2 rounded"
          style={{ background: '#e8f5e9' }}
        >
          <span>
            <b>{numeral(loanCount).format('0,0')}</b> fundraising loan
            {loanCount !== 1 ? 's' : ''}
          </span>
          <Button size="sm" variant="success" onClick={searchLoans}>
            Show Loans
          </Button>
        </div>
      )}

      <h2>
        <KivaLink path={`about/where-kiva-works/partners/${partner.id}`}>
          <span
            className="d-inline-block text-center text-white fw-bold align-middle"
            style={{
              width: 18,
              height: 18,
              lineHeight: '18px',
              borderRadius: '50%',
              background: '#2C8C5E',
              fontSize: 11,
              marginRight: 6,
              position: 'relative',
              top: -2,
            }}
          >
            K
          </span>
        </KivaLink>
        {partner.name}
        {showStatus && partner.status !== 'active' && (
          <>{' '}
            <Badge bg={statusVariant[partner.status] ?? 'secondary'}>{partner.status}</Badge>
          </>
        )}
      </h2>

      <div className="row">
        <div className="col-lg-6">
          <dl className="dl-horizontal">
            <dt>Rating</dt>
            <dd>{partner.rating}</dd>
            {partner.status !== 'active' && (
              <>
                <dt>Status</dt>
                <dd style={{ textTransform: 'capitalize' }}>{partner.status}</dd>
              </>
            )}
            <dt>Start Date</dt>
            <dd>
              {new Date(partner.start_date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </dd>
            <dt>{partner.countries?.length === 1 ? 'Country' : 'Countries'}</dt>
            <dd>{countryNames}</dd>
            <dt>Delinquency</dt>
            <dd>
              {numeral(partner.delinquency_rate).format('0.000')}%{' '}
              {(partner as unknown as { delinquency_rate_note?: string }).delinquency_rate_note}
            </dd>
            <dt>Loans at Risk Rate</dt>
            <dd>{numeral(partner.loans_at_risk_rate).format('0.000')}%</dd>
            <dt>Default</dt>
            <dd>
              {numeral(partner.default_rate).format('0.000')}%{' '}
              {(partner as unknown as { default_rate_note?: string }).default_rate_note}
            </dd>
            <dt>Total Raised</dt>
            <dd>${numeral((partner as unknown as { total_amount_raised?: number }).total_amount_raised).format('0,0')}</dd>
            <dt>Loans</dt>
            <dd>{numeral(partner.loans_posted).format('0,0')}</dd>
            <dt>Portfolio Yield</dt>
            <dd>
              {numeral(partner.portfolio_yield).format('0.0')}%{' '}
              {(partner as unknown as { portfolio_yield_note?: string }).portfolio_yield_note}
            </dd>
            <dt>Profitability</dt>
            {partner.profitability != null ? (
              <dd>{numeral(partner.profitability).format('0.0')}%</dd>
            ) : (
              <dd>(unknown)</dd>
            )}
            <dt>Charges Fees / Interest</dt>
            <dd>{partner.charges_fees_and_interest ? 'Yes' : 'No'}</dd>
            <dt>Avg Loan/Cap Income</dt>
            <dd>{numeral(partner.average_loan_size_percent_per_capita_income).format('0.00')}%</dd>
            <dt>Currency Ex Loss</dt>
            <dd>{numeral(partner.currency_exchange_loss_rate).format('0.000')}%</dd>
            {(partner as unknown as { url?: string }).url ? (
              <>
                <dt>Website</dt>
                <dd>
                  <a href={(partner as unknown as { url?: string }).url} target="_blank" rel="noreferrer">
                    {(partner as unknown as { url?: string }).url}
                  </a>
                </dd>
              </>
            ) : null}
          </dl>
        </div>

        <div className="col-lg-6">
          <KivaImage
            image_id={(partner as unknown as { image?: { id: number } }).image?.id}
            image_width={800}
            width={800}
            type="width"
          />
        </div>
      </div>

      {sectorData.length > 0 && (
        <div className="mt-3">
          <h3>Fundraising Loans by Sector</h3>
          <ResponsiveContainer width="100%" height={Math.max(120, sectorData.length * 30)}>
            <BarChart data={sectorData} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
              <XAxis type="number" hide allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#2C8C5E" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {partner.kl_sp && partner.kl_sp.length > 0 && partner.social_performance_strengths && (
        <div className="mt-3">
          <h3>Social Performance Strengths</h3>
          <ul>
            {partner.social_performance_strengths.map((sp, i) => (
              <li key={i}>
                <b>{(sp as unknown as { name: string }).name}</b>
                {': '}
                {(sp as unknown as { description: string }).description}
              </li>
            ))}
          </ul>
        </div>
      )}

      {showAtheistResearch && atheistScore && (
        <div className="mt-3">
          <h3>A+ Team Research</h3>
          <dl className="dl-horizontal">
            <dt>Secular Rating</dt>
            <dd>{atheistScore.secularRating}</dd>
            <dt>Religious Affiliation</dt>
            <dd>{atheistScore.religiousAffiliation}</dd>
            <dt>Comments on Rating</dt>
            <dd>{atheistScore.commentsOnSecularRating}</dd>
            <dt>Social Rating</dt>
            <dd>{atheistScore.socialRating}</dd>
            <dt>Comments on Rating</dt>
            <dd>{atheistScore.commentsOnSocialRating}</dd>
            <dt>Review Comments</dt>
            <dd>{atheistScore.reviewComments}</dd>
          </dl>
        </div>
      )}
    </div>
  )
}
