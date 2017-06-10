'use strict'

import React from 'react'
import Reflux from 'reflux'
import {Link} from 'react-router'
import {Navbar, Nav, NavItem, Badge} from 'react-bootstrap'
import s from '../stores/'
import a from '../actions'

const KLNav = React.createClass({
    mixins: [Reflux.ListenerMixin],
    getInitialState() { return { basket_count: 0 } },
    componentDidMount(){
        this.listenTo(a.loans.basket.changed, this.basketChange)
        this.basketChange()
    },
    shouldComponentUpdate(p,{basket_count}){
        return (basket_count != this.state.basket_count)
    },
    basketChange(){
        this.setState({basket_count: s.loans.syncBasketCount()})
    },
    render() {
        return (
            <Navbar inverse fluid staticTop>
                <Navbar.Brand><Link to="/search">KivaLens</Link></Navbar.Brand>
                <Navbar.Toggle />
                <Navbar.Collapse>
                    <Nav navbar>
                        <NavItem key={1} href="#/search">Search</NavItem>
                        <NavItem key={2} href="#/basket">Basket<Badge>{this.state.basket_count}</Badge></NavItem>
                        <NavItem key={3} href="#/live">Live</NavItem>
                        <NavItem key={4} href="#/teams">Teams</NavItem>
                        <NavItem key={5} href="#/options">Options</NavItem>
                        <NavItem key={7} href="#/about">About</NavItem>
                    </Nav>
                </Navbar.Collapse>
            </Navbar>
        );
    }
})

export default KLNav

// <NavItem key={6} href="#/donate">Donate</NavItem>
