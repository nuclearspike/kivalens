import React from 'react'
import Reflux from 'reflux'
import {Grid,Col,Row,Modal,Button,Tabs,Tab} from 'react-bootstrap'
import {KivaLink} from '.'
import a from '../actions'
import s from '../stores/'

const PartnerDisplayModal = React.createClass({
    mixins: [Reflux.ListenerMixin],
    getInitialState() {return {show: false, ids:[], names:[], partners:[]} },
    componentDidMount() {
        this.listenTo(a.utils.modal.partnerDisplay, this.show)
    },
    shouldComponentUpdate(np,{show}){return show},
    show(){
        this.setState({show: true})
        var ids = kivaloans.filterPartners(s.criteria.syncGetLast())
        var partners = kivaloans.partners_from_kiva.where(p => ids.contains(p.id))
        var names = partners.select(p => `"${p.name}"`)
        this.setState({ids,partners,names})
    },
    close(){
        this.setState({show: false})
        this.forceUpdate()
    },
    success(){
        a.utils.modal.partnerDisplay.completed()
        this.close()
    },
    render() {
        var sta = {width: '100%', height: '300px'}
        let {ids, names, partners} = this.state
        return (
            <Modal show={this.state.show} onHide={this.close}>
                <Modal.Header closeButton>
                    Export Partners
                </Modal.Header>

                <Modal.Body>

                    <Tabs defaultActiveKey={1}>
                        <Tab eventKey={1} title="For Auto-lending">
                            <ul>
                                <li>Open <KivaLink path="settings/credit">Auto-Lending Settings</KivaLink> on Kiva.</li>
                                <li>Make sure that "Automatically lend my Kiva Credit" is checked to expose the options.</li>
                                <li>In the "Partners" area, click the "edit" link so that the huge listing of all active Partners displays.</li>
                                <li>In Chrome or Firefox, right click the page and select "Inspect/Inspect Element" and click on the "Console" tab.</li>
                                <li>Paste in the following code and press "Enter". This will select the partners listed, it will not unselect partners that do not match, you can unselect all of those first using the links on Kiva.</li>
                            </ul>
                            <textarea style={sta} value={"["+ ids.join(',') + "].forEach(id=>$(`input[value=${id}]`)[0].checked=true)"}/>
                        </Tab>
                        <Tab eventKey={2} title="IDs">
                            IDs of matching partners, separated by ','
                            <textarea style={sta} value={ids.join(',')}/>
                        </Tab>
                        <Tab eventKey={3} title="Names">
                            Names of matching partners, quoted, separated by ','
                            <textarea style={sta} value={names.join(',')}/>
                        </Tab>
                        <Tab eventKey={4} title="JSON">
                            As JSON (JavaScript Object Notation)
                            <textarea style={sta} value={JSON.stringify(partners,2)}/>
                        </Tab>

                    </Tabs>
                </Modal.Body>

                <Modal.Footer>
                    <Button bsStyle="primary" onClick={this.success}>Close</Button>
                </Modal.Footer>
            </Modal>
        );
    }
})

export default PartnerDisplayModal