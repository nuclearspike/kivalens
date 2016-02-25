'use strict'
import React from 'react'
import Reflux from 'reflux'
import {Modal,Panel,ProgressBar} from 'react-bootstrap'
import {DidYouKnow} from '.'
import a from '../actions'

//this really shouldn't be receiving notice of whether to show from outside. it knows
const LoadingLoansPanel = React.createClass({
    mixins: [Reflux.ListenerMixin],
    getInitialState(){
        return {progress_label: 'Please Wait...', title: 'Loading Fundraising Loans from Kiva.org', show: !kivaloans.isReady(), error_message: ''}
    },
    shouldComponentUpdate(np, ns) { //does this actually help anything?
        return (this.state.show != ns.show)
    },
    componentDidMount() {
        this.hasSentGAView = false

        this.listenTo(a.loans.load.progressed, progress => {
            if (this.state.failed) return
            var new_state = {show: true}
            if (progress.done) new_state[`${progress.task}_progress`] = progress.singlePass ? (progress.done * 100) / progress.total : (progress.done * 100) / progress.total * (progress.task == 'ids'? .33 : .67)
            if (progress.label) new_state.progress_label = progress.label
            if (progress.title) new_state.title = progress.title
            if (progress.complete) new_state.show = false
            this.setState(new_state)
            this.forceUpdate()
        })
        this.listenTo(a.loans.load.completed, ()=>{
            this.setState({show: false}) //should() handles the update
        })
        this.listenTo(a.loans.load.failed, status => {
            this.setState({failed: true, progress_label: 'Download Failed! Error Message from Kiva:', error_message: status })
            this.forceUpdate()
        })
    },
    render() {
        let {ids_progress, details_progress, show, title, progress_label, error_message} = this.state
        if (show && !this.hasSentGAView) {
            this.hasSentGAView = true
            window.rga.modalview('/loading')
        }
        return (<If condition={show}>
            <Panel className="not-rounded-top">
                    <Modal.Header>
                        <Modal.Title>{title}</Modal.Title>
                    </Modal.Header>

                    <Modal.Body>
                        <ProgressBar>
                            <ProgressBar bsStyle="info" active={ids_progress < 32} label={ids_progress > 10 ? 'basics': ''} now={ids_progress} />
                            <ProgressBar active label={details_progress > 10 ? 'details': ''} now={details_progress} />
                        </ProgressBar>
                        <DidYouKnow/>
                    </Modal.Body>

                    <Modal.Footer>
                        {progress_label}<br/>
                        {error_message}
                    </Modal.Footer>
                </Panel>
            <Else/>
                <span/>
            </If>)
    }
})

export default LoadingLoansPanel