'use strict'
import React from 'react'
import {Grid} from 'react-bootstrap'
import {NewTabLink, LenderLink, KivaLink, EmailLink} from '.'

var About = React.createClass({
    render() {
        return (<Grid>
            <h1>About</h1>
            <h3>Rebuilt and Rethought</h3>
            <p>
                KivaLens has been rebuilt. In July of 2015, the Silverlight version suddenly stopped being able
                to process Kiva's API results and rather than fix it, I decided to re-invent it using different tools that weren't available when KivaLens
                was first written. Please <EmailLink subject="KivaLens Features" title="Send a feature request">let me know</EmailLink> your
                what else you'd like to be able to do. You can also join
                the <KivaLink path="team/kivalens?default_team=kivalens">KivaLens Team</KivaLink> to discuss.
            </p>

            <h3>Questions/Problems{'?'}</h3>
            <p>
                All of the data that KivaLens displays is either a direct presentation of or computation from data that
                is pulled from <NewTabLink href="http://build.kiva.org/api">Kiva.org's Public API</NewTabLink> with the exception
                of data from the Atheist Team's research. If you have any questions about why a loan is showing
                certain data (where you have confirmed that it's the same on Kiva's own site) or if you have questions
                about what that data means, please check out <KivaLink path="help" title="Go to Kiva Help Center">Kiva's Help Center or contact Kiva Customer Service</KivaLink>.
            </p>
            <p>
                If you find a discrepancy between Kiva's site and what KivaLens' displays for loans or partners or if
                you feel that a computation or filter is incorrect, or you find something unusual about how KivaLens is working
                then <EmailLink subject="KivaLens Bug" body="I found a bug! The problem is... The steps to reproduce it are..." title="Report a bug">let me know</EmailLink> and
                include as many details about what loan/partner and information you can so that I can reproduce the
                problem.
            </p>
            <p>
                Any questions about the <KivaLink path="team/atheists">Atheist Team</KivaLink>'s
                MFI research should be directed to that team. I only pull, display and filter using the data,
                I do not produce or verify it.
            </p>

            <h3>Features</h3>
            <ul className='spacedList'>
                <li>
                    Sorting/Filtering by Final Repayment Date vs Repayment Terms. While Kiva allows you to sort by repayment
                    terms, there are a few issues with this method from the perspective of the lender. Since different
                    loans have different dates on which they posted to Kiva and the disbursal dates can have wide-ranges as well,
                    an "8 month" repayment term on a pre-disbursed loan that posted almost a month ago could already have
                    repayments underway. While the same repayment terms on a <i>post</i>-disbursed loan that just posted today
                    could end up with a final repayment date <i>months</i> different from the first loan mentioned. Yet
                    Kiva will sort them side-by-side because they have the same "8 month" repayment terms. Also, since
                    Kiva only allows you to sort by repayment terms but not filter by them, it still shows you all
                    loans. KivaLens lets you remove loans that don't match your selection for final repayment. Also,
                    KivaLens doesn't sort by the term for the borrower, but the final repayment date relative to today,
                    erasing the issues created by pre/post disbursed loans and different post dates. In Kiva's system
                    (and the API, so also KivaLens), all repayment dates are shown at the first of the month, while
                    many/most partners will actually settle the payments on the 17th of the <i>prior</i> month. So,
                    many times you'll actually get your repayments about 2 weeks <i>sooner</i> than what KivaLens displays,
                    assuming the partners settle early (as is common) and the borrower and partner are not delinquent.
                </li>

                <li>
                    New Sort! You still have the ability to sort by final repayment date, but I've added a new sort
                    that will sort by when the loan is scheduled to repay -- by percentages. Let me explain. Let's
                    say you have 3 loans, all with a final repayment date 3 months away. The new sort will prioritize
                    which pays more sooner. So, let's say loan {'#'}1 has a equal amount you get back each month.
                    {'#'}2 has a larger amount on the first repayment then by the final it's very little and {'#'}3
                    only has one single repayment at the very end. The new sorts will prioritize by how quickly you
                    get 50%, then 75% then 100% back. So for the loans above, {'#'}2 would be the first, then {'#'}1,
                    then {'#'}3. With pre-disbursed loans that start paying back right away, the first repayment to
                    the lender can actually be a combination of multiple repayments made by the borrower. Using this
                    sort will help find the loans that will allow the quickest turnaround for your money, if that's
                    what your goal is.
                </li>

                <li>
                    Any/All/None Filtering: What is the difference between "Any" and "All"{'?'} "All" is only available
                    for properties of a loan where it can have multiple. So, a loan can only have one country, but
                    it can have multiple tags so there won't be an "All" option for Country since a loan couldn't be
                    in multiple countries and you'd get no results. If you select "All" then the loan must have
                    <i>all</i> listed tags. If you select "Any" for Tags, then the loan has to match <i>at least one</i>
                    of your selection. "None" allows you to exclude results, so if you are opposed to "Liquor Store
                    / Off-License," "Balut-Making" and other controversial activities, you can exclude them.
                </li>

                <li>
                    Auto-complete drop-downs for Sector, Activity, Country, Region, Social Performance Badges,
                    Themes, Tags, Partners. KivaLens will also show you graphs along the side (when on a large
                    enough device) indicating what options you have for that criteria so you don't have to guess
                    at what will narrow your options for you.
                </li>

                <li>
                    New range filters: in addition to all of the old ways of filtering, you can now filter by
                    "Loans at Risk %" and "Currency Loss %" for partners to further reduce your risk. These are
                    not available filters on Kiva.
                </li>

                <li>
                    Bulk Add! This is a favorite feature for previous KivaLens users and what I heard about the
                    most from mega-lenders that they were missing after the previous version of KivaLens bit the
                    dust in July of 2015. Add tons of loans that match your criteria to your basket all at once!
                </li>

                <li>
                    Mobile! Since the new site is just HTML and Javascript rather than Silverlight, it will run
                    on everything and it's designed to automatically adapt to the size of the device
                    you're using, so if you're on a phone, it will hide the graphs, and stack everything into
                    one column; on a tablet, it displays differently depending on its orientation and
                    laptop/desktop users have the easiest experience taking advantage of the width to show you more.
                </li>

                <li>
                    See graphs! View graphs that show the distribution of the current filter. Ex: Select
                    "Retail" as your Sector filter, and see how Retail loans are spread across Countries and
                    what Activities are available by clicking into those drop-downs to make the graphs down the side
                    appear. There are also the half-donut charts.
                </li>

                <li>
                    Live Filtering = Speed! Since it downloads the loans at the start and then filters them
                    in your browser, you get "as-you-type" filtering. Drag a slider around, pause for a second and watch
                    your results change right then, it doesn't have to talk to the server.
                </li>

                <li>
                    Always Fresh! KivaLens subscribes to the same live data-stream
                    that <KivaLink path='live?v=1'>Kiva /Live</KivaLink> uses. That means that the very second a new loan
                    posts, a loan gets funded or any lending activity happens on Kiva, the loans loaded in your browser
                    are kept exactly up-to-date without needing to reload the page. These updates do not cause
                    your criteria to re-filter, but you'll see the impact of any new loans, funded loans or lending
                    activity altering the funded amounts the next time you return to the Criteria tab or alter your filter.
                </li>

                <li>
                    Hide Loans you've already loaned money to so that you don't accidentally lend to them more
                    than you want. To use this, go to "Options" to input your kiva lender-id, then you'll need
                    to refresh the page for the change to take effect. From the Criteria "Portfolio" tab and
                    check the appropriate box.
                </li>

                <li>
                    Saved Searches: Save your favorite searches to quickly jump back to them. The site will start
                    you out with some default saved searches to give you an idea of how to use them.
                </li>

                <li>
                    Filter on the Atheist Team's MFI research with sliders for Secular and Social scoring. When you
                    click on a loan, the Partner tab will show a new section displaying data pulled from their
                    spreadsheet. This feature is off by default, simply turn it on in the Options tab and go search.
                    The next time you visit the site, your old preferences will, of course, still be there.
                </li>

                <li>
                    Portfolio Balancing: Whether you're a "Country Collector," or maybe that you don't want to have too many
                    active loans from only a few partners, or if you want to find more sectors like your favorites, use
                    the Portfolio Balancing tools to help you accomplish your lending goals. Just make sure you have
                    your Lender ID filled out on the Options tab first.
                </li>
            </ul>

            <h3>Reducing Risk</h3>
            <p>
                None of this guarantees you anything. Use your own discretion, research, thoughts, team
                message boards, exchanges with Kiva's Customer Service, etc to help inform your lending habits.
            </p>
            <ul className='spacedList'>
                <li>
                    <b>Institutional Risk:</b> The "Risk Rating" for a partner is based on Kiva's assessment on whether or not
                    a partner will fail (institutional default) based on a huge formula as well as some good old fashioned
                    gut feelings. The higher the star rating, the less likely it is for the partner to fail.
                    This is not any indication on whether or not the borrower is risky and is no guarantee.
                </li>
                <li>
                    <b>Currency Exchange Risk:</b> Even if a borrower pays back in full, if they are paying back in a currency
                    other than USD, there is a risk that you can lose some money due to the exchange rate. Using the
                    Currency Exchange Loss % Partner slider, you can use history as an indicator of the future for
                    how much you may lose (but there's no guarantee). Some partners cover more of the currency loss
                    than others. There's also a drop-down for "Currency Loss" that allows you to exclude loans where
                    loss is possible.
                </li>
                <li>
                    <b>Default Rates:</b> All partners will have defaults, some partners choose to cover the losses of defaulted
                    borrowers in order to pay back Kiva lenders as a part of doing business. Choosing partners with 0%
                    default means you are most likely choosing a partner that is covering losses, which if you have
                    large amounts of money in, may be exactly what you're looking for.
                </li>
                <li>
                    <b>Portfolio Yield:</b> Reducing organizations down to a number and then making assumptions based off
                    that number can actually unintentionally exclude the very partners you would actually most like
                    if you knew more about them. One of the most significant learnings I had when I worked at Kiva was
                    regarding Portfolio Yield. PY values are based on costs charged to the borrower over the amount
                    of the loan. So, consider this... a partner that specializes in rural loans to agricultural
                    borrowers where the expense to the partner to service the loan (travelling hours to collect
                    weekly/monthly from one or only a few borrowers) is actually quite high and the loan amount is low,
                    it will have a higher PY% relative to a more urban partner that only does high value loans where
                    their cost to service the loan is very low since the borrowers come in to their office. So,
                    don't judge high PY values too harshly or you may just be excluding partners that are servicing
                    the most needy borrowers.
                </li>
                <li>
                    <b>Profitability:</b> When I initially wrote KivaLens (prior to working at Kiva), I incorrectly assumed
                    that a partner with a negative profitability naturally meant they were at greater risk for
                    institutional collapse and thus causing all outstanding loans to fail. This is not always true!
                    There are a number of partners that receive money from outside sources and this money is not
                    factored in when calculating their profitability. So, just because your borrower is getting a
                    loan from a partner that has a large negative profit, they're necessarily more likely to collapse
                    and you'll lose your money. It's not that simple. However, if they are not receiving money from outside
                    sources and are operating a loss for extended periods, they may be at higher risk of institutional
                    default. Since there is no way to tell which MFIs are or are not receiving money from outside
                    sources, the "safest" bet is to choose partners with positive profitability.
                </li>
                <li>
                    <b>Group Loans:</b> Due to the high variability with how group loans are organized by partner, you cannot
                    necessarily make assumptions about group loans versus individual. Some partners group riskier
                    borrowers together so they can prove themselves and graduate to individual loans and the grouping
                    is arbitrary just to make repayment collections simpler to lower the cost of servicing the loan.
                    Some groups are "solidarity" groups where group members have committed to pay for individuals who
                    default. While you can search for "solidarity" in the name field to find some "safer" loans,
                    most solidarity loans do not have that in their name and there is no way to tell from the
                    loan data to help you find more.
                </li>
                <li>
                    <b>Repeat Borrowers:</b> A borrower coming back for a second or third loan does NOT mean
                    they are more risky. In fact, it can mean the opposite. If a borrower has completed a loan
                    successfully and the partner has chosen to give them another loan, then many times that means
                    they are more likely to repay. Repeat borrowing does not necessarily mean they are in a cycle
                    of debt, but instead that they've shown that their previous loan was successful in improving
                    their business that another (usually larger) loan can help them to continue to grow their business.
                    Use the {'#'}RepeatBorrower tag search to help find them.

                    KivaLens user (<LenderLink lender='thomas85717133'>Thomas</LenderLink>) has
                    used Kiva's <NewTabLink href="http://build.kiva.org/docs/data/snapshots" target="_blank">data snapshots</NewTabLink> and
                    compared repayment rates for ended loans tagged {'#'}FirstLoan vs {'#'}RepeatBorrower and found loans
                    tagged with {'#'}RepeatBorrower had a repayment rate of 99.16% vs loans tagged with {'#'}FirstLoan
                    of 98.55% (using data current as of Dec 8, 2015). To get more information and see the code used to calculate,
                    check out <KivaLink path="team/kivalens/messages?msgID=443715#msg_443715" title="View KivaLens team message board">this message</KivaLink>.
                </li>
                <li>
                    <b>Diversify!</b> When searching for loans, your criteria may keep bringing up loans from the same partners
                    over and over again. Having too much money with a handful partner means that if those partners have
                    institutional default, you could lose all of your outstanding balance. Diversity among countries
                    can also be beneficial because it protects you from your portfolio being as impacted by natural
                    disasters, wars, etc. Use KivaLens' Portfolio Balancing Criteria options (on Portfolio tab)
                    to do this for you. After you set your Lender ID on the Options page, go back to Search and
                    there's a pre-set Saved Search of "Balance Partner Risk" which sets the Portfolio Balancing options
                    to hide loans from any partner where they have > 0% of your active portfolio. If you have a lot
                    of active loans, you may need to increase the percentage to allow for more per partner.
                </li>
                <li>
                    <b>Something to consider:</b> Ultimately, you shouldn't be considering Kiva as a "bank" (which is why I
                    changed the name from kivabank to kivalens years ago). Over time, even the most cautious lenders
                    are very likely to lose money to default or currency exchange unless you are extremely lucky.
                    You should lend with the expectation of some loss and be happy when it everything goes perfectly.
                    You are lending to help people, not for any return on your money (obviously) or even with any
                    assumptions of total repayment. Happy lending!
                </li>
            </ul>

            <h3>Open-source</h3>
            <p>
                Kiva Lens is now open-source, so feel free to <EmailLink subject="KivaLens Developer">email me</EmailLink> about
                working on it. It uses React, Reflux, react-bootstrap, gulp,
                browserify, node, ES6, babel (JSX, ES6 transpiler), Kiva API, linqjs, Highcharts, jquery and more. You can check out
                the source code (in progress)
                at my <NewTabLink href="https://github.com/nuclearspike/kivalensjs/tree/master/react">github repository</NewTabLink>.
            </p>

            <h3>History</h3>
            <p>
                KivaLens was initially created in 2009 (as a Silverlight app) because I wanted to find loans
                in ways and Kiva did not offer the filter/sorts I wanted. I ended up working at Kiva for a few years
                and helped incorporate a lot of the search features directly into Kiva's site which also then made
                their way into the API as well. There are still some great things KivaLens does that Kiva does not
                do that are handy and fun!
            </p>

            <h3>Kiva Lender Assistant Chrome Extension</h3>
            <p>
                There's also a Google Chrome browser extension I wrote that inserts repayment graph (sparklines)
                on the Lend tab along with other repayment info, talks to you about things it notices about the loan, details about lenders and
                teams you hover over, etc. <NewTabLink href="https://chrome.google.com/webstore/detail/kiva-lender-assistant-bet/jkljjpdljndblihlcoenjbmdakaomhgo?hl=en-US" title="Go to Google Chrome WebStore">
                Check out screenshots, a detailed description and install Kiva Lender Assistant here.</NewTabLink> or <NewTabLink href="https://github.com/nuclearspike/lenderassist">checkout
                the source code on github (developers wanted!)</NewTabLink>
            </p>

        </Grid>)
    }
})

export default About