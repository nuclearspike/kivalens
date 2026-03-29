'use strict'

import React from 'react'
import Reflux from 'reflux'
import {ListGroupItem} from 'react-bootstrap'
import {KivaImage} from '.'
import cx from 'classnames'
import a from '../actions'
import s from '../stores/'
import extend from 'extend'
import lendAmountOptions from '../lendAmountOptions'

const LoanListItem = React.createClass({
    mixins: [Reflux.ListenerMixin],
    getInitialState() {
        return extend(this.isInBasket(),{justLoaded:true,selected:s.loans.selected_id == this.props.id})
    },
    componentDidMount() {
        setTimeout(function(){
            this.setState({justLoaded:false})
        }.bind(this),50)

        this.listenTo(a.loans.selection, this.testSelection)
        this.listenTo(a.loans.basket.changed, this.basketChanged)
        this.listenTo(a.loans.live.loanNotFundraising, loan => {if (loan.id == this.props.id) this.loanUpdated(loan)})
        this.loanUpdated(this.props)
    },
    testSelection(id){
        var selected = this.props.id == id
        if (selected != this.state.selected)
            this.setState({selected})
    },
    basketChanged(){
        var st = this.isInBasket()
        if (st.inBasket != this.state.inBasket)
            this.setState(st)
    },
    isInBasket(){
        return { inBasket: s.loans.syncInBasket(this.props.id) }
    },
    loanUpdated(loan){
        if (loan.status != 'fundraising')
            this.setState({loanNotFundraising: true})
    },
    addToBasket(){
        var loan = this.props
        var options = lendAmountOptions(loan.kl_still_needed)
        var defaultAmount = lsj.get('Options').default_lend_amount || 25
        var amount = (options.filter(o => o <= defaultAmount).pop()) || options[0] || 25
        a.loans.basket.add(loan.id, amount)
    },
    render() {
        var loan = this.props
        let {selected} = this.state
        return <ListGroupItem
                onDoubleClick={this.addToBasket}
                className={cx('loan_list_item', {selected, gone: this.state.justLoaded, in_basket: this.state.inBasket, funded: this.state.loanNotFundraising})}
                key={loan.id}
                href={`#/search/loan/${loan.id}`}>
                <KivaImage key={loan.id} type="square" loan={loan} image_width={113} height={90} width={90}/>
                <div className="details">
                    <div className="loan-name">{loan.name}</div>
                    <div className="loan-meta">
                        <span className="loan-tag">{loan.location.country}</span>
                        <span className="loan-tag">{loan.sector}</span>
                        <span className="loan-tag hidden-md">{loan.activity}</span>
                    </div>
                    <div className="loan-use hidden-md">{loan.use}</div>
                </div>
            </ListGroupItem>
    }
})

export default LoanListItem