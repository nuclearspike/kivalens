'use strict'

import React from 'react'
import Reflux from 'reflux'
import Notification from 'react-notification'
import {Grid,Row,Col,Input,ButtonGroup,Button,Alert} from 'react-bootstrap'
import {LoanListItem, LoadingLoansModal, BulkAddModal} from '.'
import a from '../actions'
import s from '../stores'
import InfiniteList from 'react-infinite-list'

var Search = React.createClass({
    mixins: [Reflux.ListenerMixin],
    getInitialState(){
        var filtered_loans = s.loans.syncFilterLoansLast()
        if (filtered_loans.length == 0)
            filtered_loans = s.loans.syncFilterLoans()
        var show_secondary_load = (kivaloans.secondary_load == 'started')
        return {filtered_loans, show_secondary_load, loan_count: filtered_loans.length, notification: {active: false, message: ''}}
    },
    componentDidMount() {
        //initial state works when flipping to Search after stuff is loaded. listenTo works when it's waiting
        //it should only fetch loans that are filtered.
        this.listenTo(a.loans.filter.completed, loans => {
            this.setState({filtered_loans: loans, loan_count: loans.length})
            if (loans.length > 0) //once it's on it's on.
                this.should_show_count = true
            if (this.should_show_count)
                this.showNotification(`${loans.length} loans`)
        })
        //if we enter the page and loading loans is not done yet.
        this.listenTo(a.loans.load.completed, loans => a.loans.filter())
        this.listenTo(a.loans.load.secondaryLoad, this.secondaryLoad)
        this.listenTo(a.loans.load.secondaryStatus, this.secondaryStatus)
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
    showNotification(message){
        this.setState({notification: {active: true, message}})
    },
    changeCriteria(e){
        //e.preventDefault()
        //todo: scroll to criteria after it switches
    },
    bulkAdd(e){
        e.preventDefault()
        this.setState({showBulkAdd: true})
    },
    modalHidden(){
        //I hate this. this cannot be the right way to do this. it works. but there has to be a better way.
        this.setState({showBulkAdd: false})
    },
    render()  {
        var style = {height:'100%', width: '100%'};
        return (
            <div style={style} >
                <LoadingLoansModal/>
                <If condition={this.state.showBulkAdd}>
                    <BulkAddModal onHide={this.modalHidden} />
                </If>
                <Col md={4}>
                    <Notification dismissAfter={5000} isActive={this.state.notification.active} message={this.state.notification.message} action={''} />
                    <ButtonGroup justified>
                        <Button href="#" key={1} onClick={this.bulkAdd}>Bulk Add</Button>
                        <Button href="#/search" key={2} disabled={this.props.location.pathname == '/search'} onClick={this.changeCriteria}>Change Criteria</Button>
                    </ButtonGroup>
                    <If condition={this.state.show_secondary_load}>
                        <Alert style={{marginBottom:'0px'}} bsStyle="warning">
                            More loans are still loading. Carry on. {this.state.secondary_load_status}
                        </Alert>
                    </If>
                    <InfiniteList
                        className="loan_list_container"
                        items={this.state.filtered_loans}
                        height={900}
                        itemHeight={100}
                        listItemClass={LoanListItem} />
                </Col>
                <Col md={8}>
                    {this.props.children}
                </Col>
            </div>
        );
    }
})

export default Search;