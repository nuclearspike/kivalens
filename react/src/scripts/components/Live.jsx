import React from 'react'
import Reflux from 'reflux'
import {Grid,Col,Row} from 'react-bootstrap'
import {KivaLink} from '.'
import a from '../actions'
import numeral from 'numeral'
import {Motion, spring} from 'react-motion'

//move this out and import once used elsewhere.
const AnimInt = React.createClass({
    getInitialState(){ return {oldVal: this.props.value, newVal: this.props.value} },
    componentWillReceiveProps(newProps){this.setState({oldVal: this.state.newVal, newVal: newProps.value})},
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
        return {running_totals: kivaloans.running_totals}
    },
    componentDidMount() {
        this.listenTo(a.loans.live.change, rt => this.setState({running_totals: rt}))
    },
    render() {
        let {new_loans, funded_loans, funded_amount} = this.state.running_totals
        return <Grid>
                <h1>Updates to Kiva</h1>
                <p>To keep data up-to-the-second fresh, KivaLens subscribes to the same live data-stream
                    that <KivaLink path='live?v=1'>Kiva /Live</KivaLink> uses and adds new loans and updates existing
                    loans accordingly. Since starting your current KivaLens session, the following activity has occurred
                    on Kiva.org. </p>
                <dl className="dl-horizontal" style={{fontSize: 'large'}}>
                    <dt>New Loans</dt><dd><AnimInt value={new_loans}/></dd>
                    <dt>Fully Funded</dt><dd><AnimInt value={funded_loans}/></dd>
                    <dt>Lending Total</dt><dd>$<AnimInt value={funded_amount}/></dd>
                </dl>
            </Grid>
    }
})

export default Live