'use strict'

import React from 'react'
import Reflux from 'reflux'
import {Modal,Button} from 'react-bootstrap'
import LinkedStateMixin from 'react-addons-linked-state-mixin'
import a from '../actions'
import s from '../stores/'

const BulkAddModal = React.createClass({
    mixins: [LinkedStateMixin],
    getInitialState() { return {show: true, maxBasket: 1000, maxPerLoan: 25} },
    componentDidMount() {
        window.rga.modalview('/bulkadd');
        this.loans = s.loans.syncFilterLoansLast()
        var newState = {}
        newState.basket_space = 10000 - s.loans.syncGetBasket().sum(bi => bi.amount)
        if (this.state.maxBasket > newState.basket_space) newState.maxBasket = newState.basket_space
        this.setState(newState)
    },
    close(){
        this.setState({ show: false });
        a.loans.basket.changed()
        window.rga.event({category: 'bulk_add', action: 'bulk_add:close'})
        if (this.props.onHide) this.props.onHide()
    },
    doIt(){
        var amount_remaining = Math.min(this.state.maxBasket, this.state.basket_space)
        var to_add = []
        this.loans.some(loan => {
            //if already in basket, stop.
            if (s.loans.syncInBasket(loan.id)) return false
            //how much to lend for current loan
            var to_lend = Math.min(loan.loan_amount - loan.funded_amount - loan.basket_amount, amount_remaining, this.state.maxPerLoan)
            //add it.
            if (to_lend > 0) {
                amount_remaining -= to_lend
                to_add.push({loan_id: loan.id, amount: to_lend})
            }
            return amount_remaining < 25 //return true == quit
        })
        window.rga.event({category: 'bulk_add', action: 'bulk_add:add', value: to_add.length})
        a.loans.basket.batchAdd(to_add)
        this.close()
    },
    render() {
        return (
            <div className="static-modal">
                <Modal show={this.state.show} onHide={this.close}>
                    <Modal.Header closeButton>
                        <Modal.Title>Bulk Add</Modal.Title>
                    </Modal.Header>

                    <Modal.Body>
                        <p>Mega-Lender Tool: Use this to automatically add many loans at once. Using the current sort and
                            criteria, it will start at the top of the list and for any loan that is not currently in
                            your basket, it will apply the rules below. Kiva has a maximum basket amount of $10,000.</p>

                        Max to lend ${this.state.maxBasket}
                        <input type="range" min="25" max={this.state.basket_space} step="25" valueLink={this.linkState('maxBasket')}/>
                        <br/>
                        Max per loan ${this.state.maxPerLoan}
                        <input type="range" min="25" max="250" step="25" valueLink={this.linkState('maxPerLoan')} />

                    </Modal.Body>

                    <Modal.Footer>
                        <Button bsStyle="primary" onClick={this.doIt}>Add a bunch!</Button><Button onClick={this.close}>Close</Button>
                    </Modal.Footer>
                </Modal>
            </div>
        );
    }
})

export default BulkAddModal