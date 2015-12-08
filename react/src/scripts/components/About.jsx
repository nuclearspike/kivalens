'use strict';
import React from 'react'
import {Grid} from 'react-bootstrap'

var About = React.createClass({
    render() {
        return (<Grid>
            <h1>About</h1>
            <h3>Under Construction</h3>
            <p>
                KivaLens is currently being rebuilt. The Silverlight version had issues with changes made to Kiva's API
                and rather than fix it, I decided to re-invent it using different tools that weren't available when KivaLens
                was first written. Please <a href="mailto:liquidmonkey@gmail.com?subject=KivaLens" target="_blank">let me know</a> your
                favorite missing features and I'll implement those first. You can also join
                the <a href="http://www.kiva.org/team/kivalens?default_team=kivalens" target="_blank">KivaLens Team</a> to discuss.
            </p>

            <h3>Questions/Problems{'?'}</h3>
            <p>
                All of the data that KivaLens displays is either a direct presentation of or computation from data that
                is pulled from <a href="http://build.kiva.org/api" target="_blank">Kiva.org's Public API</a> with the exception
                of data from the Atheist Team's research. If you have any questions about why a loan is showing
                certain data (where you have confirmed that it's the same on Kiva's own site) or if you have questions
                about what that data means, please check out <a href="http://www.kiva.org/help" target="_blank">Kiva's
                Help Center or contact Kiva Customer Service</a>.
            </p>
            <p>
                If you find a discrepancy between Kiva's site and what KivaLens' displays for loans or partners or if
                you feel that a computation or filter is incorrect, or you find something unusual about how KivaLens is working
                then <a href="mailto:liquidmonkey@gmail.com?subject=KivaLens-Bug" target="_blank">let me know</a> and
                include as many details about what loan/partner and information you can so that I can reproduce the
                problem.
            </p>
            <p>
                Any questions about the <a href="http://www.kiva.org/team/atheists" target="_blank">Atheist Team</a>'s
                MFI research should be directed to that team. I only pull, display and filter using the data,
                I do not verify it.
            </p>

            <h3>Features</h3>
            <ul>
                <li>
                    Sorting/Filtering by Final Repayment Date vs Repayment Terms. While Kiva allows you to sort by repayment
                    terms, there are a few issues with this method from the perspective of the lender. Since different
                    loans have different dates they posted to Kiva and the disbursal dates can have wide-ranges as well,
                    an "8 month" repayment term on a pre-disbursed loan that posted almost a month ago repayments could
                    already be underway. While the same repayment terms on a post-disbursed loan that just posted today
                    could end up with a final repayment date months different from the first, yet Kiva will sort them
                    together because they have the same repayment terms. Also, since Kiva only allows you to sort by
                    repayment terms, it still shows you all loans. KivaLens lets you remove loans that don't match
                    your selection for final repayment. Also, KivaLens doesn't sort by the term for the borrower, but
                    the final repayment date relative to today, erasing the issues created by pre/post disbursed loans
                    and different post dates. In Kiva's system, all repayment dates are shown at the first of the month,
                    while many/most partners will settle the payments on the 17th of the prior month. So, you can still
                    get your repayments about 2 weeks sooner than what KivaLens reports assuming the partners settle
                    early (as is common) and the borrower and partner are not delinquent.
                </li>

                <li>
                    New Sort! You still have the ability to sort by final repayment date, but I've added a new sort
                    that will sort by when the loan is scheduled -- by percentages. Let's say you have 3 loans, all
                    with a final repayment date 3 months away. The new sort will prioritize which pays more
                    sooner. Let's say loan {'#'}1 has a equal amount you get back each month. {'#'}2 has a larger amount
                    on the first repayment then by the final it's very little and {'#'}3 only has one repayment at the
                    very end. The new sorts will prioritize by how quickly you get 50%, then
                    75% then 100% back. So for the loans above, {'#'}2 would be the first, then {'#'}1, then {'#'}3.
                    With pre-disbursed loans that start paying back right away, the first repayment to the lender
                    can actually be a combination of multiple repayments made by the borrower. Using this sort will
                    help find the loans that will allow the quickest turnaround for your money, if that's what your
                    goal is.
                </li>

                <li>
                    Auto-complete drop-downs for Sector, Activity, Country, Region (new), Social Performance
                    Badges (new), Themes (new), Tags (new). Options marked as "new" were not possible before
                    on KivaLens ...{'&'} some are really great (Inspiring Story, Interesting Photo, Volunteer Like,
                    and a bunch more) and can help you reduce the list even more if you still have too many to look
                    through. Kiva can filter by these, but you cannot combine them. Kiva Lens will also show you
                    graphs along the side (when on a large enough device) indicating what options you have for that
                    criteria so you don't have to guess and what will narrow your options for you.
                </li>

                <li>
                    New range filters: in addition to all of the old ways of filtering, you can now filter by
                    "Loans at Risk %" and "Currency Loss %" for partners to further reduce your risk. These are
                    not available filters on Kiva.
                </li>

                <li>
                    Bulk Add! This is a favorite feature for previous KivaLens users and what I heard about the
                    most from mega-lenders that they were missing after the previous version of KivaLens bit the
                    dust in July of this year. Add tons of loans to your basket all at once!
                </li>

                <li>
                    Mobile! Since the new site is just HTML and Javascript rather than Silverlight, it will run
                    on everything and it's designed to automatically adapt to the size of the device
                    you're using, so if you're on a phone, it will hide the graphs, and stack everything into
                    one column, on a tablet, it displays differently depending on its orientation and
                    laptop-desktop have the easiest experience taking advantage of the width.
                </li>

                <li>
                    See graphs! View graphs that show the distribution of the current filter. Ex: Select
                    "Retail" as your Sector filter, and see how Retail loans are spread across Countries and
                    what Activities are available.
                </li>

                <li>
                    Live Filtering = Speed! Since it downloads the loans at the start and then filters them
                    locally, you get "as-you-type" filtering. Drag a slider around, pause for a second and watch
                    your results change right then.
                </li>

                <li>
                    Hide Loans you've already loaned money to so that you don't accidentally lend to them more
                    than you want. To use this, go to "Options" to input your kiva lender-id, then you'll need
                    to refresh the page for the change to take effect. From the Criteria "Portfolio" tab and
                    check the appropriate box.
                </li>

                <li>
                    Saved Searches: Save your favorite searches to quickly jump back to them.
                </li>

                <li>
                    Filter on the Atheist Team's MFI research with sliders for Secular and Social scoring. When you
                    click on a loan, the Partner tab will show a new section displaying data pulled from their
                    spreadsheet. This feature is off by default, simply turn it on in the Options tab and reload the
                    page.
                </li>

                <li>
                    Portfolio Balancing: Whether you're a "Country Collector," that you don't want to have too many
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
            <ul>
                <li>
                    Institutional Risk: The "Risk Rating" for a partner is based on Kiva's assessment on whether or not
                    a partner will fail (institutional default) based on a huge formula as well as some good old fashioned
                    gut feelings. The higher the star rating, the less likely it is for the partner to fail.
                    This is not any indication on whether or not the borrower is risky and is no guarantee.
                </li>
                <li>
                    Currency Exchange Risk: Even if a borrower pays back in full, if they are paying back in a currency
                    other than USD, there is a risk that you can lose some money due to the exchange rate. Using the
                    Currency Exchange Loss % Partner slider, you can use history as an indicator of the future for
                    how much you may lose (but there's no guarantee). Some partners cover more of the currency loss
                    than others. If enough people are interested, I can also add options to filter out non-USD
                    disbursal currencies as well as the currency risk details for the loans (whether shared by
                    the partner and by how much or if it is all on the lender).
                </li>
                <li>
                    Default Rates: All partners will have defaults, some partners choose to cover the losses of defaulted
                    borrowers in order to pay back Kiva lenders as a part of doing business. Choosing partners with 0%
                    default means you are most likely choosing a partner that is covering losses, which if you have
                    large amounts of money in, may be exactly what you're looking for.
                </li>
                <li>
                    Portfolio Yield: Reducing organizations down to a number and then making assumptions based off
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
                    Profitability: When I initially wrote KivaLens (prior to working at Kiva), I incorrectly assumed
                    that a partner with a negative profitability naturally meant they were at greater risk for
                    institutional collapse and thus causing all outstanding loans to fail. This is not always true!
                    There are a number of partners that receive money from outside sources to compensate for
                    the losses from either private or government bodies that appear on their books. So,
                    don't think that just because your borrower is getting a loan from a partner
                    that has a large negative profit, that it means they're necessarily more likely to collapse
                    and you'll lose your money. It's not that simple. If they are not receiving money from outside
                    sources and are operating a loss for extended periods, they may be at higher risk of institutional
                    default. You may want to lend through partners that have low to average profitability.
                </li>
                <li>
                    Group Loans: Due to the high variability with how group loans are organized by partner, you cannot
                    necessarily make assumptions about group loans versus individual. Some partners group riskier
                    borrowers together so they can prove themselves and graduate to individual loans and the grouping
                    is arbitrary just to make repayment collections simpler to lower the cost of servicing the loan.
                    Some groups are "solidarity" groups where group members have committed to pay for individuals who
                    default and while you can search for "solidarity" in the name field, many solidarity loans do not
                    have that in their name and they are not tagged in Kiva's system as being a solidarity loan.
                </li>
                <li>
                    Repeat Borrowers: Just because a borrower is coming back for a second or third loan does NOT mean
                    they are more risky. In fact, it can mean the opposite. If a borrower has completed a loan
                    successfully and the partner has chosen to give them another loan, then many times that means
                    they are more likely to repay. Repeat borrowers does not necessarily mean they are in a cycle
                    of debt, but instead that they've shown that their previous loan was so successful in improving
                    their business that another loan can help them to continue to grow their business. Use
                    the {'#'}RepeatBorrower tag search to help find them. If you know of any research regarding the
                    repayment rates of loans tagged with {'#'}RepeatBorrower to those tagged {'#'}FirstLoan (and untagged)
                    that can corroberate this assumption, please let me know!
                </li>
                <li>
                    Diversify! When using KivaLens, your criteria may keep bringing up loans from the same partners
                    over and over again. Having too much money with a handful partner means that if those partners have
                    institutional default, you could lose all of your outstanding balance. Also diversity among countries
                    can also be beneficial because it protects you from your portfolio being as impacted by natural
                    disasters, wars, etc.
                </li>
                <li>
                    Something to consider: Ultimately, you shouldn't be considering Kiva as a "bank" (which is why I
                    changed the name from kivabank to kivalens many years ago). Over time, even the most cautious lenders
                    are very likely to lose money to default or currency exchange unless you are extremely lucky.
                    You should lend with the expectation of some loss and be happy when it everything goes perfectly.
                    You are lending to help people, not for any return on your money (obviously) or even with any
                    assumptions of total repayment. Happy lending!
                </li>
            </ul>

            <h3>Open-source</h3>
            <p>
                Kiva Lens is now open-source, so feel free to <a href="mailto:liquidmonkey@gmail.com?subject=KivaLensDeveloper" target="_blank">email me</a> about
                working on it. It uses React, Reflux, react-bootstrap, gulp,
                browserify, node, ES6, babel (JSX, ES6 transpiler), Kiva API, linqjs, Highcharts, jquery and more. You can check out
                the source code (in progress)
                at my <a href="https://github.com/nuclearspike/kivalensjs/tree/master/react" target="_blank">github repository</a>.
            </p>

            <h3>History</h3>
            <p>
                KivaLens was initially created in 2009 (as a Silverlight app) because I wanted to find loans
                in ways and Kiva did not offer the filter/sorts I wanted. I ended up working at Kiva for a few years and incorporated a
                lot of the search features directly into Kiva's site which also then made their way into the API
                as well. There are still some things that Kiva does not do that are handy. I have been working to
                re-implement KivaLens as a React app (pure HTML output, so it will work on all browsers with no plugin
                install, tablets and phones too).
            </p>
            <p>
                If you were using the RSS feed option from KivaLens, you are going to need to find an alternative.
                At this time, I have no plans to implement anything on the server so RSS won't be an option. However,
                Kiva has added quite a few more risk-related filters to their API and have an RSS feed
                available. <a href="http://build.kiva.org/api#GET*|loans|search" target="_blank">Here is Kiva's documentation</a> for
                building a query then just use the ".rss" extension. Here's <a href="http://api.kivaws.org/v1/loans/search.rss" target="_blank">unfiltered output</a>. Then
                just add query parameters like "{'?'}theme=Green{'&'}sort_by=repayment_term".
            </p>

            <h3>Kiva Lender Assistant Chrome Extension</h3>
            <p>
                There's also a Google Chrome browser extension I wrote that inserts repayment graph (sparklines)
                on the Lend tab along with other repayment info, talks to you about things it notices about the loan, details about lenders and
                teams you hover over, etc. <a href="https://chrome.google.com/webstore/detail/kiva-lender-assistant-bet/jkljjpdljndblihlcoenjbmdakaomhgo?hl=en-US" target="_blank">
                Check out screenshots, a detailed description and install Kiva Lender Assistant here.</a> or <a href="https://github.com/nuclearspike/lenderassist" target="_blank">checkout
                the source code on github (developers wanted!)</a>
            </p>

        </Grid>)
    }
})

export default About