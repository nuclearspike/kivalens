'use strict'
import React from 'react'
import {Grid, Tabs, Tab, Button, Alert} from 'react-bootstrap'
import {NewTabLink, LenderLink, KivaLink, EmailLink} from '.'

const About = React.createClass({
  getInitialState() {
    return {hasLenderID: lsj.get("Options").kiva_lender_id != null}
  },
  startTutorial() {
    localStorage.setItem('kl_tutorial_step', '0')
    localStorage.removeItem('kl_tutorial_done')
    window.location.hash = '#/search'
    // The tutorial overlay will pick this up
    setTimeout(() => window.dispatchEvent(new Event('kl_tutorial_start')), 300)
  },
  render() {
    let {hasLenderID} = this.state
    return <Grid>
      <h1>About KivaLens</h1>

      <Tabs defaultActiveKey={1} animation={false} id="about-tabs">
        <Tab eventKey={1} title="Getting Started" className="ample-padding-top">

          <h3>What is KivaLens?</h3>
          <p>
            KivaLens is a free tool that gives you powerful ways to search for
            loans on <KivaLink path="/">Kiva.org</KivaLink>. Find loans by
            country, sector, repayment speed, partner quality, and much more
            — then add them to your basket and check out on Kiva.
          </p>

          {!hasLenderID ? <span>
            <h3>What is Kiva?</h3>
            <p>
              <KivaLink path="invitedby/nuclearspike">Kiva</KivaLink> is a
              non-profit where you lend as little as $25 to borrowers around
              the world. Borrowers repay over time (over 97% repayment rate)
              and you can re-lend that money to someone else. It's not a
              donation — it's a loan that makes a real difference.
            </p>
          </span> : null}

          <h3>Quick Start</h3>
          <ol className='spacedList'>
            <li>
              <b>Search for loans</b> — Use the Search tab. The criteria panel
              on the left lets you filter by country, sector, repayment terms,
              partner risk, and dozens of other options. Results update
              instantly as you change filters.
            </li>
            <li>
              <b>Review a loan</b> — Click any loan in the list to see details,
              repayment schedule, and partner information on the right.
            </li>
            <li>
              <b>Add to basket</b> — Click "Add to Basket" on loans you like.
              Use "Bulk Add" to add many at once.
            </li>
            <li>
              <b>Check out on Kiva</b> — Go to the Basket tab and click
              "Transfer to Kiva" to complete your loans on Kiva's site.
            </li>
          </ol>

          <h3>Set Up Your Lender ID</h3>
          <p>
            <a href="#" onClick={function(e){ e.preventDefault(); showLenderIDModal() }}>Set your
            Kiva lender ID</a> so KivaLens can hide loans you've already
            funded and enable portfolio balancing and the 3D Wall.
          </p>

          <h3>Save Your Searches</h3>
          <p>
            Found a great set of filters? Use the "Saved Search" dropdown
            in the criteria panel to save it. KivaLens comes with some
            preset searches like "Expiring Soon" and "Balance Partner Risk"
            to get you started. Manage all your saved searches on
            the <a href="#/saved">Saved</a> tab.
          </p>

          <div style={{marginTop: 20}}>
            <Button bsStyle="primary" onClick={this.startTutorial}>
              Start Interactive Tutorial
            </Button>
          </div>

        </Tab>

        <Tab eventKey={2} title="Advanced" className="ample-padding-top">

          <h3>Sorting & Filtering by Repayment</h3>
          <p>
            Kiva sorts by repayment <i>terms</i> (e.g. "8 months"), but that
            doesn't account for when the loan was posted or disbursed.
            KivaLens sorts by <b>final repayment date relative to today</b>,
            giving you a true picture of when you'll get your money back.
            You can also sort by when you'll have 50% or 75% repaid — useful
            for finding loans that pay back sooner even if the final date
            is the same.
          </p>

          <h3>Any / All / None Filtering</h3>
          <p>
            For fields where a loan can have multiple values (like Tags),
            you can choose: <b>Any</b> (match at least one), <b>All</b> (must
            have every selection), or <b>None</b> (exclude all selected).
          </p>

          <h3>Portfolio Balancing</h3>
          <p>
            On the Portfolio tab in criteria, you can balance your lending
            across countries, sectors, activities, and partners. This helps
            you diversify and reduce risk. Try the "Balance Partner Risk"
            saved search to automatically hide loans from partners you
            already have exposure to.
          </p>

          <h3>Partners Tab</h3>
          <p>
            Browse all Kiva field partners — active, closed, and paused.
            Filter by country, risk rating, delinquency rate, religion,
            and more. Click "Show Loans" to jump to the Search tab filtered
            to that partner's fundraising loans.
          </p>

          <h3>A+ Team Research</h3>
          <p>
            KivaLens integrates data from the <KivaLink path="team/aplus">A+
            Team</KivaLink> (Atheists, Agnostics, Skeptics, Freethinkers,
            Secular Humanists and the Non-Religious). Their research includes
            secular and social ratings for field partners, plus religious
            affiliation data. Filter by religion in the Partner criteria tab,
            or view the research on any loan's Partner detail tab.
          </p>

          <h3>RSS Feeds</h3>
          <p>
            Set your criteria, go to the RSS tab, and get a URL you can use
            with any RSS reader
            or <NewTabLink href="https://www.ifttt.com">IFTTT</NewTabLink> to
            get notified when new matching loans are posted.
          </p>

          <h3>Reducing Risk</h3>
          <ul className='spacedList'>
            <li>
              <b>Risk Rating:</b> Kiva's assessment of how likely a partner
              is to fail. Higher stars = lower institutional risk. This
              doesn't predict individual borrower default.
            </li>
            <li>
              <b>Currency Exchange Risk:</b> If a loan isn't in USD, exchange
              rate changes can reduce your repayment. Use the Currency Loss
              filter and partner currency loss % to manage this.
            </li>
            <li>
              <b>Default Rates:</b> All partners have some defaults. A 0%
              default rate usually means the partner covers losses — good
              for risk-averse lenders.
            </li>
            <li>
              <b>Portfolio Yield:</b> High PY% doesn't necessarily mean
              predatory lending. Rural partners with small loans and high
              servicing costs naturally have higher PY. Don't judge too
              harshly or you may exclude partners serving the neediest
              borrowers.
            </li>
            <li>
              <b>Diversify!</b> Spread your lending across partners and
              countries. Use Portfolio Balancing to limit exposure to any
              single partner. If a partner has institutional default, you
              only lose what you had with them.
            </li>
            <li>
              <b>Repeat Borrowers:</b> A borrower coming back usually means
              their previous loan was successful. #RepeatBorrower loans
              historically have a 99.16% repayment rate vs 98.55% for
              #FirstLoan.
            </li>
          </ul>

          <h3>Questions or Problems?</h3>
          <p>
            Data comes from <NewTabLink href="https://build.kiva.org/api">Kiva's
            Public API</NewTabLink>. For questions about loan data,
            contact <KivaLink path="help">Kiva's Help Center</KivaLink>.
            For KivaLens bugs, <EmailLink subject="KivaLens Bug"
              body="I found a bug!\nThe problem is...\nSteps to reproduce...">
            email me</EmailLink>. Join the <KivaLink
            path="team/kivalens">KivaLens Lending Team</KivaLink> for
            discussion and announcements.
          </p>

          <h3>Open Source</h3>
          <p>
            KivaLens is open source. Want to
            contribute? <EmailLink subject="KivaLens Developer">Get
            in touch</EmailLink>.
          </p>

        </Tab>
      </Tabs>
    </Grid>
  }
})

export default About
