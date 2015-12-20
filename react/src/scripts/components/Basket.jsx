'use strict';

import React from 'react'
import Reflux from 'reflux'
import {Grid,Row,Col,Input,ButtonGroup,Button,Modal,ProgressBar,Panel,Alert} from 'react-bootstrap';
import {BasketListItem,Loan} from '.';
import a from '../actions'
import s from '../stores'
import InfiniteList from 'react-infinite-list'

const Basket = React.createClass({
    mixins: [Reflux.ListenerMixin],
    getInitialState() {
        return $.extend(true, this.generateState(), {showGoodbye: false, refreshing: false})
    },
    componentDidMount(){
        this.listenTo(a.loans.load.completed,()=>{ this.setState(this.generateState()) })
        this.listenTo(a.loans.basket.changed,()=>{ this.setState(this.generateState()) })
        this.listenTo(a.loans.basket.select, id => this.setState({selected_item_id: id}))
        if (kivaloans.isReady()) this.refresh()
    },
    generateState(){
        var basket_items = s.loans.syncGetBasket()
        return {
            basket_count: basket_items.length,
            basket_items: basket_items,
            loans: basket_items.select(bi => bi.loan),
            amount_sum: basket_items.sum(bi => bi.amount),
            raw_basket_count: s.loans.syncBasketCount()
        }
    },
    makeBasket(){
        return JSON.stringify(this.state.basket_items.select(bi => {return {"id": bi.loan.id, "amount": bi.amount}}))
    },
    remove(e) {
        e.preventDefault()
        a.loans.basket.remove(this.state.selected_item_id)
        this.setState({selected_item_id: null})
    },
    clear(e){
        e.preventDefault()
        a.loans.basket.clear()
        this.setState({selected_item_id: null})
    },
    transferToKiva(){
        if (this.state.basket_count > 0) {
            this.setState({showGoodbye: true})

            if (['xs','sm','md'].contains(findBootstrapEnv())) {
                this.refs.basket_form.submit()
            } else {
                //there's currently a bug on kiva with expired sessions throwing a 404 when adding to basket.
                // opening a tiny window to kiva starts the session and seems to prevent the 404's from happening.
                // if kiva fixes the bug, this can just be a submit without a little window and timeout
                var w = window.open('http://www.kiva.org/about', "kiva", "width=200, height=100, top=200, left=200")
                setTimeout(()=> {
                    this.refs.basket_form.submit()
                    w.close()
                }, 2500)
            }
            window.rga.event({category: 'basket', action: 'basket:transfer', value: this.state.amount_sum})

            window.rga.modalview('/baskettransfer');

            //GA STATS. track high-level usage information, nothing identifies the user
            window.ga('require', 'ecommerce');
            var d = new Date()
            var transaction = d.getTime().toString()
            window.ga('ecommerce:addTransaction', {
                'id': transaction,                     // Transaction ID. Required.
                'affiliation': 'Kiva Lens',            // Affiliation or store name.
                'revenue': this.state.amount_sum.toString(), // Grand Total.
                'shipping': '',              // Shipping.
                'tax': ''                    // Tax.
            });
            this.state.basket_items.forEach(bi => {
                window.ga('ecommerce:addItem', {
                    'id': transaction,                // Transaction ID. Required.
                    'name': bi.loan.location.country, // Product name. Required.
                    'sku': bi.loan.activity,          // SKU/code.
                    'category': bi.loan.sector,       // Category or variation.
                    'price': bi.amount.toString(),    // Unit price.
                    'quantity': '1'                   // Quantity.
                })
            })
            window.ga('ecommerce:send')
        }
    },
    refresh(){
        this.setState({refreshing: true})
        s.loans.syncRefreshBasket().always(()=> this.setState({refreshing: false}))
    },
    render() {
        let {basket_count,selected_item_id,amount_sum,basket_items,refreshing,showGoodbye} = this.state
        return (
            <div style={{height:'100%', width: '100%'}}>
                <Col md={4}>
                    <ButtonGroup justified>
                        <Button href="#" key={1} disabled={basket_count == 0} onClick={this.clear}>Empty Basket</Button>
                        <Button href="#" key={3} disabled={!selected_item_id} onClick={this.remove}>Remove Selected</Button>
                    </ButtonGroup>
                    <InfiniteList
                        className="loan_list_container"
                        items={basket_items}
                        height={600}
                        itemHeight={100}
                        listItemClass={BasketListItem} />
                </Col>
                <Col md={8}>
                    <Panel>
                        <h1>Basket: {basket_count} loans ${amount_sum}</h1>
                        <form method="POST" ref='basket_form' action="http://www.kiva.org/basket/set">
                            <p>Note: Checking out will replace your current basket on Kiva.</p>
                            <input name="callback_url" value={`${location.protocol}//${location.host}${location.pathname}#clear-basket`} type="hidden" />
                            <input name="loans" value={this.makeBasket()} type="hidden" />
                            <input name="donation" value="0.00" type="hidden" />
                            <input name="app_id" value="org.kiva.kivalens" type="hidden" />
                        </form>
                        <Button bsStyle='primary' disabled={basket_count == 0} onClick={this.transferToKiva}>Checkout at Kiva</Button>
                    </Panel>
                    <If condition={refreshing}>
                        <Alert bsStyle="info">
                            Loans in your basket are being refreshed to get the latest funded and basket amounts from Kiva.
                        </Alert>
                    </If>
                    <If condition={selected_item_id}>
                        <Loan params={{id: selected_item_id}}/>
                    </If>
                </Col>
                <div className="static-modal">
                    <Modal show={showGoodbye} onHide={()=>{}}>
                        <Modal.Header>
                            <Modal.Title>Transferring Basket to Kiva</Modal.Title>
                        </Modal.Header>

                        <Modal.Body>
                            <p>
                                Depending upon the number of loans in your basket, transferring your selection to Kiva
                                could take some time... Please wait. If you receive a 404 error on Kiva, come back to
                                KivaLens and try the transfer again (your basket will still be here).
                                Kiva currently has a bug.
                            </p>
                        </Modal.Body>

                        <Modal.Footer>
                            <ProgressBar active now={100} />
                        </Modal.Footer>
                    </Modal>
                </div>
            </div>
        );
    }
})

export default Basket