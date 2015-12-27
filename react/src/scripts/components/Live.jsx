'use strict'
import React from 'react'
import Reflux from 'reflux'
import LinkedStateMixin from 'react-addons-linked-state-mixin'

import {Grid,Col,Row,Panel} from 'react-bootstrap'
import {KivaLink} from '.'
import a from '../actions'
import numeral from 'numeral'
import {Motion, spring} from 'react-motion'
import LocalStorageMixin from 'react-localstorage'

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

//watches for state change on what is defined by the selector/field, it triggers the function (given as string) after delay
const DelayStateTriggerMixin = function(stateSelector, onTrigger, delayTime = 200) {
    //invent a new handle name.
    var handleName = 'DelayTriggerChangedHandle' + Math.random().toString()
    var stateSelectorFunc = typeof stateSelector == 'string' ? state=>state[stateSelector] : stateSelector

    return {
        componentDidUpdate(prevProps, prevState){
            if (JSON.stringify(stateSelectorFunc(prevState)) != JSON.stringify(stateSelectorFunc(this.state))) {
                clearTimeout(this[handleName])
                this[handleName] = setTimeout(eval(`this.${onTrigger}`)(), delayTime)
            }
            return true //this is not in the docs, but not having a return true doesn't update the page? bad assumption?
        },
        componentWillUnmount(){clearTimeout(this[handleName])}
    }
}

const Live = React.createClass({
    mixins: [Reflux.ListenerMixin, LinkedStateMixin, LocalStorageMixin],
        //DelayStateTriggerMixin('maxMinutes','recalcTop', 1000),
        //DelayStateTriggerMixin(s=>s.running_totals.funded_amount,'recalcTop',1000)],
    getInitialState() {
        return {running_totals: kivaloans.running_totals, maxMinutes: 30, top_lending_countries: [], top_sectors: [], top_countries: []}
    },
    getStateFilterKeys() {return ['maxMinutes']},
    componentDidMount() {
        this.listenTo(a.loans.live.statsChanged, this.newRunningTotals)
        this.recalcTop()
        this.topInterval = setInterval(this.recalcTop, 1000)
    },
    //shouldComponentUpdate(){
    //    return true
    //},
    newRunningTotals(rt){
        this.setState({running_totals: rt, force: Math.random().toString()})
        this.forceUpdate()
    },
    recalcTop(){
        var c = channels["loan.purchased"]
        var x_mins_ago = parseInt(this.state.maxMinutes).minutes().ago()

        //get recent message payloads
        var messages = c.data.where(d=>d.received.isAfter(x_mins_ago)).select(d => d.data.p)

        //top lending countries
        var top_lending_countries = messages.where(p => p.lender.public)
            .select(p => ({country: p.lender.lenderPage.whereabouts.split(',').last().trim() || "(Undisclosed)", loan_count: p.loans.length}))
            .groupBySelectWithSum(c=>c.country, c=>c.loan_count).orderBy(g=>g.sum, basicReverseOrder).take(10)

        //generic splattening of the payloads to get the loan objects
        var loans_during = messages.select(p=>p.loans).flatten()

        var top_sectors = loans_during.groupBySelectWithCount(l=>l.sector.name).orderBy(g=>g.count, basicReverseOrder).take(10)
        var top_countries = loans_during.groupBySelectWithCount(l=>l.location.country.name).orderBy(g=>g.count, basicReverseOrder).take(10)

        if (top_lending_countries.sum(g=>g.sum) >= 20)
            this.setState({top_lending_countries: top_lending_countries, top_sectors: top_sectors, top_countries: top_countries})

    },
    componentWillUnmount(){
        clearInterval(this.topInterval)
    },
    render() {
        let {new_loans, funded_loans, funded_amount} = this.state.running_totals
        return <Grid>
                <Row>
                    <h1>Kiva Lending</h1>
                    <b>Beta</b>
                    <p>To keep data up-to-the-second fresh, KivaLens subscribes to the same live data-stream
                        that <KivaLink path='live?v=1'>Kiva /Live</KivaLink> uses and adds new loans and updates existing
                        loans accordingly. Since starting your current KivaLens session, the following activity has occurred
                        on Kiva.org.</p>
                </Row>
                <Row>
                    <Col md={3}>
                        <dl className="dl-horizontal" style={{fontSize: 'large'}}>
                            <dt>New Loans</dt><dd><AnimInt value={new_loans}/></dd>
                            <dt>Fully Funded</dt><dd><AnimInt value={funded_loans}/></dd>
                            <dt>Lending Total</dt><dd>$<AnimInt value={funded_amount}/></dd>
                        </dl>
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
                <Row>
                    <h2>How Does KivaLens Stay Fresh{'?'}</h2>
                    <ul>
                        <li>
                            When you first start a new KivaLens session (or click your browser's "Reload" button), your
                            browser downloads the entire KivaLens app and after that doesn't talk to the KivaLens
                            server again. As you click between KivaLens pages, it's super fast because the entire
                            app was pre-loaded in your browser.
                        </li>
                        <li>
                            Once the app has loaded, KivaLens pulls it's listing of Loans from Kiva's API and
                            keeps all of the loan and partner data in your browser's memory.
                        </li>
                        <li>
                            With all of the activity on Kiva, the data that KivaLens pulled quickly becomes stale. To
                            keep it fresh, KivaLens listens to Kiva's live data-stream of both lending activity
                            and newly posted loans and updates it's own listing automatically. Each time you do a
                            search, it's searching the most recent data.
                        </li>
                        <li>
                            Every time you click on a loan, KivaLens will get the newest version of it, just in case
                            anything has changed. For example, there is no data-stream notice for other lenders
                            adding the loan to their basket.
                        </li>
                        <li>
                            Every time you visit the Basket page, KivaLens will make sure all of the loans in your
                            basket have the most recent funded/basket amounts.
                        </li>
                        <li>
                            Once every 10 minutes, KivaLens silently performs a resync of it's data to catch any changes
                            not included in the datastream notifications.
                        </li>
                        <li>
                            When you search for a loan in KivaLens, it searches the loans that it has in
                            memory, it does not use Kiva or KivaLen's servers  to perform the search.
                            This is why KivaLens searches are so fast.
                        </li>
                    </ul>
                </Row>
            </Grid>
    }
})

export default Live