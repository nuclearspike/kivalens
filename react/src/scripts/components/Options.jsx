'use strict';

import React from 'react'
import Reflux from 'reflux'
import {Grid,Input,Row,Col,Panel,Alert,Button} from 'react-bootstrap'
import LinkedStateMixin from 'react-addons-linked-state-mixin'
import LocalStorageMixin from 'react-localstorage'
import {Link} from 'react-router'
import {KivaLink, NewTabLink, ClickLink, SetLenderIDModal} from '.'
import a from '../actions'
import {WatchLocalStorage} from '../api/syncStorage'
import extend from 'extend'

domready.done(function() {
    if (lsj.get("Options").useLargeLocalStorage)
        waitFor(()=>typeof LargeLocalStorage == 'function').done(r=> {
            window.llstorage = window.llstorage || new LargeLocalStorage({size: 125 * 1024 * 1024, name: 'KivaLens'})
        })
})

const Options = React.createClass({
    mixins: [Reflux.ListenerMixin, LinkedStateMixin, LocalStorageMixin],
    getInitialState(){ return { maxRepaymentTerms: 8, maxRepaymentTerms_on: false, missingPartners: [], showLenderModal: false } },
    getStateFilterKeys() {
        return ['maxRepaymentTerms', 'maxRepaymentTerms_on', 'kiva_lender_id', 'mergeAtheistList', 'debugging', 'betaTester', 'useLargeLocalStorage']
    },
    reload(){
        //this.setState(lsj.get("Options")) //this is messed up for lender_id, doesn't
    },
    componentDidMount(){
        this.listenTo(a.criteria.atheistListLoaded, this.figureAtheistStuff)
        //this.watcher = new WatchLocalStorage('Options', this.reload.bind(this))
        this.figureAtheistStuff()
    },
    figureAtheistStuff(){
        this.setState({atheist_list_processed: kivaloans.atheist_list_processed, missingPartners: this.getMissingPartners()})
    },
    componentDidUpdate(prevProps, {mergeAtheistList,useLargeLocalStorage}){
        //user just switched it on, after loans already loaded and list has not been downloaded yet, then process it.
        if (!mergeAtheistList && this.state.mergeAtheistList && !kivaloans.atheist_list_processed && kivaloans.isReady())
            kivaloans.getAtheistList()
        if (!useLargeLocalStorage && this.state.useLargeLocalStorage)
            waitFor(()=>typeof LargeLocalStorage == 'function').done(r=> {
                window.llstorage = window.llstorage || new LargeLocalStorage({
                        size: 125 * 1024 * 1024,
                        name: 'KivaLens'
                    })
            })
    },
    componentWillUnmount(){
        setDebugging()
    },
    showLenderIDModal(){this.setState({ showLenderModal: true })},
    hideLenderIDModal(){this.setState({ showLenderModal: false })},
    setLenderID(new_lender_id){ this.setState({kiva_lender_id: new_lender_id}) },
    getMissingPartners(){
        //get active partners without any score
        var m_partners = kivaloans.partners_from_kiva.where(p=>!p.atheistScore && p.status=='active')
        //look at the partner ids with loans, intersect them with partners without a score to be able to show which have loans.
        var m_p_with_loans = kivaloans.partner_ids_from_loans.intersect(m_partners.select(p=>p.id))
        return m_partners.select(p => extend(true, {}, p, {kl_hasLoans: m_p_with_loans.contains(p.id) }))
    },
    render() {
        return (<Grid>
                <h1>Options</h1>
                <Col md={12}>
                    <Panel header='Start Using the Search Sooner'>
                        <Input
                            type="checkbox"
                            label={`Allow me to start using the site after downloading all loans with ${this.state.maxRepaymentTerms} months before final repayment and less.`}
                            checkedLink={this.linkState('maxRepaymentTerms_on')} />
                        <input
                            type="range"
                            min={8}
                            max={120}
                            valueLink={this.linkState('maxRepaymentTerms')}/>
                        After the initial load of loans, the rest of the loans will get loaded so you'll still need to
                        use the final repayment date criteria option if you want to hide longer term loans.
                    </Panel>
                    <Panel header='Who are you?'>
                        {this.state.kiva_lender_id ?
                            <span>Your Lender ID: <b>{this.state.kiva_lender_id}</b> <ClickLink
                                onClick={this.showLenderIDModal}>Change</ClickLink></span>
                            :
                            <Button onClick={this.showLenderIDModal}>Set Kiva Lender ID</Button>
                        }
                        <SetLenderIDModal show={this.state.showLenderModal} onSet={this.setLenderID} onHide={this.hideLenderIDModal}/>
                        <p className="ample-padding-top">
                            This is used for:
                        </p>
                        <ul className='spacedList'>
                            <li><b>Excluding Fundraising Loans:</b> Fetches your loans from Kiva so it can remove
                                fundraising loans that are already in your portfolio to prevent accidentally
                                lending to the same borrower more than once.</li>
                            <li><b>Portfolio Balancing:</b> On the "Your Portfolio" Criteria tab, KivaLens will pull
                                public summary data of your portfolio for Partners, Countries, Sectors and Activities
                                so that you can exclude or include loans that match your criteria (ex: only find
                                Sectors that aren't like any in your total portfolio to collect them all
                                OR hide Partners that have more than 5% of your active portfolio
                                to balance your risk... and much more).</li>
                            <li><b>Basket Pruning:</b> By default, your basket will not clear when returning to the site.
                                If your Lender ID is set, when you come back to KivaLens, your basket will
                                have the loans that completed removed. Otherwise, you'll either need
                                to click the "Return to 3rd party app" at the end of your Kiva
                                checkout (which will clear your basket) or manually clear the basket when you come back
                                for loans that are still fundraising.</li>
                            <li><b>Team Comparision:</b> On the "Team" page, KivaLens will allow you to compare membership, loan count and total
                                lending on all of the teams you're on.</li>
                        </ul>

                    </Panel>
                    <Panel header='External Research'>
                        <Input
                            type="checkbox"
                            label={`Merge Atheist Team's MFI Research Data for Secular and Social ratings`}
                            checkedLink={this.linkState('mergeAtheistList')} />
                        <p>
                            KivaLens server pulls the <KivaLink path="team/atheists">Atheist Team</KivaLink>'s
                            MFI List from <NewTabLink href="https://docs.google.com/spreadsheets/d/1KP7ULBAyavnohP4h8n2J2yaXNpIRnyIXdjJj_AwtwK0/edit#gid=1" title="View Google Doc">this Google Doc</NewTabLink> and
                            merges some of the data which allows you to search using their Secular (1-4)
                            and Social ratings (1-4) where a 1 represents a low score, so a 1 in the Secular Score
                            means that it is religion based. When activated, this will add 2 new sliders to the Partner
                            tab for Criteria and a section displaying and explaining the ratings to the Partner tab
                            of the loan. If a partner is not present in the MFI Research Data, it will pass by default.
                        </p>
                        <If condition={this.state.atheist_list_processed}>
                            <div><b>Partners not included in Atheist Data:</b>
                                <If condition={this.state.missingPartners.length==0}>
                                    <span> None</span>
                                </If>
                            <ul>
                                <For each='p' index='i' of={this.state.missingPartners}>
                                    <li key={i}>
                                        {p.id}: <KivaLink path={`partners/${p.id}`}>{p.name}</KivaLink>
                                        <If condition={p.kl_hasLoans}>
                                            <span> (Has loans loaded)</span>
                                        </If>
                                    </li>
                                </For>
                            </ul>
                            </div>
                        </If>
                    </Panel>
                    <Panel header='Debug/Beta Testing'>
                        <Input
                            type="checkbox"
                            label="Show me features that are being beta-tested"
                            checkedLink={this.linkState('betaTester')} />
                        <Input
                            type="checkbox"
                            label="Store loans in my browser's database; used when opening multiple tabs to prevent re-downloading (previous option must be checked as well)"
                            checkedLink={this.linkState('useLargeLocalStorage')} />
                        <Input
                            type="checkbox"
                            label="Output debugging console messages"
                            checkedLink={this.linkState('debugging')} />
                    </Panel>

                </Col>
            </Grid>
        )
    }
})

export default Options;