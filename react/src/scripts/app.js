'use strict'
//KIVA LENS
if (window.location.hostname != 'localhost')
    process.env.NODE_ENV = 'production'

require('linqjs')
require('datejs')
require('numeral')
require('./utils')
require('./linqextras')
require('./stores/liveStore')
require('./api/syncStorage')

const airbrakeJs = require('airbrake-js');
const airbrake = new airbrakeJs({projectId: 127019, projectKey: 'de861f4b53489fbf4ee86054b57a6a90'});
window.airbrake = airbrake;
airbrake.addFilter(notice => {
    notice.context.lender_id = kivaloans.lender_id
    return notice;
});

window.addEventListener("error", airbrake.onerror);

import React from 'react'
import Reflux from 'reflux'
import ReactDOM from 'react-dom'
import Router from 'react-router'
import {Route, Redirect, IndexRoute} from 'react-router'
import {Grid,Jumbotron} from 'react-bootstrap'

import createHistory from 'history/lib/createHashHistory'
var history = createHistory({queryKey: false})

import {KLNav, KLFooter, Search, Loan, Basket, Options, About, Details, Schedule,
    Criteria, ClearBasket, Live, Teams, NotFound, PromptModal, AlertModal, SnowStack,
    Outdated, OnNow, Donate} from "./components"
import ga from 'react-ga';
import a from './actions'
import s from './stores'

//window.Perf = require('react-addons-perf')

window.rga = ga //react google analytics, ga is already defined
//if you want to change the page title, you will also need to change the GA rule or you'll lose all data after the change.

global.rga.event({category: 'timer', action: 'loadToStart', value: Math.round((Date.now() - window.pageStarted) / 1000)})

const App = React.createClass({
    mixins: [Reflux.ListenerMixin],
    getInitialState(){ return { } },
    componentDidMount(){
        ga.initialize('UA-10202885-1')
        this.listenTo(a.loans.live.new, this.newLoansTest)
        if (!this.props.children)
            history.push('/search')
    },
    newLoansTest(loans){
        if (kla_features.notify) {
            var SS = loans.select(l => s.criteria.syncGetMatchingCriteria(l,true)).flatten().distinct()
            if (SS.length) {
                callKLAFeature('notify', "The following saved searches have new loans: " + SS.join(', ') )
                if (kla_features.speak) {
                    callKLAFeature('speak', "New loans have just posted that match a saved search of yours.")
                }
            }
        }
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
        this.logPageChange()
        return <div>
                <KLNav/>
                    <PromptModal/>
                    <AlertModal/>
                    {this.props.children}
                <KLFooter/>
            </div>
    }
})

/**
import GraphiQL from 'graphiql';
import fetch from 'isomorphic-fetch';

const GraphIQL = ()=>{
    function graphQLFetcher(graphQLParams) {
        console.log("graphQLParams:", graphQLParams)
        return fetch(window.location.origin + '/graphql', {
            method: 'post',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(graphQLParams),
        }).then(response => response.json());
    }
    return <GraphiQL fetcher={graphQLFetcher} />;
    <Route path="/graphiql" component={GraphIQL}/>
}**/

function LoadReactApp(){
    if (window.isBootstrapLoaded && document.getElementById("react-app")){
        ReactDOM.render((<Router onUpdate={() => window.scrollTo(0, 0)} history={history}>
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
                <Route path="on" component={OnNow}/>
                <Route path="donate" component={Donate}/>
                <Route path="teams" component={Teams}/>
                <Route path="clear-basket" component={ClearBasket}/>
                <Route path="outdated" component={Outdated}/>
                <Redirect from="*" to="/search"/>
                <Redirect from="" to="/search"/>
            </Route>
        </Router>), document.getElementById("react-app"))
    } else {
        //if it didn't load, it may be because the CSS wasn't ready yet.
        window.bootstrapLoadedCallback = LoadReactApp
    }
}

domready.done(LoadReactApp)

/**
 {(this.props.children)? this.props.children: <Grid><Jumbotron><h1>Preparing to dazzle you...</h1></Jumbotron></Grid>}
 **/