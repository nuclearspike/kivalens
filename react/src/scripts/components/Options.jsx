'use strict';

import React from 'react'
import {Grid,Input,Row,Col,Panel,Alert} from 'react-bootstrap'
import LinkedStateMixin from 'react-addons-linked-state-mixin'
import LocalStorageMixin from 'react-localstorage'

const Options = React.createClass({
    mixins: [LinkedStateMixin, LocalStorageMixin],
    getInitialState(){ return { maxRepaymentTerms: 120, maxRepaymentTerms_on: false, missingPartners: [] } },
    componentDidMount(){
        this.setState({missingPartners: this.getMissingPartners()})
    },
    getMissingPartners(){
        var m_partners = kivaloans.partners_from_kiva.where(p=>!p.atheistScore && p.status=='active')
        var m_p_with_loans = kivaloans.partner_ids_from_loans.intersect(m_partners.select(p=>p.id))
        console.log(m_partners)
        return m_partners.select(p => $.extend(true, {}, p, {kl_hasLoans: m_p_with_loans.contains(p.id) }))
    },
    render() {
        return (
            <Grid>
                <h1>Options</h1>
                <Col md={12}>
                    <Panel
                        header='Notice'
                        bsStyle="info">
                        <p>Changing these settings will <i>only</i> take effect the next time you visit the site/reload the page.</p>
                        <p>Expect these settings to change and your settings may be reset occasionally while in beta. Sorry for any inconvenience.</p>
                    </Panel>
                    <Panel header='Repayment Terms'>
                        <Input
                            type="checkbox"
                            label={`Ignore Loans over ${this.state.maxRepaymentTerms} month repayment terms (stop downloading)`}
                            checkedLink={this.linkState('maxRepaymentTerms_on')} />
                        <input
                            type="range"
                            min={8}
                            max={120}
                            valueLink={this.linkState('maxRepaymentTerms')}/>
                        After the initial load, if you keep the app open long enough, the rest of the loans will get loaded so you'll still need to use the
                        final repayment date criteria option.
                    </Panel>
                    <Panel header='Who are you?'>
                        <Input
                            type='text'
                            label='Kiva Lender ID'
                            labelClassName='col-lg-2'
                            wrapperClassName='col-lg-10'
                            valueLink={this.linkState('kiva_lender_id')} />
                        <a href="http://www.kiva.org/myLenderId" target="_blank">Click here if you don't know yours</a>

                        <p className="ample-padding-top">
                            This is used when filtering loans to hide loans you've already loaned to and to automatically
                            prune your basket when you come back to KivaLens after making loan purchases.
                            Also, expect more in the future to help balance your portfolio.
                        </p>
                    </Panel>
                    <Panel header='External Research'>
                        <Input
                            type="checkbox"
                            label={`Merge Atheist Team's MFI Research Data for Secular and Social ratings`}
                            checkedLink={this.linkState('mergeAtheistList')} />
                        <p>
                            KivaLens server pulls the <a href="http://www.kiva.org/team/atheists" target="_blank">Atheist Team</a>'s
                            MFI List found in a <a href="http://docs.google.com/spreadsheets/d/1KP7ULBAyavnohP4h8n2J2yaXNpIRnyIXdjJj_AwtwK0/export?gid=1&format=csv" target="_blank">Google Doc</a> once
                            a day and merges some of the data which allows you to search using their Secular (1-4)
                            and Social ratings (1-4) where a 1 represents a low score, so a 1 in the Secular Score
                            means that it is religion based. When activated, this will add 2 new sliders to the Partner
                            tab for Criteria and a section displaying and explaining the ratings to the Partner tab
                            of the loan. If a partner is not present in the MFI Research Data, it will pass by default.
                        </p>
                        <If condition={kivaloans.atheist_list_processed}>
                            <div><b>Partners not included in Atheist Data:</b>
                                <If condition={this.state.missingPartners.length==0}>
                                    <span> None</span>
                                </If>
                            <ul>
                                <For each='p' index='i' of={this.state.missingPartners}>
                                    <li key={i}>
                                        {p.id}: <a href={`http://www.kiva.org/partners/${p.id}`} target="_blank">{p.name}</a>
                                        <If condition={p.kl_hasLoans}>
                                            <span> (Has loans loaded)</span>
                                        </If>
                                    </li>
                                </For>
                            </ul>
                            </div>
                        </If>
                    </Panel>
                </Col>
            </Grid>
        )
    }
})

export default Options;