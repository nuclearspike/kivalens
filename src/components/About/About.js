import React, {useEffect, useState} from 'react'
import {Container} from '../bs'
import {EmailLink, KivaLink, KLALink, LenderLink, NewTabLink} from '../Links'

const hasLenderID = false

const About = () => {
  const [KLAVersion, setKLAVersion] = useState(false)
  useEffect(() => {
    // window.callKLAFeature('getVersion').done(({version}) => setKLAVersion(version))
  }, [])
  return (
    <Container>
      <h1>About</h1>
      <h3>What is KivaLens?</h3>
      <p>
        KivaLens is an alternative way to search for Kiva loans offering a lot
        of options that Kiva does not. After you've found your loans and put
        them in your KivaLens basket, you just click a button and the loans will
        be transferred to Kiva where you'll complete your purchase.
      </p>

      {!hasLenderID && (
        <span>
          <h3>What is Kiva?</h3>
          <p>
            Kiva is a non-profit that helps microfinance institutions (MFIs)
            around the world get access to 0% interest capital so that they can
            keep their overhead lower as they lend the money to borrowers who
            have very few options for access to capital. MFIs typically lend at
            interest to cover their operating expenses, if they weren't able to
            access the 0% capital from Kiva lenders, the MFIs may borrow from
            banks at 15% interest which is passed on to the borrower. A lot of
            the loans are very simple, a borrower owns a shop but they can't
            afford to stock their store with more products. A loan allows them
            to carry more products, leading to more customers and sales and they
            repay their loan. You lend $25 to borrowers and they repay over time
            (over 97% of the money loaned through Kiva of the money is repaid).
            &nbsp;
            <KivaLink path="invitedby/nuclearspike">Find out more!</KivaLink>
          </p>
        </span>
      )}

      <h3>Rebuilt and Rethought</h3>
      <p>
        KivaLens has been rebuilt. I decided to re-invent it using different
        tools that weren't available when KivaLens was first written with
        Silverlight. Please{' '}
        <EmailLink subject="KivaLens Features" title="Send a feature request">
          let me know
        </EmailLink>{' '}
        what else you'd like to be able to do. You can also join the{' '}
        <KivaLink path="team/kivalens?default_team=kivalens">
          KivaLens Lending Team
        </KivaLink>{' '}
        to discuss and get announcements.
      </p>

      <h3>Questions/Problems?</h3>
      <p>
        All of the data that KivaLens displays is either a direct presentation
        of or computation from data that is pulled from{' '}
        <NewTabLink href="https://build.kiva.org/api">
          Kiva.org's Public API
        </NewTabLink>{' '}
        with the exception of data from the Atheist Team's research. If you have
        any questions about why a loan is showing certain data (where you have
        confirmed that it's the same on Kiva's own site) or if you have
        questions about what that data means, please check out{' '}
        <KivaLink path="help" title="Go to Kiva Help Center">
          Kiva's Help Center or contact Kiva Customer Service
        </KivaLink>
        .
      </p>
      <p>
        If you find a discrepancy between Kiva's site and what KivaLens displays
        for loans or partners or if you feel that a computation or filter is
        incorrect, or you find something unusual about how KivaLens is working
        then{' '}
        <EmailLink
          subject="KivaLens Bug"
          body={`I found a bug!\nThe problem is...\nThe steps to reproduce it are...`}
          title="Report a bug"
        >
          let me know
        </EmailLink>{' '}
        and include as many details about what happened so I can reproduce the
        problem.
      </p>
      <p>
        Any questions about the{' '}
        <KivaLink path="team/a_atheists_agnostics_skeptics_freethinkers_secular_humanists_and_the_nonreligious">
          Atheist Team
        </KivaLink>
        's MFI research should be directed to that team. I only auto-pull,
        display and filter using the data, I do not produce or verify it.
      </p>

      <h3>Features</h3>
      <ul className="spacedList">
        <li>
          <b>Sorting/Filtering by Final Repayment Date vs Repayment Terms</b>{' '}
          While Kiva allows you to sort by repayment terms, there are a few
          issues with this method from the perspective of the lender. Since
          different loans have different dates on which they posted to Kiva and
          the disbursal dates can have wide-ranges as well, an "8 month"
          repayment term on a pre-disbursed loan that posted almost a month ago
          could already have repayments underway. While the same repayment terms
          on a <i>post</i>-disbursed loan that just posted today could end up
          with a final repayment date <i>months</i> different from the first
          loan mentioned. Yet Kiva will sort them side-by-side because they have
          the same "8 month" repayment terms. Since Kiva only allows you to sort
          by repayment terms but not filter by them, it still shows you all
          loans. KivaLens lets you remove loans that don't match your selection
          for final repayment. Also, KivaLens doesn't sort by the term for the
          borrower, but the final repayment date relative to today, erasing the
          issues created by pre/post disbursed loans and different post dates.
          In Kiva's system (and the API, so also KivaLens), all repayment dates
          are shown at the first of the month, while many/most partners will
          actually settle the payments on the 17th of the <i>prior</i> month.
          So, many times you'll actually get your repayments about 2 weeks{' '}
          <i>sooner</i> than what KivaLens displays, assuming the partners
          settle early (as is common) and the borrower and partner are not
          delinquent.
        </li>

        <li>
          <b>Better Sorts for Repayments!</b> You have the ability to sort by
          final repayment date (which is better than "repayment terms" sort on
          Kiva since it's from the lender perspective), but there's a new sort
          by when the loan is scheduled to repay -- by percentages. Let me
          explain. Let's say you have 3 loans, all with a final repayment date 3
          months away. The new sort will prioritize which pays more sooner. So,
          let's say loan #1 has a equal amount you get back each month. #2 has a
          larger amount on the first repayment then by the final it's very
          little and #3 only has one single repayment at the very end. The new
          sorts will prioritize by how quickly you get 50%, then 75% then 100%
          back. So for the loans above, #2 would be the first, then #1, then #3.
          With pre-disbursed loans that start paying back right away, the first
          repayment to the lender can actually be a combination of multiple
          repayments made by the borrower. Using this sort will help find the
          loans that will allow the quickest turnaround for your money, if
          that's your goal.
        </li>

        <li>
          <b>Any/All/None Filtering</b> What is the difference between "Any" and
          "All"? "All" is only available for properties of a loan where it can
          have multiple. So, a loan can only have one country, but it can have
          multiple tags so there won't be an "All" option for Country since a
          loan couldn't be in multiple countries and you'd get no results. If
          you select "All" for tags, then the loan must have &nbsp;<i>all</i>{' '}
          listed tags. If you select "Any" for Tags, then the loan has to match{' '}
          <i>at least one</i>&nbsp; of your selection. "None" allows you to
          exclude results, so if you are opposed to "Liquor Store /
          Off-License," "Balut-Making" and other controversial activities, you
          can exclude them.
        </li>

        <li>
          <b>Auto-complete drop-downs</b> for Sector, Activity, Country, Region,
          Social Performance Badges, Themes, Tags, Partners, etc. KivaLens will
          also show you graphs along the side (when on a large enough device)
          indicating what options you have for that criteria so you don't have
          to guess at what will narrow your options for you.
        </li>

        <li>
          <b>A Ton of Filters Kiva doesn't have</b> including "Loans at Risk %"
          and "Currency Loss %" for partners to further reduce your risk.
          Repayment interval filtering so you can find only loans paying back
          monthly, granular currency loss coverage options, mentioned ages,
          specific percentage of genders in a group, $/hour, expiring in days,
          disbursal days, average loan per capita income, years the partner has
          been on kiva and how many loans they've posted.
        </li>

        <li>
          <b>Bulk Add!</b> This is a favorite feature for previous KivaLens
          users and what I heard about the most from mega-lenders that they
          missed after the previous version of KivaLens bit the dust in July of
          2015. Add tons of loans that match your criteria to your basket all at
          once!
        </li>

        <li>
          <b>Mobile!</b> Since the new site is just HTML and Javascript rather
          than Silverlight, it will run on everything and it's designed to
          automatically adapt to the size of the device you're using, so if
          you're on a phone, it will hide the graphs, and stack everything into
          one column; on a tablet, it displays differently depending on its
          orientation and laptop/desktop users have the easiest experience
          taking advantage of the width to show you more.
        </li>

        <li>
          <b>See graphs!</b> View graphs that show the distribution of the
          current filter. Ex: Select "Retail" as your Sector filter, and by
          clicking into the Country box, you can see how Retail loans are spread
          across Countries and what Activities are available by clicking into
          those drop-downs to make the graphs down the side appear (only on
          large displays).
        </li>

        <li>
          <b>Live Filtering = Speed!</b> Since it downloads all of the loans at
          the start and then filters them in your browser, you get "as-you-type"
          filtering. Drag a slider around, pause for a second and watch your
          results change right then, it doesn't have to talk to the server.
        </li>

        {/* <li> */}
        {/*  <b>Always Fresh!</b> KivaLens listens to the same live data-stream */}
        {/*  that <KivaLink path='live?v=1'>Kiva /Live</KivaLink> uses. That means that the very second a new */}
        {/*  loan posts, a loan gets funded or any lending activity happens on Kiva, the loans loaded in your */}
        {/*  browser are kept exactly up-to-date without needing to reload the page. You may see a loan turn */}
        {/*  gray in the results indicating it either expired or funded or if you keep a popular loan open, */}
        {/*  the page will automatically update as more lenders lend money. */}
        {/* </li> */}

        <li>
          <b>Hide Loans in your portfolio</b> so that you don't accidentally
          lend to them more than you want. To use this, go to "Options" to input
          your kiva lender-id. From the Criteria "Portfolio" tab and select the
          appropriate option.
        </li>

        <li>
          <b>Saved Searches</b> Save your favorite searches to quickly jump back
          to them. The site will start you out with some default saved searches
          to give you an idea of how to use them. As you view loan details, the
          "Saved Searches" line will show you which Saved Searches have that
          loan in their results. Saved Searches are stored with your browser, so
          if you clear you browser settings, you'll lose your Saved Searches.
          Also, Save Searches are not shared across devices (you set up a Saved
          Search on your laptop, it won't show on your phone).
        </li>

        <li>
          <b>Filter on the Atheist Team's MFI research</b> with sliders for
          Secular and Social scoring. When you click on a loan, the Partner tab
          will show a new section displaying data pulled from that team's
          spreadsheet. This feature is on by default, simply turn it off in the
          Options tab.
        </li>

        <li>
          <b>Portfolio Balancing</b> Whether you're a "Country Collector," or
          maybe that you don't want to have too many active loans from only a
          few partners, or if you want to find more sectors like your favorites,
          use the Portfolio Balancing tools to help you accomplish your lending
          goals.
        </li>

        {/* <li> */}
        {/*  <b>3D Loan Wall</b> When you have your lender id entered you can view a 3D "wall" of images */}
        {/*  of the borrowers in your portfolio. */}
        {/* </li> */}

        <li>
          <b>Auto-Lending Preferences</b> Kiva has had{' '}
          <KivaLink path="settings/credit">Auto-Lending</KivaLink> for years but
          the options are a bit anemic. Since browser extensions have far more
          permissions than a web page does, KivaLens is able to tell the
          extension to alter your auto-lending settings on Kiva. KivaLens offers
          extensive partner criteria as well as portfolio balancing for Sector,
          Country and Activity. When you use KivaLens in conjunction with{' '}
          <KLALink/> you can easily set your auto-lending preferences and take
          full advantage of Kiva's feature.
        </li>

        {/* <li> */}
        {/*  <b>Notifications</b> When you have the <KLALink/> installed, you can set your Saved Searches to play */}
        {/*  a sound if a new loan is added. There are some types of loans (especially the ultra-short term */}
        {/*  loans) that can fully fund within less than a 1-2 hours. Install the extension, set your criteria, */}
        {/*  select that you want to be notified on the menu option on the Saved Search menu, leave KivaLens */}
        {/*  open and you won't even have to have the browser showing and KivaLens will tell the extension */}
        {/*  to display a notification visible outside of the browser and play a sound. The loan must be posted */}
        {/*  with all criteria matching or the notification won't fire. So, a notification set up with */}
        {/*  restrictions for funding amounts that don't include 0 would never fire. Tags on loans are added */}
        {/*  by other users after the loan has already posted, so any criteria with Tags won't fire. Filters */}
        {/*  with expiration, $/hour or details that change after the loan posts will also not ever get a */}
        {/*  notification. */}
        {/* </li> */}

        <li>
          <b>Compare Teams</b> On the "Teams" page, you can compare the
          membership count, loan count, and total amount loaned for your teams.
        </li>

        <li>
          <b>RSS Feeds</b> Once your criteria is set, you can go to the "RSS"
          tab and it will give you a URL that you can paste into your favorite
          RSS reader or use a site like{' '}
          <NewTabLink href="http://www.ifttt.com">
            IFTTT (If This Then That)
          </NewTabLink>{' '}
          that will watch for new items in the feed and you can create a
          "Recipe" where you can set it to email, text/SMS, instant message, or
          many more things like change the colors or lights in your room (if
          you're using Philips Hue lights).
        </li>
      </ul>

      <h3>Reducing Risk</h3>
      <p>
        None of this guarantees you anything. Use your own discretion, research,
        thoughts, team message boards, exchanges with Kiva's Customer Service,
        etc to help inform your lending habits.
      </p>
      <ul className="spacedList">
        <li>
          <b>Institutional Risk:</b> The "Risk Rating" for a partner is based on
          Kiva's assessment on how likely it is that a partner will fail
          (institutional default) based on a huge formula as well as some good
          old-fashioned gut feelings. Example: Some MFIs are running their
          business from a spreadsheet while others have a comprehensive software
          package (MIS). There are many things that together give an indication
          of how sustainable they are over time. The higher the star rating, the
          less likely it is for the partner to fail. This is not any indication
          on whether or not the borrower is risky and is no guarantee.
        </li>
        <li>
          <b>Currency Exchange Risk:</b> Even if a borrower pays back in full,
          if they are paying back in a currency other than USD, there is a risk
          that you can lose some money due to the exchange rate. Using the
          Currency Exchange Loss % Partner slider, you can use history as an
          indicator of the future for how much you may lose (but there's no
          guarantee). Some partners cover more of the currency loss than others.
          There's also a drop-down for "Currency Loss" that allows you to
          exclude loans where loss is possible.
        </li>
        <li>
          <b>Default Rates:</b> All partners will have defaults, some partners
          choose to cover the losses of defaulted borrowers in order to pay back
          Kiva lenders as a part of doing business. Choosing partners with 0%
          default means you are most likely choosing a partner that is covering
          losses, which if you have large amounts of money in, may be exactly
          what you're looking for.
        </li>
        <li>
          <b>Portfolio Yield:</b> Reducing organizations down to a number and
          then making assumptions based off that number can actually
          unintentionally exclude the very partners you would actually most like
          if you knew more about them. One of the most significant learnings I
          had when I worked at Kiva was regarding Portfolio Yield. PY values are
          based on costs charged to the borrower over the amount of the loan.
          So, consider this... a partner that specializes in rural loans to
          agricultural borrowers where the expense to the partner to service the
          loan (travelling hours to collect weekly/monthly from one or only a
          few borrowers) is actually quite high and the loan amount is low, it
          will have a higher PY% relative to a more urban partner that only does
          high value loans where their cost to service the loan is very low
          since the borrowers come in to their office. So, don't judge high PY
          values too harshly or you may just be excluding partners that are
          servicing the most needy borrowers.
        </li>
        <li>
          <b>Profitability:</b> When I initially wrote KivaLens (prior to
          working at Kiva), I incorrectly assumed that a partner with a negative
          profitability naturally meant they were at greater risk for
          institutional collapse and thus cause all outstanding loans to fail.
          While this is not only a logical conclusion, it is also stated as a
          risk for negative profitability on Kiva's site. However, this is not
          always the case. There are a number of partners that receive money
          from outside sources where this money is not factored in when
          calculating their profitability. So, just because your borrower is
          getting a loan from a partner that has a large negative profit,
          they're not necessarily more likely to collapse; it's not that simple.
          However, if the partner is not receiving money from outside sources
          and are operating a loss for extended periods, they may be at higher
          risk of institutional default. Since there is no way to tell which
          MFIs are or are not receiving money from outside sources, the "safest"
          bet is to choose partners with positive profitability. But hopefully
          this answers any questions where you watch a partner operate at large
          losses for years but remain afloat.
        </li>
        <li>
          <b>Group Loans:</b> Due to the high variability with how group loans
          are organized by partner, you cannot necessarily make assumptions
          about group loans versus individual. Some partners group riskier
          borrowers together so they can prove themselves and graduate to
          individual loans and the grouping is arbitrary just to make repayment
          collections simpler to lower the cost of servicing the loan. Some
          groups are "solidarity" groups where group members have committed to
          pay for individuals who default. While you can search for "solidarity"
          in the name field to find some "safer" loans, most solidarity loans do
          not have that in their name and there is no way to tell from the loan
          data to help you find more.
        </li>
        <li>
          <b>Repeat Borrowers:</b> A borrower coming back for a second or third
          loan does NOT mean they are more risky. In fact, it usually means the
          opposite. If a borrower has completed a loan successfully and the
          partner has chosen to give them another loan, then many times that
          means they are more likely to repay. Repeat borrowing does not
          necessarily mean they are in a cycle of debt, but instead that they've
          shown that their previous loan was successful in improving their
          business that another (usually larger) loan can help them to continue
          to grow their business. Use the #RepeatBorrower tag search to help
          find them. KivaLens user (
          <LenderLink lender="thomas85717133">Thomas</LenderLink>) used Kiva's{' '}
          <NewTabLink href="http://build.kiva.org/docs/data/snapshots">
            data snapshots
          </NewTabLink>{' '}
          and compared repayment rates for ended loans tagged #FirstLoan vs
          #RepeatBorrower and found loans tagged with #RepeatBorrower had a
          repayment rate of 99.16% vs loans tagged with #FirstLoan of 98.55%
          (using data current as of Dec 8, 2015). To get more information and
          see the code used to calculate, check out{' '}
          <KivaLink
            path="team/kivalens/messages?msgID=443715#msg_443715"
            title="View KivaLens team message board"
          >
            this message
          </KivaLink>
          .
        </li>
        <li>
          <b>Diversify!</b> When searching for loans, your criteria may keep
          bringing up loans from the same partners over and over again. Having
          too much money with only a handful of partners means that if those
          partners have institutional default, you could lose all of your
          outstanding balance. Diversity among countries can also be beneficial
          because it protects you from your portfolio being as impacted by
          natural disasters, wars, etc. Use KivaLens' Portfolio Balancing
          Criteria options (on Portfolio tab) to do this for you. After you set
          your Lender ID on the Options page, go back to Search and there's a
          pre-set Saved Search of "Balance Partner Risk" which sets the
          Portfolio Balancing options to hide loans from any partner where they
          have > 0% of your active portfolio. If you have a lot of active loans,
          you may need to increase the percentage to allow for more per partner.
          Also use the "Limit to top" option to only show 1 loan (or a couple if
          you're doing large volume) per Partner.
        </li>
        <li>
          <b>Something to consider:</b> Ultimately, you shouldn't be considering
          Kiva as a "bank" (which is why I changed the name from kivabank to
          kivalens years ago). Over time, even the most cautious lenders are
          very likely to lose money to default or currency exchange unless you
          are extremely lucky. You should lend with the expectation of some loss
          and be happy when everything goes perfectly. You are lending to help
          people, not for any return on your money (obviously) or even with any
          assumptions of total repayment. Happy lending!
        </li>
      </ul>

      <h3>Open-source</h3>
      <p>
        Kiva Lens is now open-source, so feel free to{' '}
        <EmailLink subject="KivaLens Developer">email me</EmailLink> about
        working on it. It uses React 16 (Hooks), Webpack, react-bootstrap, node,
        ES6, babel (JSX, ES6 transpiler), Kiva API, linqjs, Highcharts, express
        node js server and more. You can check out the source code (in progress)
        at my{' '}
        <NewTabLink href="https://github.com/nuclearspike/kivalens">
          github repository
        </NewTabLink>
        .
      </p>

      <h3>History</h3>
      <p>
        KivaLens was initially created in 2009 (as a Silverlight app) because I
        wanted to find loans in ways and Kiva did not offer the filter/sorts I
        wanted. I ended up working at Kiva for a few years and helped
        incorporate a lot of the search features directly into Kiva's site which
        also then made their way into the API as well. There are still some
        great things KivaLens does that Kiva does not do that are handy and fun!
        Some projects I worked on at Kiva: Super Graphs for lenders and teams,
        /Live, Zip, Leader boards, Message board search with time-line, the Home
        page (at the time), and Estimated Repayments are some of the ones I
        enjoyed the most, many of which were "Innovation Iteration" projects
        where engineers implement their own ideas.
      </p>

      <h3>Kiva Lender Assistant (KLA) Chrome Extension</h3>
      <p className="margin-bottom-20">
        There's also a Google Chrome browser extension I wrote that inserts
        repayment graph (sparklines) on the Lend tab along with other repayment
        info, talks to you about things it notices about the loan, details about
        lenders and teams you hover over, etc. There are also a number of
        features that KivaLens has that require KLA to work.{' '}
        <KLALink>
          Check out screenshots, a detailed description and install Kiva Lender
          Assistant here
        </KLALink>{' '}
        or&nbsp;
        <NewTabLink href="https://github.com/nuclearspike/lenderassist">
          checkout the source code on github (developers wanted!)
        </NewTabLink>
        .
        {KLAVersion && (
          <span>
            You have KLA version {KLAVersion} installed. Chrome does a good job
            of keeping your extensions up to date automatically, but to check
            for upgrades manually, go to Chrome's "Window" menu, select
            "Extensions" and switch on "Developer Mode" then click the button to
            update your extensions.
          </span>
        )}
      </p>
    </Container>
  );
};

export default About
