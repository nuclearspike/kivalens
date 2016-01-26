'use strict'
import React from 'react'
import Reflux from 'reflux'
import {Modal,Panel,ProgressBar} from 'react-bootstrap'
import {CycleChild} from '.'
import a from '../actions'

//this really shouldn't be receiving notice of whether to show from outside. it knows
const LoadingLoansModal = React.createClass({
    mixins: [Reflux.ListenerMixin],
    getInitialState(){
        return {progress_label: 'Please Wait...', title: 'Loading Fundraising Loans from Kiva.org', show: !kivaloans.isReady(), error_message: ''}
    },
    shouldComponentUpdate(np, ns) { //does this actually help anything?
        return (this.state.show != ns.show)
    },
    componentDidMount() {
        this.hasSentGAView = false

        this.listenTo(a.loans.load.progressed, progress => {
            if (this.state.failed) return
            var new_state = {show: true}
            if (progress.done) new_state[`${progress.task}_progress`] = progress.singlePass ? (progress.done * 100) / progress.total : (progress.done * 100) / progress.total * (progress.task == 'ids'? .33 : .67)
            if (progress.label) new_state.progress_label = progress.label
            if (progress.title) new_state.title = progress.title
            if (progress.complete) new_state.show = false
            this.setState(new_state)
            this.forceUpdate()
        })
        this.listenTo(a.loans.load.completed, ()=>{
            this.setState({show: false}) //should() handles the update
        })
        this.listenTo(a.loans.load.failed, status => {
            this.setState({failed: true, progress_label: 'Download Failed! Error Message from Kiva:', error_message: status })
            this.forceUpdate()
        })
    },
    render() {
        let {ids_progress, details_progress, show, title, progress_label, error_message} = this.state
        if (show && !this.hasSentGAView) {
            this.hasSentGAView = true
            window.rga.modalview('/loading')
        }
        return (<If condition={show}>
            <Panel className="not-rounded-top">
                    <Modal.Header>
                        <Modal.Title>{title}</Modal.Title>
                    </Modal.Header>

                    <Modal.Body>
                        <ProgressBar>
                            <ProgressBar bsStyle="info" active={ids_progress < 32} label={ids_progress > 10 ? 'basics': ''} now={ids_progress} />
                            <ProgressBar active label={details_progress > 10 ? 'details': ''} now={details_progress} />
                        </ProgressBar>
                        <CycleChild name='didYouKnow_loading'>
                            <p>To greatly reduce load time, check out the "Options" tab if you rarely consider longer term loans. (You can do that now, the loans will keep downloading.)</p>
                            <p>There are new Portfolio Balancing tools available on the "Your Portfolio" criteria tab. Use them to either balance your risk by diversifying across partners or let them help you find countries and sectors you don't have yet... and there are a bunch of other things you can do, check it out right now while you're waiting for the loans to load!</p>
                            <p>Did you know that KivaLens now works on smart-phones and tablets (iPad, Kindle, etc), too?</p>
                            <p>Did you know that you can go check out other pages while the loans load? KivaLens is not a normal website.</p>
                            <p>Click the "Saved Search" button to see some samples of the types of queries you do.</p>
                            <p>When typing into one of the drop-downs, as soon as it highlights the one you want, you can press Tab or Enter, ESC closes the dropdown.</p>
                            <p>Do you know any software developers? KivaLens is open-source and will accept quality contributions (check out the About page for more information).</p>
                            <p>You can hide loans you've already loaned to by adding your Lender ID in the Options tab, then checking the "Exclude My Loans" option on the "Your Portfolio" tab.</p>
                            <p>Use the "Saved Search" button when you have your search exactly like you want it, give it a name and be able to return to it whenever you want.</p>
                            <p>Have you told your Kiva Lending Teams about your favorite KivaLens features yet?</p>
                            <p>What else do you wish KivaLens could do? Check out the About page to contact me!</p>
                            <p>There's also a "Kiva Lender Assistant" Chrome Browser plugin that will talk to you and show graphs and final repayment information on the Lend Tab. See the About page for more information.</p>
                            <p>You can click anywhere in one of the drop-down boxes to bring up the selection (you don't need to click the little arrow).</p>
                            <p>Kiva's site does not allow you to search for multiple "Tags" (where the loan must be tagged with both) but they are a great way to narrow your search. You can look for loans that have Interesting Photos, Inspiring Stories, and who are Repeat Borrowers!</p>
                            <p>All/Any/None options. Selecting "All" Tags requires the loan to have all of the tags listed while "Any" means the loan has to match one or more of them.</p>
                            <p>To fill up your basket quickly with matching loans, use the "Bulk Add" button above the list of loans.</p>
                            <p>KivaLens keeps the loans up-to-the-second fresh. Check out the "Live" page to see how KivaLens is getting updates from Kiva as they happen.</p>
                            <p>When sorting by the default method or "Final Repayment Date", the secondary sort is by when you get back 50% then 75% so even if there are a number of loans that all pay back by the same final date, the ones that repay more quickly will get sort preference.</p>
                            <p>Be sure to check out the Options page if you would like to integrate the Atheist Team's MFI research data.</p>
                        </CycleChild>
                    </Modal.Body>

                    <Modal.Footer>
                        {progress_label}<br/>
                        {error_message}
                    </Modal.Footer>
                </Panel>
            <Else/>
                <span/>
            </If>)
    }
})

export default LoadingLoansModal