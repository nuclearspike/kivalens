'use strict'

import React from 'react'
import {Grid,Row,Col,Modal,Input,Button,Alert} from 'react-bootstrap'
import {KivaLink} from '.'
import LinkedStateMixin from 'react-addons-linked-state-mixin'
import {req} from '../api/kiva'
import s from '../stores/'

var lenderIdTester = new RegExp(/^[a-z0-9]{0,24}$/i) //technically 3,24 but i don't want to start out with an error and alternatives weren't worth it.

const SetLenderIDModal = React.createClass({
    mixins: [LinkedStateMixin],
    getInitialState() { return {show: this.props.show, checking: false, failed: false} },
    componentWillReceiveProps({show}){
        this.setState({show})
    },
    componentWillUpdate(p,{kiva_lender_id}){
        if (kiva_lender_id != this.state.kiva_lender_id)
            this.setState({failed: false, badRegEx: !lenderIdTester.test(kiva_lender_id)})
    },
    setLenderID(){
        var lid = this.state.kiva_lender_id //linked state mixin sets this.
        if (!lid) return
        lid = lid.trim()

        this.setState({checking: true, failed: false})

        req.kiva.api.lender(lid)
            .always(x=>this.setState({checking: false}))
            .fail(x=>this.setState({failed: true}))
            .done(lender => {
                s.utils.lenderObj = lender
                kivaloans.setLender(lender.lender_id) //lowercase version.
                this.props.onSet(lender.lender_id)
                this.onHide()
            })
    },
    onHide(){
        this.setState({show: false})
        if (this.props.onHide) this.props.onHide()
    },
    render() {
        let {show, checking, failed, badRegEx} = this.state
        return (<Modal show={show} onHide={this.onHide}>
                    <Modal.Header closeButton>
                        <Modal.Title>Set Kiva Lender ID</Modal.Title>
                    </Modal.Header>
            
                    <Modal.Body>
                        <Row>
                            <Col md={12}>
                                <Input
                                    autoFocus
                                    type='text'
                                    label='Kiva Lender ID'
                                    labelClassName='col-lg-4'
                                    wrapperClassName='col-lg-8'
                                    valueLink={this.linkState('kiva_lender_id')} />
                                    Your Kiva Lender ID is not your email address.&nbsp;
                                <KivaLink path="myLenderId">Click here if you don't know yours.</KivaLink>
                                <If condition={checking}>
                                    <Alert>Checking with Kiva...</Alert>
                                </If>
                                <If condition={failed || badRegEx}>
                                    <Alert bsStyle="danger">Invalid Lender ID {badRegEx? ': Only letters and numbers up to 24 characters allowed.': ''}</Alert>
                                </If>
                            </Col>
                        </Row>
                    </Modal.Body>

                    <Modal.Footer>
                        <Button onClick={this.setLenderID} disabled={badRegEx} bsStyle='primary'>Set Lender ID</Button> <Button onClick={this.onHide}>Cancel</Button>
                    </Modal.Footer>
                </Modal>)
    }
})

export default SetLenderIDModal