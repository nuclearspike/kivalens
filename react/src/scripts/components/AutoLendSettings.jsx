import React from 'react'
import Reflux from 'reflux'
import {Grid,Col,Row,Input,Alert,Button} from 'react-bootstrap'
import {NewTabLink,KivaLink} from '.'
import a from '../actions'
import s from '../stores/'
import {defaultKivaData} from '../api/kiva'

const AutoLendSettings = React.createClass({
    mixins: [Reflux.ListenerMixin],
    getInitialState() {
        return {cycle: 0, pids: [], sectors:[], countries:[], sector_count: 0, country_count: 0, partner_count: 0, setAutoLendPartners: false}
    },
    componentDidMount() {
        this.listenTo(a.criteria.change, this.receiveCriteria)
        this.receiveCriteria(s.criteria.syncGetLast()) //pointless on mount?
        KLAFeatureCheck(['setAutoLendPCS']).done(state => this.setState(state))
        var sector_count = defaultKivaData.sectors.length
        var country_count = defaultKivaData.countries.length
        this.setState({sector_count, country_count})
    },
    receiveCriteria(crit){
        if (!kivaloans.isReady()) return
        console.time("AutoLendSettings.receiveCriteria")
        var pids = kivaloans.getListOfPartners(crit)
        var sectors = kivaloans.getListOfSectors(crit)
        var countries = kivaloans.getListOfCountries(crit)
        var partner_count = kivaloans.active_partners.length
        var cycle = this.state.cycle + 1
        this.setState({pids,sectors,countries,partner_count,cycle})
        console.timeEnd("AutoLendSettings.receiveCriteria")
    },
    success(){
        if (!(this.refs.partners.getChecked() || this.refs.countries.getChecked() || this.refs.sectors.getChecked())) {
            a.utils.modal.alert({title:"Cannot Continue", message: "Please have at least one box checked to continue."})
            return
        }
        let {pids: partners, countries, sectors} = this.state
        if (!this.refs.partners.getChecked()) partners = []
        if (!this.refs.countries.getChecked()) countries = []
        if (!this.refs.sectors.getChecked()) sectors = []
        var setAutoLendPCS = {partners, countries, sectors}
        chrome.runtime.sendMessage(KLA_Extension, {setAutoLendPCS}, reply => console.log(reply))
    },
    render() {
        let {cycle,pids,sectors,countries,setAutoLendPCS,sector_count,country_count,partner_count} = this.state
        return (
            <div className="ample-padding-top">
                <h4>Alpha Testing... Double-check it's actions. Report any problems.</h4>
                <If condition={!setAutoLendPCS}>
                    <Alert bsStyle="danger">
                        You either aren't using Chrome, haven't installed the Kiva Lender Assistant Extension,
                        or the extension hasn't been updated to support the needed functionality.
                    </Alert>
                </If>
                <p>
                    Kiva has had <KivaLink path="settings/credit">Auto-Lending</KivaLink> tucked away on
                    it's site for years. Use this tab to automatically set your preferences for Sectors,
                    Countries and Partners on Kiva so you can take advantage of the portfolio balancing and
                    many additional options for selecting partners that are not included in the Auto-Lend settings.
                    As your portfolio changes and as stats on partners shift over time, you'll want to come back
                    and perform this function again on a regular basis to keep Kiva up-to-date,
                    it is not automatic. KivaLens only uses the criteria options that impact
                    Sectors, Country, or Partner filtering from the currently criteria. It is recommended that you
                    create a "Saved Search" just for your Auto-Lending preferences so you can easily return
                    to your selections whenever you want. If nothing happens when you click the button, make sure
                    your extension is up to date (it needs to be v1.0.5, released Jan 11).
                </p>
                <p>
                    To use this KivaLens feature, make sure Auto-Lending is enabled on Kiva or it will fail.
                </p>
                <p>
                    By continuing, KivaLens will instruct the <NewTabLink href="https://chrome.google.com/webstore/detail/kiva-lender-assistant-bet/jkljjpdljndblihlcoenjbmdakaomhgo?hl=en-US" title="Go to Google Chrome WebStore">
                    Kiva Lender Assistant Chrome Extension</NewTabLink> to:
                </p>
                <ul>
                    <li>Open a new tab to your Kiva Auto-Lending settings, which may require you to log in.</li>
                    <li>Check to make sure Auto-Lending is turned on, and if it isn't then abort.</li>
                    <li><Input key={cycle} type="checkbox" ref="partners" defaultChecked={pids.length != partner_count} label={<span>Set the <b>{pids.length}/{partner_count} partners</b> that match the current criteria.</span>}/></li>
                    <li><Input key={cycle} type="checkbox" ref="sectors" defaultChecked={sectors.length != sector_count} label={<span>Set the <b>{sectors.length}/{sector_count} sectors</b> that match the current criteria.</span>}/></li>
                    <li><Input key={cycle} type="checkbox" ref="countries" defaultChecked={countries.length != country_count} label={<span>Set the <b>{countries.length}/{country_count} countries</b> that match the current criteria.</span>}/></li>
                    <li>Save your new settings.</li>
                </ul>

                <Button bsStyle="primary" onClick={this.success} disabled={!setAutoLendPCS}>Set Auto-Lending Options on Kiva</Button>
            </div>
        )
    }
})

export default AutoLendSettings