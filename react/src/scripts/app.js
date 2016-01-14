'use strict'
//KIVA LENS
if (window.location.hostname != 'localhost')
    process.env.NODE_ENV = 'production'

require('linqjs')
require('datejs')
require('numeral')
require('./utils')
require('./stores/liveStore')
require('./api/syncStorage')

import Q from 'q'
import React from 'react'
import ReactDOM from 'react-dom'
import Router from 'react-router'
import {Route, Redirect, IndexRoute} from 'react-router'
import createHistory from 'history/lib/createHashHistory'

import {KLNav, KLFooter, Search, Loan, Basket, Options, About, Details, Schedule, Criteria, ClearBasket, Live, NotFound, PromptModal, AlertModal, SnowStack, SetAutoLendModal} from "./components"
import ga from 'react-ga';
import a from './actions'

window.Q = Q
//window.Perf = require('react-addons-perf')

window.rga = ga //react google analytics, ga is already defined

//if you want to change the page title, you will also need to change the GA rule or you'll lose all data after the change.



const App = React.createClass({
    getInitialState(){ return { } },
    componentDidMount(){
        ga.initialize('UA-10202885-1')
        //this only happens during startup of the app. don't allow #/ but
        //if (location.hostname != 'localhost' && location.pathname != "/react/") location.pathname = "/react/" //corrects for kivalens_org/react
    },
    logPageChange(){
        var r_page = this.props.location.pathname
        if (r_page != this.last_ga_page) {
            cl("ga:pageview", r_page)
            ga.pageview(r_page)
            this.last_ga_page = r_page
        }
    },
    render(){
        //do not render a blank page.
        if (!this.props.children) location.replace(`http://${location.host}${location.pathname}#/search`)
        this.logPageChange()
        return <div>
                <KLNav/>
                    <PromptModal/>
                    <AlertModal/>
                    <SetAutoLendModal/>
                    {this.props.children}
                <KLFooter/>
            </div>
    }
})

var history = createHistory({queryKey: false})

$(function() {
    if (document.getElementById("react-app")){
        ReactDOM.render((<Router history={history}>
            <Route path="/portfolio" component={SnowStack}/>
            <Route path="/" component={App} >
                <Route path="search" component={Search}>
                    <Route path="loan/:id" component={Loan}/>
                    <IndexRoute component={Criteria}/>
                </Route>
                <Route path="basket" component={Basket}/>
                <Route path="options" component={Options}/>
                <Route path="about" component={About}/>
                <Route path="live" component={Live}/>
                <Route path="clear-basket" component={ClearBasket}/>
                <Redirect from="*" to="/search"/>
                <Redirect from="" to="/search"/>
            </Route>
        </Router>), document.getElementById("react-app"))
    }
})