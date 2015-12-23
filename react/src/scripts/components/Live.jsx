'use strict'
import React from 'react'
import Reflux from 'reflux'
import {Grid,Col,Row} from 'react-bootstrap'
import {KivaLink} from '.'
import a from '../actions'
import numeral from 'numeral'
import {Motion, spring} from 'react-motion'
import {setWatchedPot} from '../stores/liveStore'

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

const Live = React.createClass({
    mixins: [Reflux.ListenerMixin],
    getInitialState() {
        return {running_totals: kivaloans.running_totals, top_lending_countries: [], top_sectors: [], top_countries: []}
    },
    componentDidMount() {
        setWatchedPot(true)
        this.listenTo(a.loans.live.statsChanged, rt => this.setState({running_totals: rt}))
        this.recalcTop()
        this.topInterval = setInterval(this.recalcTop, 5000)
    },
    recalcTop(){
        var c = channels["loan.purchased"]
        //longest linq query in the app!
        var thirty_mins_ago = (30).minutes().ago()

        //get recent message payloads
        var messages = c.data.where(d=>d.received.isAfter(thirty_mins_ago)).select(d => d.data.p)

        //top lending countries
        var top_lending_countries = messages.where(p => p.lender.public)
            .select(p => ({country: p.lender.lenderPage.whereabouts.split(',').last().trim() || "(Undisclosed)", loan_count: p.loans.length}))
            .groupBySelectWithSum(c=>c.country, c=>c.loan_count).orderBy(g=>g.sum).reverse().take(10)

        //generic splattening of the payloads to get the loan objects
        var loans_during = messages.select(p=>p.loans).flatten()

        var top_sectors = loans_during.groupBySelectWithCount(l=>l.sector.name).orderBy(g=>g.count).reverse().take(10)
        var top_countries = loans_during.groupBySelectWithCount(l=>l.location.country.name).orderBy(g=>g.count).reverse().take(10)

        if (top_lending_countries.sum(g=>g.sum) >= 20)
            this.setState({top_lending_countries: top_lending_countries, top_sectors: top_sectors, top_countries: top_countries})

    },
    componentWillUnmount(){
        setWatchedPot(false)
        clearInterval(this.topInterval)
    },
    render() {
        let {new_loans, funded_loans, funded_amount} = this.state.running_totals
        return <Grid>
                <h1>Kiva Lending</h1>
                <b>Beta</b>
                <p>To keep data up-to-the-second fresh, KivaLens subscribes to the same live data-stream
                    that <KivaLink path='live?v=1'>Kiva /Live</KivaLink> uses and adds new loans and updates existing
                    loans accordingly. Since starting your current KivaLens session, the following activity has occurred
                    on Kiva.org.</p>
                <Col md={3}>
                    <dl className="dl-horizontal" style={{fontSize: 'large'}}>
                        <dt>New Loans</dt><dd><AnimInt value={new_loans}/></dd>
                        <dt>Fully Funded</dt><dd><AnimInt value={funded_loans}/></dd>
                        <dt>Lending Total</dt><dd>$<AnimInt value={funded_amount}/></dd>
                    </dl>
                </Col>
                <Col md={3}>
                    <b>Top Lending Countries</b>
                    <p>(Up to last 30 minutes)</p>
                    <ul>
                        <For each='ranked' index='i' of={this.state.top_lending_countries}>
                            <li key={i}>{ranked.sum}: {ranked.name}</li>
                        </For>
                    </ul>
                </Col>
                <Col md={3}>
                    <b>Top Sectors</b>
                    <p>(Up to last 30 minutes)</p>
                    <ul>
                        <For each='ranked' index='i' of={this.state.top_sectors}>
                            <li key={i}>{ranked.count}: {ranked.name}</li>
                        </For>
                    </ul>
                </Col>
                <Col md={3}>
                    <b>Top Countries</b>
                    <p>(Up to last 30 minutes)</p>
                    <ul>
                        <For each='ranked' index='i' of={this.state.top_countries}>
                            <li key={i}>{ranked.count}: {ranked.name}</li>
                        </For>
                    </ul>
                </Col>
            </Grid>
    }
})

export default Live