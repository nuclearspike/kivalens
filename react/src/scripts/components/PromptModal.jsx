'use strict'
import React from 'react'
import Reflux from 'reflux'
import LinkedStateMixin from 'react-addons-linked-state-mixin'
import {Modal, Button, Input} from 'react-bootstrap'
import a from '../actions'

const PromptModal = React.createClass({
    mixins: [Reflux.ListenerMixin, LinkedStateMixin],
    getInitialState() {return {show: false} },
    shouldComponentUpdate(){return false},
    componentDidMount() {
        this.listenTo(a.utils.prompt, this.showPrompt)
    },
    showPrompt(options){ //options of "title" and "label"
        this.callback = options.callback
        this.setState($.extend({}, options, {callback: null, show: true, return_value: ''}))
        this.forceUpdate()
    },
    close(){
        this.setState({ show: false })
        this.forceUpdate()
    },
    success(){
        this.callback(this.state.return_value)
        this.close()
    },
    render() {
        return (
            <div className="static-modal">
                <Modal show={this.state.show} onHide={this.close}>
                    <If condition={this.state.title}>
                        <Modal.Header closeButton>
                            <Modal.Title>{this.state.title}</Modal.Title>
                        </Modal.Header>
                    </If>

                    <Modal.Body style={{height: '80px'}}>
                        <Input type='text' autoFocus label={this.state.label}
                            labelClassName='col-md-2' ref="return_value"
                            wrapperClassName='col-md-10' valueLink={this.linkState('return_value')}  />
                    </Modal.Body>

                    <Modal.Footer>
                        <Button bsStyle="primary" onClick={this.success}>Ok</Button><Button onClick={this.close}>Cancel</Button>
                    </Modal.Footer>
                </Modal>
            </div>
        )
    }
})

export default PromptModal