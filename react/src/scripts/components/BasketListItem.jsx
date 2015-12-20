'use strict'

import React from 'react'
import {ListGroupItem} from 'react-bootstrap'
import {KivaImage} from '.'
import a from '../actions'

const BasketListItem = React.createClass({
    getInitialState() {return { }},
    render() {
        var loan = this.props.loan;
        return (
            <ListGroupItem
                className={'loan_list_item'}
                key={loan.id}
                onClick={a.loans.basket.select.bind(null, loan.id)}
                href={`#/basket`}>
                <KivaImage className="float_left" type="square" loan={loan} image_width={113} height={90} width={90}/>
                <div className="details">
                    <p><b>{loan.name}</b></p>
                    {loan.location.country} | {loan.sector} <span className="hidden-md">| {loan.activity}</span>
                    <p className="hidden-md">{loan.use}</p>
                </div>
            </ListGroupItem>
        )
    }
})

export default BasketListItem;