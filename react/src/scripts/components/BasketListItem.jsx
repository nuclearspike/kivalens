'use strict'

import React from 'react'
import {ListGroupItem} from 'react-bootstrap'
import {KivaImage} from '.'
import a from '../actions'

const BasketListItem = React.createClass({
    getInitialState() {return { }},
    render() {
        let {loan} = this.props
        return <ListGroupItem
                className={'loan_list_item'}
                key={loan.id}
                onClick={a.loans.basket.select.bind(null, loan.id)}
                href={`#/basket`}>
                <KivaImage className="float_left" type="square" loan={loan} image_width={113} height={90} width={90}/>
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

export default BasketListItem;