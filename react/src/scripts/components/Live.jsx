'use strict'
import React from 'react'
import Reflux from 'reflux'
import LinkedStateMixin from 'react-addons-linked-state-mixin'

import {Grid,Col,Row,Panel,Alert} from 'react-bootstrap'
import {KivaLink} from '.'
import {DelayStateTriggerMixin} from './Mixins'
import a from '../actions'
import numeral from 'numeral'
import {Motion, spring} from 'react-motion'
import LocalStorageMixin from 'react-localstorage'
import TimeAgo from 'react-timeago'

//move this out and import once used elsewhere.
const AnimInt = React.createClass({
    getInitialState(){ return {oldVal: this.props.value, newVal: this.props.value} },
    componentWillReceiveProps({value}){this.setState({oldVal: this.state.newVal, newVal: value})},
    //add a way to override the default formatting if needed.
    render(){
        let {oldVal, newVal} = this.state
        return <Motion defaultStyle={{x: oldVal}} style={{x: spring(newVal)}}>
            {value => <span>{numeral(Math.round(value.x)).format('0,0')}</span>}
        </Motion>
    }
})

const LabeledNumber = ({number, label}) => <div key={label} className="labeledNumber">
    <div className="number"><AnimInt value={number}/></div>
    <div className="name">{label}</div>
</div>

const TopTen = React.createClass({
    shouldComponentUpdate({data}){
        if (this.props.data.length != data.length)
            return true
        return (JSON.stringify(this.props.data) != JSON.stringify(data))
    },
    render(){
        let {title, data = [], field = 'count'} = this.props
        return <Col md={4}>
            <Panel header={title}>
                <If condition={data.length == 0}>
                    <p>Waiting for more activity</p>
                <Else/>
                    <For each='ranked' index='i' of={data}>
                        <LabeledNumber key={ranked.name} number={ranked[field]} label={ranked.name}/>
                    </For>
                </If>
            </Panel>
        </Col>
    }
})

