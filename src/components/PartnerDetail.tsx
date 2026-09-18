import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Button } from '../ui'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts'
import type { Partner } from '../types'
import { useLoanStore, useCriteriaStore } from '../stores'
import KivaImage from './KivaImage'
import { useI18n } from '../i18n'

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
  const { t, sector, date, number, currency, percent } = useI18n()
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
      .map(([name, value]) => ({ name: sector(name), value }))
      .sort((a, b) => b.value - a.value)
  }, [fundraisingLoans, sector])

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
          style={{ background: 'var(--kl-green-light)' }}
        >
          <span>
            {t('count_fundraising_loans', { count: number(loanCount) })}
          </span>
          <Button size="sm" variant="success" onClick={searchLoans}>
             {t('show_loans')}
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
              background: 'var(--kl-green)',
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
            <Badge bg={statusVariant[partner.status] ?? 'secondary'}>{t(partner.status)}</Badge>
          </>
        )}
      </h2>

      <div className="row">
        <div className="col-lg-6">
          <dl className="dl-horizontal">
            <dt>{t('rating')}</dt>
            <dd>{partner.rating}</dd>
            {partner.status !== 'active' && (
              <>
                <dt>{t('status')}</dt>
                <dd>{t(partner.status)}</dd>
              </>
            )}
            <dt>{t('start_date')}</dt>
            <dd>{date(partner.start_date, { dateStyle: 'medium' })}</dd>
            <dt>{t(partner.countries?.length === 1 ? 'country_2' : 'countries')}</dt>
            <dd>{countryNames}</dd>
            <dt>{t('delinquency')}</dt>
            <dd>
              {percent(partner.delinquency_rate, 3)}{' '}
              {(partner as unknown as { delinquency_rate_note?: string }).delinquency_rate_note}
            </dd>
            <dt>{t('loans_risk_rate')}</dt>
            <dd>{percent(partner.loans_at_risk_rate, 3)}</dd>
            <dt>{t('default')}</dt>
            <dd>
              {percent(partner.default_rate, 3)}{' '}
              {(partner as unknown as { default_rate_note?: string }).default_rate_note}
            </dd>
            <dt>{t('total_raised')}</dt>
            <dd>{currency((partner as unknown as { total_amount_raised?: number }).total_amount_raised)}</dd>
            <dt>{t('loans')}</dt>
            <dd>{number(partner.loans_posted)}</dd>
            <dt>{t('portfolio_yield')}</dt>
            <dd>
              {percent(partner.portfolio_yield, 1)}{' '}
              {(partner as unknown as { portfolio_yield_note?: string }).portfolio_yield_note}
            </dd>
            <dt>{t('profitability')}</dt>
            {partner.profitability != null ? (
              <dd>{percent(partner.profitability, 1)}</dd>
            ) : (
              <dd>{t('unknown')}</dd>
            )}
            <dt>{t('charges_fees_interest')}</dt>
            <dd>{t(partner.charges_fees_and_interest ? 'yes' : 'no')}</dd>
            <dt>{t('avg_loan_cap_income')}</dt>
            <dd>{percent(partner.average_loan_size_percent_per_capita_income, 2)}</dd>
            <dt>{t('currency_ex_loss')}</dt>
            <dd>{percent(partner.currency_exchange_loss_rate, 3)}</dd>
            {(partner as unknown as { url?: string }).url ? (
              <>
                <dt>{t('website')}</dt>
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
          <h3>{t('fundraising_loans_sector')}</h3>
          <ResponsiveContainer width="100%" height={Math.max(120, sectorData.length * 30)}>
            <BarChart data={sectorData} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
              <XAxis type="number" hide allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="value" fill="var(--kl-green)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {partner.kl_sp && partner.kl_sp.length > 0 && partner.social_performance_strengths && (
        <div className="mt-3">
          <h3>{t('social_performance_strengths')}</h3>
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
          <h3>{t('team_research')}</h3>
          <dl className="dl-horizontal">
            <dt>{t('secular_rating')}</dt>
            <dd>{atheistScore.secularRating}</dd>
            <dt>{t('religious_affiliation')}</dt>
            <dd>{atheistScore.religiousAffiliation}</dd>
            <dt>{t('comments_rating')}</dt>
            <dd>{atheistScore.commentsOnSecularRating}</dd>
            <dt>{t('social_rating')}</dt>
            <dd>{atheistScore.socialRating}</dd>
            <dt>{t('comments_rating')}</dt>
            <dd>{atheistScore.commentsOnSocialRating}</dd>
            <dt>{t('review_comments')}</dt>
            <dd>{atheistScore.reviewComments}</dd>
          </dl>
        </div>
      )}
    </div>
  )
}
