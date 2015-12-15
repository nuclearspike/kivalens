'use strict'

import React from 'react'
import {Grid,Row,Col,Modal,Input,Button,Alert} from 'react-bootstrap'
import {KivaLink} from '.'
import LinkedStateMixin from 'react-addons-linked-state-mixin'
import {Request} from '../api/kiva'

const SetLenderIDModal = React.createClass({
    mixins: [LinkedStateMixin],
    getInitialState() { return {show: this.props.show, checking: false, failed: false} },
    componentDidMount() { },
    componentWillReceiveProps(props){
        this.setState({show: props.show})
    },
    setLenderID(){
        var lid = this.state.kiva_lender_id
        if (!lid) return

        this.setState({checking: true, failed: false})
        Request.get(`lenders/${lid}.json`)
            .fail(xhr => this.setState({failed: true}))
            .done(()=>{
                kivaloans.setLender(lid)
                if (this.props.onSet) this.props.onSet(lid)
                this.onHide()
            })
            .always(()=>{this.setState({checking: false})})
    },
    onHide(){
        this.setState({show: false})
        if (this.props.onHide) this.props.onHide()
    },
    render() {
        let {show, checking, failed} = this.state
        return (<Modal show={show} onHide={()=>this.onHide(null)}>
                    <Modal.Header>
                        <Modal.Title>Set Kiva Lender ID</Modal.Title>
                    </Modal.Header>

                    <Modal.Body>
                        <Row>
                            <Col md={12}>
                                <Input
                                    type='text'
                                    label='Kiva Lender ID'
                                    labelClassName='col-lg-4'
                                    wrapperClassName='col-lg-8'
                                    valueLink={this.linkState('kiva_lender_id')} />
                                    Your Kiva Lender ID is not your email address.&nbsp;
                                <KivaLink secure path="myLenderId">Click here if you don't know yours</KivaLink>
                                <If condition={checking}>
                                    <Alert>Checking with Kiva</Alert>
                                </If>
                                <If condition={failed}>
                                    <Alert bsStyle="danger">Invalid Lender ID</Alert>
                                </If>
                            </Col>
                        </Row>
                    </Modal.Body>

                    <Modal.Footer>
                        <Button onClick={this.setLenderID} bsStyle='primary'>Set Lender ID</Button> <Button onClick={this.onHide}>Cancel</Button>
                    </Modal.Footer>
                </Modal>)
    }
})

export default SetLenderIDModal