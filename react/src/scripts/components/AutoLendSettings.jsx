import React from 'react'
import Reflux from 'reflux'
import {Grid,Col,Row,Input,Alert,Button} from 'react-bootstrap'
import {NewTabLink,KivaLink} from '.'
import a from '../actions'
import s from '../stores/'
import detect from 'detect-mobile-browser'
import {defaultKivaData} from '../api/kiva'

const AutoLendSettings = React.createClass({
    mixins: [Reflux.ListenerMixin],
    getInitialState() {
        return {cycle: 0, pids: [], probs:[], sectors:[], countries:[], sector_count: 0, country_count: 0, partner_count: 0, setAutoLendPCS: true, KLAversion: 'none'}
    },
    componentDidMount() {
        this.listenTo(a.criteria.change, this.receiveCriteria)
        this.receiveCriteria(s.criteria.syncGetLast())
        KLAFeatureCheck(['setAutoLendPCS','getVersion']).done(state => {
            this.setState(state)
            if (state.getVersion) {
                chrome.runtime.sendMessage(KLA_Extension, {getVersion: true}, reply => this.setState({KLAversion:reply.version}))
            }
        })
        var sector_count = defaultKivaData.sectors.length
        var country_count = defaultKivaData.countries.length
        var mobileCheck = mobileAndTabletCheck()
        this.setState({sector_count, country_count, mobileCheck})
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
        window.rga.event({category: 'autolend', action: 'pushToKiva'})
        //can only get here if they have chrome
        chrome.runtime.sendMessage(KLA_Extension, {setAutoLendPCS}, reply => console.log(reply))
    },
    render() {
        let {cycle,pids,sectors,countries,setAutoLendPCS,sector_count,country_count,partner_count,mobileCheck} = this.state

        var probs = []
        if (typeof chrome == 'undefined')
            probs.push(<li key="1">You are not using Google Chrome Browser. <NewTabLink href="https://www.google.com/chrome/browser/">Download Chrome</NewTabLink>. In order for KivaLens to automate the process of setting your options on Kiva, it requires using a browser extension which is written for Chrome.</li>)
        else if (!setAutoLendPCS)
            probs.push(<li key="2">You do not have Kiva Lender Assistant (for Chrome) installed. <NewTabLink href="https://chrome.google.com/webstore/detail/kiva-lender-assistant-bet/jkljjpdljndblihlcoenjbmdakaomhgo?hl=en-US">Install Extension</NewTabLink>.</li>)

        if (mobileCheck) //can't even get to this component currently if mobile.
            probs.push(<li key="3">You are on a mobile device or tablet. Chrome only supports extensions on their desktop/laptop versions of their browser.</li>)
        if (pids.length == partner_count && sectors.length == sector_count && countries.length == country_count)
            probs.push(<li key="4">Your criteria is so broad that there's nothing to set. Try looking at the Portfolio Balancing options on the "Your Portfolio" tab.</li>)

        return (
            <div className="ample-padding-top">
                <h4>Push your Auto-Lending preferences to Kiva</h4>
                <If condition={probs.length}>
                    <Alert bsStyle="danger">
                        There are problems preventing you from continuing:
                        <ul>
                            {probs.map(prob => prob)}
                        </ul>
                    </Alert>
                </If>
                <p>
                    Kiva has had <KivaLink path="settings/credit">Auto-Lending</KivaLink> tucked away on
                    it's site for years. Use this tab to automatically set your preferences for Sectors,
                    Countries and Partners on Kiva so you can take advantage of KivaLens' portfolio balancing and
                    many additional options for selecting partners that are not included in the Auto-Lend settings.
                </p>
                <p>
                    As your portfolio changes and as stats on partners shift over time, you'll want to come back
                    and perform this function again on a regular basis to keep your settings on Kiva up-to-date,
                    it is not automatic. KivaLens only uses the criteria options that impact
                    Sectors, Country, or Partner filtering from the currently criteria. It is recommended that you
                    create a "Saved Search" just for your Auto-Lending preferences so you can easily return
                    to your selections whenever you want.
                </p>
                <p>
                    Before using this KivaLens feature, make sure <KivaLink path="settings/credit">Auto-Lending</KivaLink> is enabled on Kiva.
                </p>
                <p>
                    By continuing, KivaLens will instruct the <NewTabLink href="https://chrome.google.com/webstore/detail/kiva-lender-assistant-bet/jkljjpdljndblihlcoenjbmdakaomhgo?hl=en-US" title="Go to Google Chrome WebStore">
                    Kiva Lender Assistant Chrome Extension</NewTabLink> to:
                </p>
                <ul>
                    <li>Open a new tab to your Kiva Auto-Lending settings, which may require you to log in.</li>
                    <li>Check to make sure Auto-Lending is turned on, and if it isn't then abort.</li>
                    <li><Input key={cycle} type="checkbox" ref="partners" defaultChecked={pids.length != partner_count} label={<span>Set the <b>{pids.length}/{partner_count} partners</b> that match the current criteria.</span>}/></li>
                    <li><Input key={cycle} type="checkbox" ref="sectors"  defaultChecked={sectors.length != sector_count} label={<span>Set the <b>{sectors.length}/{sector_count} sectors</b> that match the current criteria.</span>}/></li>
                    <li><Input key={cycle} type="checkbox" ref="countries" defaultChecked={countries.length != country_count} label={<span>Set the <b>{countries.length}/{country_count} countries</b> that match the current criteria.</span>}/></li>
                    <li>Save your new settings.</li>
                </ul>

                <Button bsStyle="primary" onClick={this.success} disabled={probs.length > 0}>Set Auto-Lending Options on Kiva</Button>
            </div>
        )
    }
})

export default AutoLendSettings