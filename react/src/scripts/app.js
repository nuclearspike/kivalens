'use strict'

if (window.location.hostname != 'localhost'){
    process.env.NODE_ENV = 'production';
}

require('linqjs')
require('datejs')
require('numeral')
require('./utils')
import React from 'react'
import ReactDOM from 'react-dom'
import Router from 'react-router'
import {Route, Redirect, IndexRoute} from 'react-router'
import {KLNav, KLFooter, Search, Loan, Basket, Options, About, Details, Schedule, Criteria, ClearBasket, NotFound, PromptModal} from "./components";
import KivaAPI from './api/kiva'
import ga from 'react-ga';
import a from './actions'

window.rga = ga //react google analytics, ga is already defined

//if you want to change the page title, you will also need to change the GA rule or you'll lose all data after the change.

KivaAPI.setAPIOptions({app_id: 'org.kiva.kivalens', max_concurrent: 8})

const App = React.createClass({
    getInitialState(){ return { } },
    componentDidMount(){
        ga.initialize('UA-10202885-1');
        //this only happens during startup of the app. don't allow #/ but
        if (location.href.indexOf('#/?') > -1) location.replace(`http://${location.host}${location.pathname}#/search`)
        if (location.hostname != 'localhost' && location.pathname != "/react/") location.pathname = "/react/" //corrects for kivalens_org/react
    },
    logPageChange(){
        var r_page = window.location.hash.replace('#','')
        if (r_page.indexOf("?") > -1)
            r_page = r_page.substr(0, r_page.indexOf('?'));
        if (r_page != this.last_ga_page) {
            cl("ga:pageview", r_page)
            ga.pageview(r_page)
            this.last_ga_page = r_page
        }
    },
    render(){
        this.logPageChange()
        return <div>
                <KLNav/>
                    <PromptModal/>
                    {this.props.children}
                <KLFooter/>
            </div>
    }
})

//When Page read, mount it.
document.addEventListener("DOMContentLoaded", function(event) {
    $.ajaxSetup({ cache: false });

    if (document.getElementById("react-app")){
        ReactDOM.render((<Router>
            <Route component={App} path="/">
                <Route path="search" component={Search}>
                    <Route path="loan/:id" component={Loan}/>
                    <IndexRoute component={Criteria}/>
                </Route>
                <Route path="basket" component={Basket}/>
                <Route path="options" component={Options}/>
                <Route path="about" component={About}/>
                <Route path="clear-basket" component={ClearBasket}/>
                <Redirect from="*" to="search"/>
                <Redirect from="/" to="search"/>
            </Route>
        </Router>), document.getElementById("react-app"))
    }
});