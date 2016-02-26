import React from 'react'
import {CycleChild} from '.'

/**
 * KL-specific "Did you know" messages. With how fast it loads now, there's
 * no time to read these!
 */

const DidYouKnow = React.createClass({
    render() {
        return <CycleChild name='didYouKnow_loading'>
                <p>Use Portfolio Balancing to help balance your risk by diversifying across partners or to find countries and sectors you don't have yet.</p>
                <p>Did you know that KivaLens works on smart-phones and tablets, too?</p>
                <p>Click the "Saved Search" button to see some samples of the types of queries you do.</p>
                <p>When typing into one of the drop-downs, as soon as it highlights the one you want, you can press Tab or Enter, ESC closes the dropdown.</p>
                <p>You can hide loans you've already loaned to by adding your Lender ID in the Options tab, then checking the "Exclude My Loans" option on the "Your Portfolio" tab.</p>
                <p>Use the "Saved Search" button when you have your search exactly like you want it, give it a name and be able to return to it whenever you want.</p>
                <p>Have you told your Kiva Lending Teams about your favorite KivaLens features yet?</p>
                <p>What else do you wish KivaLens could do? Check out the About page to contact me!</p>
                <p>There's also a "Kiva Lender Assistant" Chrome Browser plugin that will talk to you and show graphs and final repayment information on the Lend Tab. See the About page for more information.</p>
                <p>You can click anywhere in one of the drop-down boxes to bring up the selection (you don't need to click the little arrow).</p>
                <p>Kiva's site does not allow you to search for multiple "Tags" (where the loan must be tagged with both) but that's a great way to narrow your search!</p>
                <p>To fill up your basket quickly with matching loans, use the "Bulk Add" button above the list of loans.</p>
                <p>KivaLens keeps the loans up-to-the-second fresh. Check out the "Live" page to see how KivaLens is getting updates from Kiva as they happen.</p>
                <p>Be sure to check out the Options page if you would like to integrate the Atheist Team's MFI research data.</p>
            </CycleChild>
    }
})

export default DidYouKnow

/**
 * <p>Do you know any software developers? KivaLens is open-source and will accept quality contributions (check out the About page for more information).</p>
 * <p>When sorting by the default method or "Final Repayment Date", the secondary sort is by when you get back 50% then 75% so even if there are a number of loans that all pay back by the same final date, the ones that repay more quickly will get sort preference.</p>
 **/