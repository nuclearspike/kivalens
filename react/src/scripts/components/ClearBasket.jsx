import React from 'react';
import a from '../actions'
import s from '../stores'

//should this allow the user to choose to clear the basket?
const ClearBasket = React.createClass({
    componentDidMount() {
        window.rga.event({category: 'basket', action: 'basket:clear-from-return-url', value: s.loans.syncBasketCount()})
        a.loans.basket.clear()
        location.replace(`http://${location.host}${location.pathname}#/search`)
    },
    render() {return <div></div>}
})

export default ClearBasket