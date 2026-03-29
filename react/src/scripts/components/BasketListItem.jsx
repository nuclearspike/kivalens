'use strict'

import React from 'react'
import {ListGroupItem} from 'react-bootstrap'
import {KivaImage} from '.'
import a from '../actions'
import lendAmountOptions from '../lendAmountOptions'

const BasketListItem = React.createClass({
    getInitialState() {return { }},
    onAmountChange(e) {
        e.stopPropagation()
        a.loans.basket.setAmount(this.props.loan.id, parseInt(e.target.value))
    },
    render() {
        let {loan, amount} = this.props
        var options = lendAmountOptions(loan.kl_still_needed)
        // If current amount isn't in options (e.g. max changed), insert it so the select shows the real value
        if (options.length && !options.contains(amount))
            options = [amount].concat(options).orderBy(x => x)
        return <ListGroupItem
                className={'loan_list_item'}
                key={loan.id}
                href={`#/basket`}
                onClick={a.loans.basket.select.bind(null, loan.id)}>
                <KivaImage className="float_left" type="square" loan={loan} image_width={113} height={90} width={90}/>
                <div className="details">
                    <div className="loan-name">{loan.name}</div>
                    <div className="loan-meta">
                        <span className="loan-tag">{loan.location.country}</span>
                        <span className="loan-tag">{loan.sector}</span>
                        <span className="loan-tag hidden-md">{loan.activity}</span>
                    </div>
                    {options.length > 0
                        ? <select
                            value={amount}
                            onChange={this.onAmountChange}
                            className="basket-amount-select"
                            style={{padding: '2px 4px', fontSize: 13, borderRadius: 4, border: '1px solid #ccc', cursor: 'pointer'}}>
                            {options.map(o => <option key={o} value={o}>${o}</option>)}
                          </select>
                        : <span style={{fontSize: 11, color: '#c0392b', fontWeight: 600}}>Fully funded — will be removed on checkout</span>
                    }
                </div>
            </ListGroupItem>
    }
})

export default BasketListItem;
