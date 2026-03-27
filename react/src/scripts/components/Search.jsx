'use strict'

import React from 'react'
import ReactDOM from 'react-dom'
import Reflux from 'reflux'
import {Notification} from 'react-notification'
import {Grid,Row,Col,Input,ButtonGroup,Button,Alert} from 'react-bootstrap'
import {LoanListItem, LoadingLoansPanel, BulkAddModal, CriteriaTabs} from '.'
import a from '../actions'
import cx from 'classnames'
import s from '../stores'
import numeral from 'numeral'
import InfiniteList from './InfiniteList.jsx'


var Search = React.createClass({
    mixins: [Reflux.ListenerMixin],
    getInitialState(){
        var filtered_loans = s.loans.syncFilterLoansLast()
        if (filtered_loans.length == 0)
            filtered_loans = s.loans.syncFilterLoans()
        var show_secondary_load = (kivaloans.secondary_load == 'started')
        return {
            filtered_loans,
            show_secondary_load,
            loan_count: filtered_loans.length,
            notification: {active: false, message: ''},
            showCriteria: true
        }
    },
    componentWillReceiveProps({location}){
        // no longer used for float toggling
    },
    componentDidMount() {
        this.listenTo(a.loans.filter.completed, (loans, sameAsLastTime) => {
            cl('a.loans.filter.completed', loans.length, sameAsLastTime)
            this.setState({notification: {active: true, message: `${loans.length} loans`}})
            var newState = {filtered_loans: loans, loan_count: loans.length}
            if (loans.length)
                newState.hasHadLoans = true
            this.setState(newState)

            if (!this.fetchingExtra) {
                this.fetchingExtra = true
                var toFillOut = loans.where(l=>!l.kl_repayments || !l.description.texts.en).take(40)
                if (toFillOut.length)
                    kivaloans.fetchDescrAndRepayments(toFillOut).always(x=>this.fetchingExtra = false)
                else
                    this.fetchingExtra = false
            }
        })
        this.listenTo(a.loans.load.completed, loans => a.loans.filter())
        this.listenTo(a.loans.load.secondaryLoad, this.secondaryLoad)
        this.listenTo(a.loans.load.secondaryStatus, this.secondaryStatus)
        this.listenTo(a.loans.load.backgroundResyncState, this.backgroundResyncState)
        a.utils.var.get('outdatedUrl', outdatedUrl => {
            if (outdatedUrl) {
                this.setState({outdatedUrl})
                window.rga.event({category: 'outdatedLink', action: 'redirect', label: outdatedUrl})
                a.utils.var.set('outdatedUrl', null)
            }
        })
    },
    backgroundResyncState(backgroundResyncState){
        this.setState({backgroundResyncState})
    },
    secondaryStatus(status){
        this.setState({secondary_load_status: status})
    },
    secondaryLoad(status){
        if (status == 'started')
            this.setState({show_secondary_load: true})
        if (status == 'complete')
            this.setState({show_secondary_load: false})
    },
    toggleCriteria(e){
        e.preventDefault()
        this.setState({showCriteria: !this.state.showCriteria})
    },
    resetCriteria(e){
        e.preventDefault()
        a.criteria.startFresh()
    },
    bulkAdd(e){
        e.preventDefault()
        this.setState({showBulkAdd: true})
    },
    modalHidden(){
        this.setState({showBulkAdd: false})
    },
    handleOutdatedUrlAlertDismiss(){
        this.setState({outdatedUrl: null})
    },
    render()  {
        let {outdatedUrl, showBulkAdd, notification, show_secondary_load, backgroundResyncState, secondary_load_status, hasHadLoans, loan_count, showCriteria} = this.state
        // Determine if we're viewing a loan (Loan component, not Criteria)
        var hasLoanDetail = this.props.location.pathname !== '/search'

        // Column widths depend on what's visible
        var critCol = showCriteria ? 3 : 0
        var listCol = showCriteria ? (hasLoanDetail ? 3 : 4) : (hasLoanDetail ? 4 : 12)
        var detailCol = hasLoanDetail ? (showCriteria ? 6 : 8) : (showCriteria ? 9 : 0)

        return (
            <div>
                <Notification dismissAfter={5000} isActive={notification.active} message={notification.message}
                              action={''}/>
                {showBulkAdd ? <BulkAddModal onHide={this.modalHidden}/> : null}
                {outdatedUrl ? <Alert className="not-rounded" style={{marginTop: '-20px'}} bsStyle="warning"
                           onDismiss={this.handleOutdatedUrlAlertDismiss} dismissAfter={60000}>
                        <p>
                            The link or bookmark you used is outdated. Please bookmark this page.
                        </p>
                    </Alert> : null}

                {showCriteria ? <Col md={critCol} style={{paddingRight: 5, overflowY: 'auto', maxHeight: 'calc(100vh - 60px)'}}>
                    <CriteriaTabs />
                </Col> : null}

                <Col md={listCol}>
                    <ButtonGroup justified className="top-only" style={{marginBottom: 0}}>
                        <Button href="#" key={4} onClick={this.toggleCriteria}>
                            {showCriteria ? 'Hide Criteria' : 'Show Criteria'}
                        </Button>
                        <Button href="#" key={3} onClick={this.resetCriteria}>Reset</Button>
                        <Button href="#" key={1} onClick={this.bulkAdd}>Bulk Add</Button>
                    </ButtonGroup>
                    {show_secondary_load ? <Alert className="not-rounded" style={{marginBottom: '0px'}} bsStyle="warning">
                            More loans are still loading. Carry on. {secondary_load_status}
                        </Alert> : null}
                    {backgroundResyncState == 'started' ? <Alert className="not-rounded" style={{marginBottom: '0px'}}>
                            Continue using the site while the loans are refreshed...
                        </Alert> : null}
                    {loan_count > 0 ? <div className="loan-count-bar">
                            Showing {numeral(loan_count).format('0,0')} of {numeral(kivaloans.loans_from_kiva.count(l => l.status == 'fundraising')).format('0,0')} fundraising loans
                        </div> : null}
                    {hasHadLoans && loan_count == 0 ? <Alert className="not-rounded-top" style={{marginBottom: '0px'}}>
                            There are no matching loans for your current criteria. Loosen the criteria or click "Reset" to start over.
                        </Alert> : null}
                    <LoadingLoansPanel/>
                    <InfiniteList
                        ref="results"
                        className="loan_list_container"
                        items={this.state.filtered_loans}
                        itemsCount={this.state.filtered_loans.length}
                        height={900}
                        itemHeight={82}
                        listItemClass={LoanListItem}/>
                </Col>

                {hasLoanDetail ? <Col md={detailCol} style={{overflowY: 'auto', maxHeight: 'calc(100vh - 60px)'}}>
                    {this.props.children}
                </Col> : null}

                {!hasLoanDetail && !showCriteria ? <Col md={detailCol}>
                    <p style={{padding: 20, color: '#999'}}>Select a loan from the list to view details.</p>
                </Col> : null}
            </div>
        )
    }
})

export default Search;
