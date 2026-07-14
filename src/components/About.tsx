import { Container, Tabs, Tab } from '../ui'
import { Link } from 'react-router-dom'
import { showLenderIDModal } from '../lib/showLenderIdModal'
import { useUtilsStore } from '../stores'
import { useI18n } from '../i18n'

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

function EmailLink({
  subject,
  body,
  children,
}: {
  subject: string
  body: string
  children: React.ReactNode
}) {
  const href = `mailto:contact@kivalens.org?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  return <a href={href}>{children}</a>
}

export default function About() {
  const { t } = useI18n()
  const hasLenderId = Boolean(useUtilsStore((s) => s.lenderId))

  return (
    <Container className="py-3">
      <h1>{t('About KivaLens')}</h1>

      <Tabs defaultActiveKey="getting-started" id="about-tabs" className="mb-0 about-tabs">
        <Tab eventKey="getting-started" title={t('Getting Started')}>
          <h3>{t('What is KivaLens?')}</h3>
          <p>
            {t('KivaLens is a free tool with powerful ways to search for loans on')}{' '}
            <KivaLink path="">Kiva.org</KivaLink>.{' '}
            {t('Find loans by country, sector, repayment speed, partner quality, and much more — then add them to your basket and check out on Kiva.')}
          </p>

          {!hasLenderId ? (
            <>
              <h3>{t('What is Kiva?')}</h3>
              <p>
                <KivaLink path="invitedby/nuclearspike">Kiva</KivaLink>{' '}
                {t('is a nonprofit where you can lend as little as $25 to borrowers around the world. Borrowers repay over time and you can lend that money again. It is not a donation — it is a loan that makes a real difference.')}
              </p>
            </>
          ) : null}

          <h3>{t('Quick Start')}</h3>
          <ol className="spacedList">
            <li>
               {t('Search for loans — Use the Search tab. Filter by country, sector, repayment terms, partner risk, and dozens of other options. Results update as you change filters.')}
            </li>
            <li>
               {t('Review a loan — Click any loan to see details, its repayment schedule, and partner information.')}
            </li>
            <li>
               {t('Lend — Click “Lend” on loans you like. Use “Bulk Add” to add many at once.')}
            </li>
            <li>
               {t('Check out on Kiva — Go to the Basket tab and transfer your basket to complete the loans on Kiva.')}
            </li>
          </ol>

          <h3>{t('Set Up Your Lender ID')}</h3>
          <p>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault()
                showLenderIDModal()
              }}
            >
               {t('Set your Kiva lender ID')}
            </a>{' '}
             {t('so KivaLens can hide loans you have already funded and enable portfolio balancing and the 3D Wall.')}
          </p>

          <h3>{t('Save Your Searches')}</h3>
          <p>
            {t('Found a useful set of filters? Save it from the Saved Searches menu. KivaLens includes presets such as “Expiring Soon” and “Balance Partner Risk”. Manage all saved searches on the')}{' '}
            <Link to="/saved">{t('Saved')}</Link> {t('tab.')}
          </p>
        </Tab>

        <Tab eventKey="advanced" title={t('Advanced')}>
          <h3>{t('Sorting & Filtering by Repayment')}</h3>
          <p>
            {t('Kiva sorts by repayment terms, which do not account for when a loan was posted or disbursed. KivaLens sorts by final repayment date relative to today. You can also sort by the dates when 50% or 75% will be repaid.')}
          </p>

          <h3>{t('Any / All / None Filtering')}</h3>
          <p>
            {t('For fields with multiple values, choose Any to match at least one, All to require every selection, or None to exclude all selected values.')}
          </p>

          <h3>{t('Portfolio Balancing')}</h3>
          <p>
            {t('Use the Portfolio criteria tab to balance lending across countries, sectors, activities, and partners. This can diversify your portfolio and reduce concentration risk.')}
          </p>

          <h3>{t('Partners Tab')}</h3>
          <p>
            {t('Browse active, closed, and paused Kiva field partners. Filter by country, risk rating, delinquency, religion, and more, then show that partner’s fundraising loans.')}
          </p>

          <h3>{t('A+ Team Research')}</h3>
          <p>
            {t('KivaLens integrates field-partner research from the')}{' '}
            <KivaLink path="team/aplus">A+ Team</KivaLink>.{' '}
            {t('It includes secular and social ratings plus religious-affiliation data, available in Partner filters and details.')}
          </p>

          <h3>{t('RSS Feeds')}</h3>
          <p>
            {t('Set your criteria and use the RSS tab to create a feed for any RSS reader or')}{' '}
            <NewTabLink href="https://www.ifttt.com">IFTTT</NewTabLink>{' '}
            {t('to be notified when new matching loans are posted.')}
          </p>

          <h3>{t('Reducing Risk')}</h3>
          <ul className="spacedList">
            <li>
               {t('Risk Rating: Kiva’s assessment of partner failure risk. More stars mean lower institutional risk; this does not predict individual borrower default.')}
            </li>
            <li>
               {t('Currency Exchange Risk: Exchange-rate changes can reduce repayment on non-USD loans. Use the Currency Loss filter and partner loss rate to manage it.')}
            </li>
            <li>
               {t('Default Rates: All partners can have defaults. A 0% rate often means the partner covers losses.')}
            </li>
            <li>
               {t('Portfolio Yield: This is interest and fees charged by the partner, not a return to you. High values can reflect small rural loans with high servicing costs.')}
            </li>
            <li>
               {t('Diversify: Spread lending across partners and countries. Portfolio Balancing helps limit exposure to any single partner.')}
            </li>
            <li>
               {t('Repeat Borrowers: A returning borrower often indicates a successful prior loan. Historical repayment has been slightly higher for #RepeatBorrower than #FirstLoan loans.')}
            </li>
          </ul>

          <h3>{t('Questions or Problems?')}</h3>
          <p>
             {t('Data comes from')}{' '}
             <NewTabLink href="https://build.kiva.org/api">
              {t("Kiva's Public API")}
            </NewTabLink>
             . {t('For questions about loan data, contact')}{' '}
            <KivaLink path="help">{t("Kiva's Help Center")}</KivaLink>. {t('For KivaLens bugs,')}{' '}
            <NewTabLink href="https://github.com/nuclearspike/kivalens/issues">
               {t('open an issue on GitHub')}
            </NewTabLink>{' '}
             {t('or')}{' '}
            <EmailLink
               subject={t('KivaLens Bug')}
              body={t('I found a bug!\nThe problem is…\nSteps to reproduce…')}
            >
               {t('email me')}
            </EmailLink>
             . {t('Join the')}{' '}
            <KivaLink path="team/kivalens">{t('KivaLens Lending Team')}</KivaLink> {t('for discussion and announcements.')}
          </p>
          <p>
             {t('KivaLens is open source — you can')}{' '}
            <NewTabLink href="https://github.com/nuclearspike/kivalens">
               {t('browse the code on GitHub')}
            </NewTabLink>
            .
          </p>
        </Tab>
      </Tabs>
    </Container>
  )
}
