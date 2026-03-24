'use strict'

import React from 'react'
import Reflux from 'reflux'
import {Link} from 'react-router'
import {Navbar, Nav, NavItem, Badge} from 'react-bootstrap'
import s from '../stores/'
import a from '../actions'

const KLNav = React.createClass({
    mixins: [Reflux.ListenerMixin],
    getInitialState() {
        return { basket_count: 0, activePath: location.hash.replace('#','') || '/search', hasLenderId: !!lsj.get('Options').kiva_lender_id }
    },
    componentDidMount(){
        this.listenTo(a.loans.basket.changed, this.basketChange)
        this.basketChange()
        window.addEventListener('hashchange', this.onHashChange)
        window.addEventListener('storage', this.checkLenderId)
    },
    componentWillUnmount(){
        window.removeEventListener('hashchange', this.onHashChange)
        window.removeEventListener('storage', this.checkLenderId)
    },
    checkLenderId(){
        this.setState({hasLenderId: !!lsj.get('Options').kiva_lender_id})
    },
    onHashChange(){
        this.setState({activePath: location.hash.replace('#','') || '/search'})
    },
    shouldComponentUpdate(p, nextState){
        return (nextState.basket_count != this.state.basket_count
             || nextState.activePath != this.state.activePath
             || nextState.hasLenderId != this.state.hasLenderId)
    },
    basketChange(){
        this.setState({basket_count: s.loans.syncBasketCount()})
    },
    render() {
        var active = this.state.activePath
        var isActive = path => active.indexOf(path) === 0
        return (
            <Navbar inverse fluid staticTop>
                <Navbar.Brand><Link to="/search">KivaLens</Link></Navbar.Brand>
                <Navbar.Toggle />
                <Navbar.Collapse>
                    <Nav navbar>
                        <NavItem key={1} href="#/search" className={isActive('/search') ? 'active' : ''}>Search</NavItem>
                        <NavItem key={2} href="#/basket" className={isActive('/basket') ? 'active' : ''}>Basket <Badge>{this.state.basket_count}</Badge></NavItem>
                        {location.hostname === 'localhost' ? <NavItem key={8} href="#/partners" className={isActive('/partners') ? 'active' : ''}>Partners</NavItem> : null}
                        <NavItem key={3} href="#/live" className={isActive('/live') ? 'active' : ''}>Stats</NavItem>
                        {this.state.hasLenderId ? <NavItem key={9} href="#/portfolio" className={isActive('/portfolio') ? 'active' : ''}>Wall</NavItem> : null}
                        <NavItem key={4} href="#/teams" className={isActive('/teams') ? 'active' : ''}>Teams</NavItem>
                        <NavItem key={10} href="#/saved" className={isActive('/saved') ? 'active' : ''}>Saved</NavItem>
                        <NavItem key={5} href="#/options" className={isActive('/options') ? 'active' : ''}>Options</NavItem>
                        <NavItem key={7} href="#/about" className={isActive('/about') ? 'active' : ''}>About</NavItem>
                    </Nav>
                </Navbar.Collapse>
            </Navbar>
        );
    }
})

export default KLNav
