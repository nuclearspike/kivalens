import React from 'react'
import Reflux from 'reflux'
import {Grid,Col,Row,Modal,Alert,Button} from 'react-bootstrap'
import {NewTabLink,KivaLink} from '.'
import a from '../actions'
import s from '../stores/'

const SetAutoLendModal = React.createClass({
    mixins: [Reflux.ListenerMixin],
    getInitialState() {
        return {show: false, ids: [], setAutoLendPartners: false}
    },
    componentDidMount() {
        this.listenTo(a.utils.modal.setAutoLend, this.show)
    },
    shouldComponentUpdate(np, {show}){
        return show || this.state.show
    },
    show(){
        var ids = kivaloans.filterPartners(s.criteria.syncGetLast())
        var activePartners = kivaloans.partners_from_kiva.where(p => p.status == "active")
        var partners = activePartners.where(p => ids.contains(p.id))
        ids = partners.select(p => p.id).orderBy(e=>e)
        var badPartnerSelection = ((activePartners.length - ids.length < 10) || (ids.length == 0))
        KLAFeatureCheck(['setAutoLendPartners']).done(state => this.setState($.extend(state,{ids,badPartnerSelection, show: true})))
    },
    close(){
        this.setState({show: false})
        this.forceUpdate() //needed?
    },
    success(){
        chrome.runtime.sendMessage(KLA_Extension, {setAutoLendPartners: this.state.ids}, reply => {this.close()})
    },
    render() {
        let {show, ids, setAutoLendPartners,badPartnerSelection} = this.state
        return (
            <Modal show={show} onHide={this.close}>
                <Modal.Header closeButton>
                    <Modal.Title>Sync Auto-Lend Partner Options on Kiva</Modal.Title>
                </Modal.Header>

                <Modal.Body>
                    <If condition={!setAutoLendPartners}>
                        <Alert bsStyle="danger">
                            You either aren't using Chrome, haven't installed the Kiva Lender Assistant Extension, or the extension hasn't been updated to support the needed functionality.
                        </Alert>
                    </If>
                    <If condition={badPartnerSelection}>
                        <Alert bsStyle="warning">
                            Your selection of partners {ids.length == 0? "has no results": "is very broad"}.
                        </Alert>
                    </If>
                    <p>
                        By continuing, KivaLens will instruct the <NewTabLink href="https://chrome.google.com/webstore/detail/kiva-lender-assistant-bet/jkljjpdljndblihlcoenjbmdakaomhgo?hl=en-US" title="Go to Google Chrome WebStore">
                        Kiva Lender Assistant Chrome Extension</NewTabLink> to:
                    </p>
                    <ul>
                        <li>Open a new tab to your Kiva Auto-Lending settings, which may require you to log in.</li>
                        <li>Check to make sure Auto-Lending is turned on, and if it isn't then abort.<br/>
                            <KivaLink path="settings/credit">Turn on Auto-Lending</KivaLink> if
                            you haven't already.</li>
                        <li>Deselect all selected partners.</li>
                        <li>Select the {ids.length} partners that match the current criteria.</li>
                        <li>Save your new settings.</li>
                    </ul>
                </Modal.Body>

                <Modal.Footer>
                    <Button bsStyle="primary" onClick={this.success} disabled={!setAutoLendPartners || !ids.length}>Set Auto-Lending Options on Kiva</Button><Button
                    onClick={this.close}>Cancel</Button>
                </Modal.Footer>
            </Modal>
        );
    }
})

export default SetAutoLendModal