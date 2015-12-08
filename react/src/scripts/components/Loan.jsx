'use strict';
import React from 'react'
import Reflux from 'reflux'
var Highcharts = require('react-highcharts/dist/bundle/highcharts')
import ReactCSSTransitionGroup from 'react-addons-css-transition-group'
import {History} from 'react-router'
import {Tabs,Tab,Grid,Col,Row,ProgressBar,Button} from 'react-bootstrap'
import TimeAgo from 'react-timeago'
import {KivaImage} from '.'
import a from '../actions'
import s from '../stores/'
import numeral from 'numeral'

const DTDD = ({term, def}) => {return <span><dt>{term}</dt><dd>{def}</dd></span>}

//const _dtdd = (term, def) => { return <span><dt>{term}</dt>, <dd>{def}</dd></span>}

//const DTDD = React.createClass({
//    render(){
//        let {term, def} = this.props
//        return <span><dt>{term}</dt><dd>{def}</dd></span>
//    }
//})

var Loan = React.createClass({
    mixins:[Reflux.ListenerMixin, History],
    getInitialState(){ return this.stateFromProps(this.props) },
    componentWillUnmount(){ clearInterval(this.refreshInterval) },
    componentWillMount(){ },
    componentDidMount(){
        this.listenTo(a.loans.detail.completed, loan=>{ if (this.props.params.id == loan.id){ this.switchToLoan(loan) } })
        this.listenTo(a.loans.basket.changed, ()=>{ if (this.state.loan) this.setState({inBasket: s.loans.syncInBasket(this.state.loan.id)}) })
        this.listenTo(a.loans.load.completed, this.refreshLoan) //waits until page has finished loading... todo: if later make loader non-modal, change this.
        this.refreshLoan() //happens always even if we have it, to cause a refresh.
        this.refreshInterval = setInterval(this.refreshLoan,30000)
    },
    componentWillReceiveProps(props){
        this.setState(this.stateFromProps(props))
        a.loans.detail(props.params.id) //cannot be refreshLoan() newProps!
        clearInterval(this.refreshInterval)
        this.refreshInterval = setInterval(this.refreshLoan, 30000)
    },
    stateFromProps({params}){
        //var loan = s.loans.syncGet(params.id)
        var active_tab = (localStorage.loan_active_tab) ? parseInt(localStorage.loan_active_tab) : 1
        return {activeTab: active_tab}
    },
    switchToLoan(loan){
        var funded_perc = (loan.funded_amount * 100 /  loan.loan_amount)
        var basket_perc = (loan.basket_amount * 100 /  loan.loan_amount)
        this.calcRepaymentsGraph(loan)
        var partner = kivaloans.getPartner(loan.partner_id)
        this.setState({loan: loan, partner: partner, basket_perc: basket_perc, funded_perc: funded_perc, inBasket: s.loans.syncInBasket(loan.id)})
        this.graphHack()
    },
    refreshLoan(){
        a.loans.detail(this.props.params.id)
    },
    tabSelect(selectedKey){
        this.setState({activeTab: selectedKey, showGraphs: false})
        localStorage.loan_active_tab = selectedKey
        this.graphHack()
    },
    graphHack(){
        setTimeout(()=> this.setState({showGraphs: true}), 600) //hacky! if this doesn't happen, the graphs paint wrong. :(
    },
    produceChart(loan){
        var result = {
            chart: {type: 'bar',
                animation: true,
                renderTo: 'graph_container'
            },
            title: {text: 'Repayments'},
            xAxis: {
                categories: loan.kl_repay_categories,
                title: {text: null}
            },
            yAxis: {
                min: 0,
                dataLabels: {enabled: false},
                labels: {overflow: 'justify'}
            },
            tooltip: {
                valueDecimals: 2,
                valueSuffix: ' USD'
            },
            plotOptions: {
                bar: {
                    dataLabels: {
                        enabled: true,
                        format: '${y:.2f}'
                    }
                }
            },
            legend: {enabled: false},
            credits: {enabled: false},
            series: [{
                animation: false,
                name: 'Repayment',
                data: loan.kl_repay_data
            }]
        }

        return result
    },
    calcRepaymentsGraph(loan){
        if (loan.kl_repay_categories || !loan.terms.scheduled_payments) return
        var payments = loan.terms.scheduled_payments.select(payment => {
            return {due_date: new Date(payment.due_date).toString("MMM-yyyy"), amount: payment.amount}
        })
        var grouped_payments  = payments.groupBy(p => p.due_date).map(g => { return {due_date: g[0].due_date, amount: g.sum(r => r.amount)} })
        loan.kl_repay_categories = grouped_payments.select(payment => payment.due_date)
        loan.kl_repay_data = grouped_payments.select(payment => payment.amount)
    },
    render() {
        var loan = this.state.loan
        var partner = this.state.partner
        if (!loan || !partner) return (<div>Loading...</div>) //only if looking at loan during initial load or one that isn't fundraising.
        var atheistScore = partner.atheistScore
        if (!partner.social_performance_strengths) partner.social_performance_strengths = [] //happens other than old partners? todo: do a partner processor?
        return (
            <div>
                <h1 style={{marginTop:'0px'}}>{loan.name}
                    <If condition={this.state.inBasket}>
                        <Button className="float_right" onClick={a.loans.basket.remove.bind(this, loan.id)}>Remove from Basket</Button>
                    <Else/>
                        <Button className="float_right" disabled={loan.status!='fundraising'} onClick={a.loans.basket.add.bind(this, loan.id, 25)}>Add to Basket</Button>
                    </If>
                </h1>
                <Tabs activeKey={this.state.activeTab} onSelect={this.tabSelect}>
                    <Tab eventKey={1} title="Image" className="ample-padding-top">
                        <KivaImage loan={loan} type="width" image_width={800} width="100%"/>
                    </Tab>
                    <Tab eventKey={2} title="Details" className="ample-padding-top">
                        <Col lg={8}>
                            <ProgressBar>
                                <ProgressBar striped bsStyle="success" now={this.state.funded_perc} key={1}/>
                                <ProgressBar bsStyle="warning" now={this.state.basket_perc} key={2}/>
                            </ProgressBar>
                        <Row>
                            <b>{loan.location.country} | {loan.sector} | {loan.activity} | {loan.use}</b>
                        </Row>
                        <Row>
                            <a href={`http://www.kiva.org/lend/${loan.id}`} target="_blank">View on Kiva.org</a>
                        </Row>
                            <dl className="dl-horizontal">
                                <dt>Tags</dt><dd>{(loan.kl_tags.length)? loan.kl_tags.select(t=>humanize(t)).join(', '): '(none)'}</dd>
                                <dt>Themes</dt><dd>{(loan.themes && loan.themes.length)? loan.themes.join(', '): '(none)'}</dd>
                                <dt>Borrowers</dt><dd>{loan.borrowers.length} ({Math.round(loan.kl_percent_women)}% Female) </dd>
                                <dt>Posted</dt><dd>{loan.kl_posted_date.toString('MMM d, yyyy @ h:mm:ss tt')} (<TimeAgo date={loan.posted_date} />)</dd>
                                <If condition={loan.status != 'fundraising'}>
                                    <DTDD term='Status' def={humanize(loan.status)} />
                                </If>
                                <If condition={loan.funded_date}>
                                    <DTDD term='Funded' def={new Date(loan.funded_date).toString('MMM d, yyyy @ h:mm:ss tt')} />
                                </If>
                                <If condition={loan.status == 'fundraising'}>
                                    <span><dt>Expires</dt><dd>{new Date(loan.planned_expiration_date).toString('MMM d, yyyy @ h:mm:ss tt')} (<TimeAgo date={loan.planned_expiration_date} />) </dd></span>
                                </If>
                                <dt>Disbursed</dt><dd>{new Date(loan.terms.disbursal_date).toString('MMM d, yyyy')} (<TimeAgo date={loan.terms.disbursal_date} />) </dd>
                            </dl>
                            <If condition={loan.status == 'fundraising'}>
                                <dl className="dl-horizontal">
                                    <dt>$/Hour</dt><dd>${numeral(loan.kl_dollars_per_hour).format('0.00')}</dd>
                                    <dt>Loan Amount</dt><dd>${loan.loan_amount}</dd>
                                    <dt>Funded Amount</dt><dd>${loan.funded_amount}</dd>
                                    <dt>Basket Amount</dt><dd>${loan.basket_amount}</dd>
                                    <dt>Still Needed</dt><dd>${loan.kl_still_needed}</dd>
                                </dl>
                            </If>
                            <p dangerouslySetInnerHTML={{__html: loan.description.texts.en}} ></p>

                        </Col>
                        <ReactCSSTransitionGroup transitionName="simpleFade" transitionEnterTimeout={500} transitionLeaveTimeout={300} >
                            <If condition={this.state.activeTab == 2 && this.state.showGraphs}>
                                <Col lg={4} style={{height: '500px'}} id='graph_container'>
                                    <Highcharts config={this.produceChart(loan)} />
                                    <dl className="dl-horizontal">
                                        <dt>50% back by</dt><dd>{loan.kl_half_back.toString("MMM d, yyyy")}</dd>
                                        <dt>75% back by</dt><dd>{loan.kl_75_back.toString("MMM d, yyyy")}</dd>
                                        <dt>Final repayment</dt><dd>{loan.kl_final_repayment.toString("MMM d, yyyy")}</dd>
                                    </dl>
                                </Col>
                            </If>
                        </ReactCSSTransitionGroup>
                    </Tab>

                    <Tab eventKey={3} title="Partner" className="ample-padding-top">
                            <h2>{partner.name}</h2>
                            <Col lg={6}>
                            <dl className="dl-horizontal">
                                <dt>Rating</dt><dd>{partner.rating}</dd>
                                <dt>Start Date</dt><dd>{new Date(partner.start_date).toString("MMM d, yyyy")}</dd>
                                <dt>{partner.countries.length == 1 ? 'Country' : 'Countries'}</dt><dd>{partner.countries.select(c => c.name).join(', ')}</dd>
                                <dt>Delinquency</dt><dd>{numeral(partner.delinquency_rate).format('0.000')}% {partner.delinquency_rate_note}</dd>
                                <dt>Default</dt><dd>{numeral(partner.default_rate).format('0.000')}% {partner.default_rate_note}</dd>
                                <dt>Total Raised</dt><dd>${numeral(partner.total_amount_raised).format('0,0')}</dd>
                                <dt>Loans</dt><dd>{numeral(partner.loans_posted).format('0,0')}</dd>
                                <dt>Portfolio Yield</dt><dd>{numeral(partner.portfolio_yield).format('0.0')}% {partner.portfolio_yield_note}</dd>
                                <dt>Profitablility</dt>
                                <If condition={partner.profitability}>
                                    <dd>{numeral(partner.profitability).format('0.0')}%</dd>
                                <Else/>
                                    <dd>(unknown)</dd>
                                </If>
                                <dt>Charges Fees / Interest</dt><dd>{partner.charges_fees_and_interest ? 'Yes': 'No'}</dd>
                                <dt>Loans at Risk Rate</dt><dd>{numeral(partner.loans_at_risk_rate).format('0.000')}%</dd>
                                <dt>Avg Loan/Cap Income</dt><dd>{numeral(partner.average_loan_size_percent_per_capita_income).format('0.00')}%</dd>
                                <dt>Currency Ex Loss</dt><dd>{numeral(partner.currency_exchange_loss_rate).format('0.000')}%</dd>
                                <If condition={partner.url}>
                                    <span><dt>Website</dt><dd><a href={partner.url} target='_blank'>{partner.url}</a></dd></span>
                                </If>
                            </dl>

                            </Col>
                        <Col lg={6}>
                            <If condition={partner.image}>
                                <KivaImage className="float_left" type="width" loan={partner} image_width={800} width="100%"/>
                            </If>
                            <a href={`http://www.kiva.org/partners/${partner.id}`} target="_blank">View Partner on Kiva.org</a>
                        </Col>
                        <Col lg={12}>
                            <If condition={partner.kl_sp.length}>
                                <div>
                                    <h3>Social Performance Strengths</h3>
                                    <ul>
                                        <For each="sp" index="i" of={partner.social_performance_strengths}>
                                            <li key={i}><b>{sp.name}</b>: {sp.description}</li>
                                        </For>
                                    </ul>
                                </div>
                            </If>

                            <If condition={atheistScore}>
                                <div>
                                    <h3>Atheist Team Research</h3>
                                    <dl className="dl-horizontal">
                                        <dt>Secular Rating</dt><dd>{atheistScore.secularRating}</dd>
                                        <dt>Religious Affiliation</dt><dd>{atheistScore.religiousAffiliation}</dd>
                                        <dt>Comments on Rating</dt><dd>{atheistScore.commentsOnSecularRating}</dd>
                                        <dt>Social Rating</dt><dd>{atheistScore.socialRating}</dd>
                                        <dt>Comments on Rating</dt><dd>{atheistScore.commentsOnSocialRating}</dd>
                                        <dt>Review Comments</dt><dd>{atheistScore.reviewComments}</dd>
                                    </dl>
                                </div>
                            </If>
                        </Col>
                    </Tab>
                </Tabs>
            </div>
        )
    }
})

export default Loan;