const Live = React.createClass({
    mixins: [Reflux.ListenerMixin, LinkedStateMixin, LocalStorageMixin,DelayStateTriggerMixin('maxMinutes','recalcTop', 200)],
        //DelayStateTriggerMixin(s=>s.running_totals.funded_amount,'recalcTop',1000)],
    getInitialState() {
        return {
            running_totals: kivaloans.running_totals, maxMinutes: 30,
            top_lending_countries: [], top_sectors: [], top_countries: [],
            funded_sum:0, still_needed:0, basket_amount:0, fundraising_amount:0, avg_percent_funded: 0
        }
    },
    getStateFilterKeys() {return ['maxMinutes']},
    componentDidMount() {
        this.listenTo(a.loans.live.statsChanged, this.newRunningTotals)
        this.recalcTop()
        if (!channels["loan.purchased"])
            this.setState({notActive: true})
        else
            this.topInterval = setInterval(this.recalcTop, 5000)
    },
    newRunningTotals(rt){
        this.setState({running_totals: rt, force: Math.random().toString()})
        this.forceUpdate()
    },
    recalcTop(){
        var c = channels["loan.purchased"]
        if (!c) return
        var x_mins_ago = parseInt(this.state.maxMinutes).minutes().ago()

        //get recent message payloads
        var messages = c.data.where(d=>d.received.isAfter(x_mins_ago)).select(d => d.data.p)

        const selectLocation = p => {
            var country = '(Undisclosed)'
            if (p.lender.public) //this still gets garbage data  ("AK" "Front Porch")
                country = p.lender.lenderPage.whereabouts.split(',').last().trim() || country
            return {country, loan_count: p.loans.length}
        }

        //top lending countries
        var top_lending_countries = messages.select(selectLocation).groupBySelectWithSum(c=>c.country, c=>c.loan_count)
            .orderBy(g=>g.sum, basicReverseOrder).take(10)

        //generic splattening of the payloads to get the loan objects
        var loans_during = messages.select(p=>p.loans).flatten()

        var top_sectors = loans_during.groupByWithCount(l=>l.sector.name).orderBy(g=>g.count, basicReverseOrder).take(10)
        var top_countries = loans_during.groupByWithCount(l=> l.location ? l.location.country.name : '(Location Unknown: Error)').orderBy(g=>g.count, basicReverseOrder).take(10)

        var fundraising_loans = kivaloans.loans_from_kiva.where(l=>l.status=='fundraising')
        var funded_sum    = fundraising_loans.sum(l=>l.funded_amount)
        var still_needed  = fundraising_loans.sum(l=>l.kl_still_needed)
        var basket_amount = fundraising_loans.sum(l=>l.basket_amount)
        var fundraising_amount = fundraising_loans.sum(l=>l.loan_amount)
        var avg_percent_funded = 0
        if (fundraising_loans.length)
            avg_percent_funded = fundraising_loans.sum(l=>l.kl_percent_funded) / fundraising_loans.length

        this.setState({funded_sum, still_needed, basket_amount, fundraising_amount, avg_percent_funded})

        if (this.state.running_totals.funded_amount >= 250)
            this.setState({top_lending_countries, top_sectors, top_countries})

    },
    componentWillUnmount(){
        clearInterval(this.topInterval)
    },
    shouldComponentUpdate(p,state){
        return JSON.stringify(state) != JSON.stringify(this.state)
    },
    render() {
        let {new_loans, funded_loans, funded_amount, expired_loans} = this.state.running_totals
        let {funded_sum, still_needed, basket_amount, fundraising_amount,avg_percent_funded,notActive} = this.state
        return <Grid>
                <Row>
                    <h1>Kiva Lending</h1>
                    <If condition={notActive}>
                        <Alert bsStyle="warning">
                            You do not have the live stream enabled for this session. To enable it, go to Options, uncheck the box that disables it and reload the page.
                        </Alert>
                    <Else/>
                        <p>
                            To keep data up-to-the-second fresh, KivaLens listens to the same live data-stream
                            that <KivaLink path='live?v=1'>Kiva /Live</KivaLink> uses and adds new loans and updates existing
                            loans accordingly. Since starting your current KivaLens session (<TimeAgo date={kivaloans.startupTime.toISOString()}/>), the following activity has occurred
                            on Kiva.org.
                        </p>
                    </If>
                </Row>
                <If condition={!notActive}>
                    <Row>
                        <Col md={3}>
                            <h3>Since session start</h3>
                            <dl className="dl-horizontal" style={{fontSize: 'large'}}>
                                <dt>New Loans</dt><dd><AnimInt value={new_loans}/></dd>
                                <dt>Fully Funded</dt><dd><AnimInt value={funded_loans}/></dd>
                                <dt>Expired</dt><dd><AnimInt value={expired_loans}/></dd>
                                <dt>Lending Total</dt><dd>$<AnimInt value={funded_amount}/></dd>
                            </dl>
                            <h3>Fundraising Loans</h3>
                            <dl className="dl-horizontal" style={{fontSize: 'large'}}>
                                <dt>Fundraising</dt><dd>$<AnimInt value={fundraising_amount}/></dd>
                                <dt>Funded Amount</dt><dd>$<AnimInt value={funded_sum}/></dd>
                                <dt>In Baskets</dt><dd>$<AnimInt value={basket_amount}/></dd>
                                <dt>Still Needed</dt><dd>$<AnimInt value={still_needed}/></dd>
                                <dt>Average Funded</dt><dd><AnimInt value={avg_percent_funded}/>%</dd>
                            </dl>
                            <If condition={false && lsj.get("Options").maxRepaymentTerms_on}>
                                <p>
                                    * These totals only include the loans KivaLens has pulled from Kiva.
                                </p>
                            </If>
                        </Col>

                        <Col md={9}>
                            <Grid fluid>
                                <Row>
                                    <Col md={6}>
                                        <input type="range" min="5" max='30' step="1" valueLink={this.linkState('maxMinutes')}/>
                                    </Col>
                                    <Col md={6}>
                                        Up to the last {this.state.maxMinutes} minutes of lending
                                    </Col>
                                </Row>

                                <Row className="ample-padding-top">
                                    <TopTen title='Top Lending Countries' data={this.state.top_lending_countries} field='sum'/>
                                    <TopTen title='Top Sectors' data={this.state.top_sectors} />
                                    <TopTen title='Top Countries' data={this.state.top_countries} />
                                </Row>
                            </Grid>
                        </Col>
                    </Row>
                </If>
                <Row>
                    <h2>How is KivaLens so Fast and Fresh?</h2>
                    <ul className='spacedList'>
                        <li>
                            When you first start a new KivaLens session (or click your browser's "Reload" button), your
                            browser downloads the entire KivaLens app and after that doesn't talk to the KivaLens
                            server when clicking between pages.
                        </li>
                        <li>
                            Once the page has loaded, KivaLens pulls its listing of loans from the KivaLens server
                            (which has pulled them from Kiva's API, stripped out everything it doesn't need and has them
                            ready to go) and keeps all of the loan and partner data in your browser's memory.
                        </li>
                        <li>
                            With all of the activity on Kiva, the data that KivaLens pulled can quickly become stale. To
                            keep it fresh, KivaLens listens to Kiva's live data-stream of both lending activity
                            and newly posted loans and updates it's own listing automatically. Each time you do a
                            search, it's searching the most recent data.
                        </li>
                        <li>
                            Every time you click on a loan, KivaLens will first immediately display what it has while
                            simultaneously requesting the most recent version of the loan and will seamlessly merge
                            any changes once it has the data. What could change? User tags is an example of data that
                            changes over time but doesn't get published in the live data stream.
                        </li>
                        <li>
                            After 5 minutes then once every 10 minutes, KivaLens silently performs a full resync of its
                            data with Kiva's API to catch any changes not included in the datastream notifications. This
                            also fixes any issues from your computer having been asleep with a tab open to KivaLens.
                        </li>
                        <li>
                            When you search for a loan in KivaLens, it searches the loans that it has in
                            memory, it does not use Kiva or KivaLen's servers to perform the search.
                            This is why KivaLens searches are so fast.
                        </li>
                    </ul>
                </Row>
            </Grid>
    }
})

export default Live