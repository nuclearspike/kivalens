import { Container, Tabs, Tab } from '../ui'
import { Link } from 'react-router-dom'
import { showLenderIDModal } from '../lib/showLenderIdModal'
import { useUtilsStore } from '../stores'

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
  const href = `mailto:liquidmonkey@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  return <a href={href}>{children}</a>
}

export default function About() {
  const hasLenderId = Boolean(useUtilsStore((s) => s.lenderId))

  return (
    <Container className="py-3">
      <h1>About KivaLens</h1>

      <Tabs defaultActiveKey="getting-started" id="about-tabs" className="mb-0 about-tabs">
        <Tab eventKey="getting-started" title="Getting Started">
          <h3>What is KivaLens?</h3>
          <p>
            KivaLens is a free tool that gives you powerful ways to search for loans
            on <KivaLink path="">Kiva.org</KivaLink>. Find loans by country, sector,
            repayment speed, partner quality, and much more — then add them to your
            basket and check out on Kiva.
          </p>

          {!hasLenderId ? (
            <>
              <h3>What is Kiva?</h3>
              <p>
                <KivaLink path="invitedby/nuclearspike">Kiva</KivaLink> is a
                non-profit where you lend as little as $25 to borrowers around the
                world. Borrowers repay over time (over 97% repayment rate) and you
                can re-lend that money to someone else. It&apos;s not a donation — it&apos;s
                a loan that makes a real difference.
              </p>
            </>
          ) : null}

          <h3>Quick Start</h3>
          <ol className="spacedList">
            <li>
              <b>Search for loans</b> — Use the Search tab. The criteria panel on the
              left lets you filter by country, sector, repayment terms, partner risk,
              and dozens of other options. Results update instantly as you change
              filters.
            </li>
            <li>
              <b>Review a loan</b> — Click any loan in the list to see details,
              repayment schedule, and partner information on the right.
            </li>
            <li>
              <b>Lend</b> — Click &quot;Lend&quot; on loans you like. Use &quot;Bulk Add&quot;
              {' '}to add many at once.
            </li>
            <li>
              <b>Check out on Kiva</b> — Go to the Basket tab and click &quot;Transfer to
              Kiva&quot; to complete your loans on Kiva&apos;s site.
            </li>
          </ol>

          <h3>Set Up Your Lender ID</h3>
          <p>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault()
                showLenderIDModal()
              }}
            >
              Set your Kiva lender ID
            </a>{' '}
            so KivaLens can hide loans you&apos;ve already funded and enable portfolio
            balancing and the 3D Wall.
          </p>

          <h3>Save Your Searches</h3>
          <p>
            Found a great set of filters? Use the &quot;Saved Search&quot; dropdown in
            the criteria panel to save it. KivaLens comes with some preset searches
            like &quot;Expiring Soon&quot; and &quot;Balance Partner Risk&quot; to get
            you started. Manage all your saved searches on the{' '}
            <Link to="/saved">Saved</Link> tab.
          </p>
        </Tab>

        <Tab eventKey="advanced" title="Advanced">
          <h3>Sorting &amp; Filtering by Repayment</h3>
          <p>
            Kiva sorts by repayment <i>terms</i> (e.g. &quot;8 months&quot;), but that
            doesn&apos;t account for when the loan was posted or disbursed. KivaLens
            sorts by <b>final repayment date relative to today</b>, giving you a true
            picture of when you&apos;ll get your money back. You can also sort by when
            you&apos;ll have 50% or 75% repaid — useful for finding loans that pay back
            sooner even if the final date is the same.
          </p>

          <h3>Any / All / None Filtering</h3>
          <p>
            For fields where a loan can have multiple values (like Tags), you can
            choose: <b>Any</b> (match at least one), <b>All</b> (must have every
            selection), or <b>None</b> (exclude all selected).
          </p>

          <h3>Portfolio Balancing</h3>
          <p>
            On the Portfolio tab in criteria, you can balance your lending across
            countries, sectors, activities, and partners. This helps you diversify and
            reduce risk. Try the &quot;Balance Partner Risk&quot; saved search to
            automatically hide loans from partners you already have exposure to.
          </p>

          <h3>Partners Tab</h3>
          <p>
            Browse all Kiva field partners — active, closed, and paused. Filter by
            country, risk rating, delinquency rate, religion, and more. Click &quot;Show
            Loans&quot; to jump to the Search tab filtered to that partner&apos;s
            fundraising loans.
          </p>

          <h3>A+ Team Research</h3>
          <p>
            KivaLens integrates data from the <KivaLink path="team/aplus">A+ Team</KivaLink>
            {' '}(Atheists, Agnostics, Skeptics, Freethinkers, Secular Humanists and
            the Non-Religious). Their research includes secular and social ratings for
            field partners, plus religious affiliation data. Filter by religion in the
            Partner criteria tab, or view the research on any loan&apos;s Partner detail
            tab.
          </p>

          <h3>RSS Feeds</h3>
          <p>
            Set your criteria, go to the RSS tab, and get a URL you can use with any
            RSS reader or <NewTabLink href="https://www.ifttt.com">IFTTT</NewTabLink>
            {' '}to get notified when new matching loans are posted.
          </p>

          <h3>Reducing Risk</h3>
          <ul className="spacedList">
            <li>
              <b>Risk Rating:</b> Kiva&apos;s assessment of how likely a partner is to
              fail. Higher stars = lower institutional risk. This doesn&apos;t predict
              individual borrower default.
            </li>
            <li>
              <b>Currency Exchange Risk:</b> If a loan isn&apos;t in USD, exchange rate
              changes can reduce your repayment. Use the Currency Loss filter and
              partner currency loss % to manage this.
            </li>
            <li>
              <b>Default Rates:</b> All partners have some defaults. A 0% default rate
              usually means the partner covers losses — good for risk-averse lenders.
            </li>
            <li>
              <b>Portfolio Yield:</b> High PY% doesn&apos;t necessarily mean predatory
              lending. Rural partners with small loans and high servicing costs
              naturally have higher PY. Don&apos;t judge too harshly or you may exclude
              partners serving the neediest borrowers.
            </li>
            <li>
              <b>Diversify!</b> Spread your lending across partners and countries. Use
              Portfolio Balancing to limit exposure to any single partner. If a
              partner has institutional default, you only lose what you had with them.
            </li>
            <li>
              <b>Repeat Borrowers:</b> A borrower coming back usually means their
              previous loan was successful. #RepeatBorrower loans historically have a
              99.16% repayment rate vs 98.55% for #FirstLoan.
            </li>
          </ul>

          <h3>Questions or Problems?</h3>
          <p>
            Data comes from{' '}
            <NewTabLink href="https://build.kiva.org/api">
              Kiva&apos;s Public API
            </NewTabLink>
            . For questions about loan data, contact{' '}
            <KivaLink path="help">Kiva&apos;s Help Center</KivaLink>. For KivaLens
            bugs,{' '}
            <EmailLink
              subject="KivaLens Bug"
              body="I found a bug!\nThe problem is...\nSteps to reproduce..."
            >
              email me
            </EmailLink>
            . Join the{' '}
            <KivaLink path="team/kivalens">KivaLens Lending Team</KivaLink> for
            discussion and announcements.
          </p>
        </Tab>
      </Tabs>
    </Container>
  )
}
