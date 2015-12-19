import React from 'react'
import Reflux from 'reflux'
import {Grid,Col,Row} from 'react-bootstrap'
import {KivaLink} from '.'
import a from '../actions'
import numeral from 'numeral'

const Live = React.createClass({
    mixins: [Reflux.ListenerMixin],
    getInitialState() {
        return {running_totals: kivaloans.running_totals}
    },
    componentDidMount() {
        this.listenTo(a.loans.live.change, rt => this.setState({running_totals: rt}) )
    },
    render() {
        let {new_loans, funded_loans, funded_amount} = this.state.running_totals
        return <Grid>
                <h1>Updates to Kiva - Beta</h1>
                <p>To keep data as fresh as possible, KivaLens subscribes to the same live data-stream
                    that <KivaLink path='live?v=1'>Kiva /Live</KivaLink> uses and adds new loans and updates existing
                    loans accordingly. Since starting the current KivaLens session, the following activity has occurred
                    on Kiva.org. </p>
                <dl className="dl-horizontal" style={{fontSize: 'large'}}>
                    <dt>New Loans</dt><dd>{new_loans}</dd>
                    <dt>Fully Funded</dt><dd>{funded_loans}</dd>
                    <dt>Lending Total</dt><dd>${numeral(funded_amount).format('0,0')}</dd>
                </dl>
            </Grid>
    }
})

export default Live