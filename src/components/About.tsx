import { Container, Tabs, Tab } from '../ui'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { showLenderIDModal } from '../lib/showLenderIdModal'
import { useUtilsStore } from '../stores'
import { useI18n } from '../i18n'
import SupportEntries from '../support/SupportEntries'

function KivaLink({ path, children }: { path: string; children: React.ReactNode }) {
  return (
    <a href={`https://www.kiva.org/${path}`} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  )
}

function NewTabLink({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
      {children}
    </a>
  )
}

/** Each tab has its own address, so a link can land on the one it means. */
const TAB_PATHS: Record<string, string> = {
  'getting-started': '/about',
  advanced: '/about/advanced',
}

export default function About() {
  const { t, tx } = useI18n()
  const hasLenderId = Boolean(useUtilsStore((s) => s.lenderId))
  const { pathname } = useLocation()
  const navigate = useNavigate()
  // The router matches paths without regard to case, so /About/Advanced opens
  // this page too and has to open it on the tab it names.
  const activeTab =
    pathname.toLowerCase().replace(/\/+$/, '') === TAB_PATHS.advanced ? 'advanced' : 'getting-started'

  return (
    <Container className="py-3">
      <h1>{t('about_kivalens')}</h1>

      <Tabs
        activeKey={activeTab}
        onSelect={(key) => key && key !== activeTab && navigate(TAB_PATHS[key])}
        id="about-tabs"
        className="mb-0 about-tabs"
      >
        <Tab eventKey="getting-started" title={t('getting_started')}>
          <h3>{t('what_kivalens')}</h3>
          <p>
            {tx('kivalens_free_tool_on', { kiva: <KivaLink path="">Kiva.org</KivaLink> })}{' '}
            {t('find_loans_country_sector_repayment')}
          </p>

          {!hasLenderId ? (
            <>
              <h3>{t('what_kiva')}</h3>
              <p>
                {tx('kiva_nonprofit_description', { kiva: <KivaLink path="invitedby/nuclearspike">Kiva</KivaLink> })}
              </p>
            </>
          ) : null}

          <h3>{t('quick_start')}</h3>
          <ol className="spacedList">
            <li>
               {t('search_loans_use_search_tab')}
            </li>
            <li>
               {t('review_loan_click_any_loan')}
            </li>
            <li>
               {t('lend_click_lend_loans_like')}
            </li>
            <li>
               {t('check_out_kiva_go_basket')}
            </li>
          </ol>

          <h3>{t('set_up_lender_id')}</h3>
          <p>
            {tx('set_lender_id_benefit', {
              link: (
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    showLenderIDModal()
                  }}
                >
                  {t('set_kiva_lender_id_3')}
                </a>
              ),
            })}
          </p>

          <h3>{t('save_searches')}</h3>
          <p>
            {tx('found_useful_filters_save', { savedTab: <Link to="/saved">{t('saved')}</Link> })}
          </p>
        </Tab>

        <Tab eventKey="advanced" title={t('advanced')}>
          <h3>{t('sorting_filtering_repayment')}</h3>
          <p>
            {t('kiva_sorts_repayment_terms_which')}
          </p>

          <h3>{t('any_all_none_filtering')}</h3>
          <p>
            {t('fields_multiple_values_choose_any')}
          </p>

          <h3>{t('portfolio_balancing')}</h3>
          <p>
            {t('use_portfolio_criteria_tab_balance')}
          </p>

          <h3>{t('partners_tab')}</h3>
          <p>
            {t('browse_active_closed_paused_kiva')}
          </p>

          <h3>{t('team_research')}</h3>
          <p>
            {tx('research_credit_aplus', { aplus: <KivaLink path="team/aplus">A+ Team</KivaLink> })}{' '}
            {t('includes_secular_social_ratings_plus')}
          </p>

          <h3>{t('rss_feeds')}</h3>
          <p>
            {tx('rss_set_criteria_or_ifttt', { ifttt: <NewTabLink href="https://www.ifttt.com">IFTTT</NewTabLink> })}
          </p>

          <h3>{t('reducing_risk')}</h3>
          <ul className="spacedList">
            <li>
               {t('risk_rating_kivas_assessment_partner')}
            </li>
            <li>
               {t('currency_exchange_risk_exchange_rate')}
            </li>
            <li>
               {t('default_rates_all_partners_have')}
            </li>
            <li>
               {t('portfolio_yield_interest_fees_charged')}
            </li>
            <li>
               {t('diversify_spread_lending_across_partners')}
            </li>
            <li>
               {t('repeat_borrowers_returning_borrower')}
            </li>
          </ul>

          <h3>{t('questions_problems')}</h3>
          <p>
            <SupportEntries look="buttons" />
          </p>
          {/* Two routes for help: KivaLens itself through Send Feedback (followed up
              under My Reports), and Kiva's own account and loan questions through
              Kiva. No email or GitHub-issue route: a report sent any other way cannot
              be followed under My Reports. */}
          <p>{tx('kiva_questions_help_center', { helpCenter: <KivaLink path="help">{t('kivas_help_center')}</KivaLink> })}</p>
          <p className="text-muted">
            {tx('about_sources_code_team', {
              api: <NewTabLink href="https://build.kiva.org/api">{t('kivas_public_api')}</NewTabLink>,
              code: <NewTabLink href="https://github.com/nuclearspike/kivalens">{t('browse_code_github')}</NewTabLink>,
              team: <KivaLink path="team/kivalens">{t('kivalens_lending_team')}</KivaLink>,
            })}
          </p>
        </Tab>
      </Tabs>
    </Container>
  )
}
