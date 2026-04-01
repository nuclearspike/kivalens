'use strict';

import React from 'react'
import Reflux from 'reflux'
import {Grid,Input,Row,Col,Panel,Alert,Button} from 'react-bootstrap'
import LinkedStateMixin from 'react-addons-linked-state-mixin'
import TimeAgo from 'react-timeago'
import LocalStorageMixin from 'react-localstorage'
import {KivaLink, NewTabLink, ClickLink, SetLenderIDModal, KivaImage, LenderLink} from '.'
import a from '../actions'
import s from '../stores'
import extend from 'extend'
import lendAmountOptions from '../lendAmountOptions'

const Options = React.createClass({
    mixins: [Reflux.ListenerMixin, LinkedStateMixin, LocalStorageMixin],
    getInitialState(){
        return {maxRepaymentTerms: 8, maxRepaymentTerms_on: false, missingPartners: [], showLenderModal: false, showAllPartners: false, hide_criteria_graphs: !!(lsj.get('Options').hide_criteria_graphs)}
    },
    getStateFilterKeys() {
        return ['maxRepaymentTerms', 'maxRepaymentTerms_on', 'kiva_lender_id', 'mergeAtheistList',
            'debugging', 'betaTester', 'loansFromKiva', 'lenderLoansFromKiva', 'default_lend_amount']
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
        this.setState({
            atheist_list_processed: kivaloans.atheist_list_processed,
            missingPartners: this.getMissingPartners()
        })
    },
    componentDidUpdate(prevProps, {mergeAtheistList}){
        //user just switched it on, after loans already loaded and list has not been downloaded yet, then process it.
        if (!mergeAtheistList && this.state.mergeAtheistList && !kivaloans.atheist_list_processed && kivaloans.isReady())
            kivaloans.getAtheistList()
    },
    componentWillUnmount(){
        setDebugging()
    },
    showLenderIDModal(){
        this.setState({showLenderModal: true})
    },
    hideLenderIDModal(){
        this.setState({showLenderModal: false})
    },
    setLenderID(new_lender_id){
        this.setState({kiva_lender_id: new_lender_id})
    },
    getMissingPartners(){
        //get active partners without any score
        var m_partners = kivaloans.partners_from_kiva.where(p=>!p.atheistScore && p.status == 'active')
        //look at the partner ids with loans, intersect them with partners without a score to be able to show which have loans.
        var m_p_with_loans = kivaloans.loans_from_kiva.where(loan => loan.partner_id).select(loan => loan.partner_id).distinct().intersect(m_partners.select(p=>p.id))
        return m_partners.select(p => extend(true, {}, p, {kl_hasLoans: m_p_with_loans.contains(p.id)}))
    },
    render() {
        let {kiva_lender_id} = this.state
        let lenderObj = s.utils.lenderObj
        return <Grid>
            <h1>Options</h1>
            <Col md={12}>
                <Panel header='Who are you?'>
                    {kiva_lender_id ?
                        <span>Your Lender ID: <b>{kiva_lender_id}</b> <ClickLink
                            onClick={this.showLenderIDModal}>Change</ClickLink></span>
                        : <Button onClick={this.showLenderIDModal}>Set Kiva Lender ID</Button> }
                    <SetLenderIDModal show={this.state.showLenderModal} onSet={this.setLenderID}
                                      onHide={this.hideLenderIDModal}/>
                    {lenderObj ? <Grid>
                            <Col sm={2}>
                                <KivaImage type="square" image_id={lenderObj.image.id} image_width={113} height={113}
                                           width={113}/>
                            </Col>
                            <Col sm={10}>
                                <dl className="dl-horizontal">
                                    <dt>Name</dt>
                                    <dd>{lenderObj.name}</dd>
                                    <dt>Loan Count</dt>
                                    <dd>{lenderObj.loan_count}</dd>
                                    <dt>Invitees</dt>
                                    <dd>{lenderObj.invitee_count}</dd>
                                    <dt>Your Invitation Link</dt>
                                    <dd><KivaLink
                                        path={`invitedby/${lenderObj.lender_id}`}>{`https://www.kiva.org/invitedby/${lenderObj.lender_id}`}</KivaLink>
                                    </dd>
                                    <dt>Joined</dt>
                                    <dd><TimeAgo date={lenderObj.member_since}/></dd>
                                    <dt>Location</dt>
                                    <dd>{lenderObj.whereabouts}</dd>
                                    <dt>Lender Page</dt>
                                    <dd><LenderLink lender={kiva_lender_id}>Your Lender Page</LenderLink></dd>
                                </dl>
                            </Col>
                        </Grid> : null}
                    <p className="ample-padding-top">Your Lender ID enables:</p>
                    <ul className='spacedList'>
                        <li><b>Exclude Loans I've Made:</b> Hides loans you've already funded so you don't accidentally lend twice to the same borrower.</li>
                        <li><b>Portfolio Balancing:</b> Filter by Partners, Countries, Sectors, and Activities relative to your existing portfolio.</li>
                        <li><b>Basket Pruning:</b> Automatically removes completed loans from your basket when you return to KivaLens.</li>
                        <li><b>Team Comparison:</b> Compare membership and lending across all your teams.</li>
                        <li><b>3D Loan Wall:</b> Visualize your portfolio at <a href="#/portfolio">wall</a>.</li>
                    </ul>
                </Panel>
                <Panel header='Display'>
                    <div className="form-group">
                        <label>Default Lending Amount</label>
                        <div>
                            <select
                                value={this.state.default_lend_amount || 25}
                                onChange={e => this.setState({default_lend_amount: parseInt(e.target.value)})}
                                style={{padding: '4px 8px', fontSize: 14, borderRadius: 4, border: '1px solid #ccc'}}>
                                {lendAmountOptions(1000).map(o => <option key={o} value={o}>${o}</option>)}
                            </select>
                        </div>
                    </div>
                    <Input
                        type="checkbox"
                        label="Show distribution graphs when selecting criteria options"
                        checked={!this.state.hide_criteria_graphs}
                        onChange={e => { this.setState({hide_criteria_graphs: !e.target.checked}); lsj.setMerge('Options', {hide_criteria_graphs: !e.target.checked}) }}/>
                </Panel>
                <Panel header='External Research'>
                    <Input
                        type="checkbox"
                        label={`Merge A+ Team's MFI Research Data for Secular, Social, and Religion ratings`}
                        checked={true}
                        disabled={true}
                        readOnly={true}/>
                    <p>
                        KivaLens pulls the <KivaLink path="team/aplus">A+ Team</KivaLink>'s
                        (Atheists, Agnostics, Skeptics, Freethinkers, Secular Humanists and the Non-Religious)
                        MFI List from <NewTabLink
                        href="https://docs.google.com/spreadsheets/d/1KP7ULBAyavnohP4h8n2J2yaXNpIRnyIXdjJj_AwtwK0/edit#gid=1"
                        title="View Google Doc">this Google Doc</NewTabLink> and
                        merges some of the data which allows you to search using their Secular (1-4)
                        and Social ratings (1-4) where a 1 represents a low score, so a 1 in the Secular Score
                        means that it is religion based. This adds 2 sliders to the Partner
                        Criteria tab, a Religion filter, and an additional section displaying and explaining
                        the ratings on the Partner tab of the loan. If a partner is not present in the
                        MFI Research Data, by default, it will show up in the results.
                    </p>
                    {this.state.atheist_list_processed ? <div><b>Partners not included in A+ Team Research Data:</b>
                            {this.state.missingPartners.length == 0 ? <span> None</span> : null}
                            <ul>
                                {(this.state.showAllPartners ? this.state.missingPartners : this.state.missingPartners.slice(0,5)).map((p, i) => <li key={i}>
                                        {p.id}: <KivaLink
                                        path={`about/where-kiva-works/partners/${p.id}`}>{p.name}</KivaLink>
                                        {p.kl_hasLoans ? <span> (Has loans fundraising)</span> : null}
                                    </li>)}
                            </ul>
                            {this.state.missingPartners.length > 5 ? <ClickLink onClick={()=>this.setState({showAllPartners: !this.state.showAllPartners})}>
                                    {this.state.showAllPartners ? 'Show Less' : `See More (${this.state.missingPartners.length - 5} more)`}
                                </ClickLink> : null}
                        </div> : null}
                </Panel>
                <Panel header='Debug/Beta Testing'>
                    <Input
                        type="checkbox"
                        label="Show me features that are being beta-tested (this option currently does nothing.)"
                        checkedLink={this.linkState('betaTester')}/>
                    <Input
                        type="checkbox"
                        label="Download lender portfolio loans from Kiva's server instead of KivaLens (only use this if experiencing problems; it's much slower!)"
                        checkedLink={this.linkState('lenderLoansFromKiva')}/>
                    <Input
                        type="checkbox"
                        label="Download loans from Kiva's server instead of KivaLens (only use this if experiencing problems; it's much slower!)"
                        checkedLink={this.linkState('loansFromKiva')}/>
                    <Input
                        type="checkbox"
                        label={`When loading loans from Kiva (option above), allow me to start using the site after downloading all loans with ${this.state.maxRepaymentTerms} months before final repayment and less.`}
                        checkedLink={this.linkState('maxRepaymentTerms_on')}/>
                    <input type="range" min={8} max={120} valueLink={this.linkState('maxRepaymentTerms')}/>
                    This option only has an impact when loading loans from Kiva rather than KivaLens.
                    After the initial load of loans, the rest of the loans will get loaded so you'll still need to
                    use the final repayment date criteria option if you want to hide longer term loans.
                    <Input
                        type="checkbox"
                        label="Output debugging messages to the console."
                        checkedLink={this.linkState('debugging')}/>
                </Panel>

            </Col>
        </Grid>
    }
})

export default Options;