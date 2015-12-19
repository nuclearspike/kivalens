import React from 'react'
import Reflux from 'reflux'
import {Grid,Col,Row} from 'react-bootstrap'
import {KivaLink} from '.'
import a from '../actions'

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
                <h1>Updates to Kiva</h1>
                <p>Since KivaLens has loaded, the following activity has occurred on Kiva.org. To keep data
                    as fresh as possible, KivaLens subscribes to the same live data-stream
                    that <KivaLink path='live?v=1'>Kiva/Live</KivaLink> uses.</p>
                <dl className="dl-horizontal">
                    <dt>New Loans</dt><dd>{new_loans}</dd>
                    <dt>Funded Loans</dt><dd>{funded_loans}</dd>
                    <dt>Funded Total</dt><dd>${funded_amount}</dd>
                </dl>
            </Grid>
    }
})

export default Live