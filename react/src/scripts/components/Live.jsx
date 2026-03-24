'use strict'
import React from 'react'
import Reflux from 'reflux'

import {Grid,Col,Row,Panel,Alert} from 'react-bootstrap'
import numeral from 'numeral'
import {Motion, spring} from 'react-motion'

//move this out and import once used elsewhere.
const AnimInt = React.createClass({
    getInitialState(){ return {oldVal: this.props.value, newVal: this.props.value} },
    componentWillReceiveProps({value}) {
      this.setState({oldVal: this.state.newVal, newVal: value})
    },
    render(){
        let {oldVal, newVal} = this.state
        return (
          <Motion defaultStyle={{x: oldVal}} style={{x: spring(newVal)}}>
              {value => <span>{numeral(Math.round(value.x)).format('0,0')}</span>}
          </Motion>
        )
    }
})

const Live = React.createClass({
    mixins: [Reflux.ListenerMixin],
    getInitialState() {
        return {
            running_totals: kivaloans.running_totals,
            funded_sum: 0, still_needed: 0, basket_amount: 0, fundraising_amount: 0, avg_percent_funded: 0
        }
    },
    componentDidMount() {
        this.recalc()
        this.recalcInterval = setInterval(this.recalc, 10000)
    },
    recalc(){
        var fundraising_loans = kivaloans.loans_from_kiva.where(l=>l.status=='fundraising')
        var funded_sum    = fundraising_loans.sum(l=>l.funded_amount)
        var still_needed  = fundraising_loans.sum(l=>l.kl_still_needed)
        var basket_amount = fundraising_loans.sum(l=>l.basket_amount)
        var fundraising_amount = fundraising_loans.sum(l=>l.loan_amount)
        var avg_percent_funded = 0
        if (fundraising_loans.length)
            avg_percent_funded = fundraising_loans.sum(l=>l.kl_percent_funded) / fundraising_loans.length
        this.setState({funded_sum, still_needed, basket_amount, fundraising_amount, avg_percent_funded,
            running_totals: kivaloans.running_totals})
    },
    componentWillUnmount(){
        clearInterval(this.recalcInterval)
    },
    shouldComponentUpdate(p,state){
        return JSON.stringify(state) != JSON.stringify(this.state)
    },
    render() {
        let {new_loans, funded_loans, funded_amount, expired_loans} = this.state.running_totals
        let {funded_sum, still_needed, basket_amount, fundraising_amount, avg_percent_funded} = this.state
        return <Grid>
                <Row>
                    <h1>Kiva Lending</h1>
                    <p>
                        The stats below are based on data from KivaLens's periodic syncs with Kiva's API.
                    </p>
                </Row>
                <Row>
                    <Col md={4}>
                        <h3>Since session start</h3>
                        <dl className="dl-horizontal" style={{fontSize: 'large'}}>
                            <dt>New Loans</dt><dd><AnimInt value={new_loans}/></dd>
                            <dt>Fully Funded</dt><dd><AnimInt value={funded_loans}/></dd>
                            <dt>Expired</dt><dd><AnimInt value={expired_loans}/></dd>
                            <dt>Lending Total</dt><dd>$<AnimInt value={funded_amount}/></dd>
                        </dl>
                    </Col>
                    <Col md={4}>
                        <h3>Fundraising Loans</h3>
                        <dl className="dl-horizontal" style={{fontSize: 'large'}}>
                            <dt>Fundraising</dt><dd>$<AnimInt value={fundraising_amount}/></dd>
                            <dt>Funded Amount</dt><dd>$<AnimInt value={funded_sum}/></dd>
                            <dt>In Baskets</dt><dd>$<AnimInt value={basket_amount}/></dd>
                            <dt>Still Needed</dt><dd>$<AnimInt value={still_needed}/></dd>
                            <dt>Average Funded</dt><dd><AnimInt value={avg_percent_funded}/>%</dd>
                        </dl>
                    </Col>
                </Row>
            </Grid>
    }
})

export default Live
