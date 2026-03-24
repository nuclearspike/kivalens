'use strict'

import React from 'react'
import Reflux from 'reflux'
import {Grid, Col, Row, Input, Button, ButtonGroup, ListGroupItem, Panel, Label, Alert} from 'react-bootstrap'
import {KivaImage, KivaLink} from '.'
import PartnerDetail from './PartnerDetail.jsx'
import a from '../actions'
import s from '../stores/'
import numeral from 'numeral'
import cx from 'classnames'

// Import allOptions for criteria UI
var CriteriaTabs = require('./CriteriaTabs.jsx')

const statusColors = {
    active: null,
    inactive: '#e8e8e8',
    paused: '#fff8e1',
    closed: '#fce4ec'
}

const PartnerListItem = React.createClass({
    render() {
        var p = this.props.partner
        var isSelected = this.props.selected
        var bgColor = !isSelected && statusColors[p.status] ? statusColors[p.status] : null
        return (
            <ListGroupItem
                className={cx('loan_list_item', {selected: isSelected})}
                style={bgColor ? {backgroundColor: bgColor} : null}
                onClick={this.props.onClick}
                href="javascript:void(0)">
                {p.image ?
                    <KivaImage key={p.id} type="square" loan={p} image_width={113} height={60} width={60}/>
                : <div style={{width: 60, height: 60, display: 'inline-block', backgroundColor: '#ddd', verticalAlign: 'top', marginRight: 8}}/>}
                <div className="details">
                    <div className="loan-name">
                        {p.name}
                        {p.status !== 'active' ?
                            <span> <Label bsSize="xsmall" bsStyle={p.status === 'paused' ? 'warning' : 'default'}>{p.status}</Label></span>
                        : null}
                    </div>
                    <div className="loan-meta">
                        {p.countries && p.countries.length > 0 ?
                            <span className="loan-tag">{p.countries.length <= 3 ? p.countries.select(c => c.name).join(', ') : p.countries.length + ' countries'}</span>
                        : null}
                        {p.rating ? <span className="loan-tag">{p.rating} stars</span> : null}
                        {p.loans_posted ? <span className="loan-tag">{numeral(p.loans_posted).format('0,0')} loans</span> : null}
                    </div>
                </div>
            </ListGroupItem>
        )
    }
})

const Partners = React.createClass({
    mixins: [Reflux.ListenerMixin],
    getInitialState() {
        return {
            criteria: {},
            selectedPartner: null,
            showCriteria: true,
            filteredPartners: [],
            totalPartners: 0
        }
    },
    componentDidMount() {
        this.listenTo(a.loans.live.progress, this.onProgress)
        if (kivaloans.partners_from_kiva && kivaloans.partners_from_kiva.length > 0) {
            this.performSearch({})
        }
    },
    onProgress(progress) {
        if (progress.partners_loaded || progress.atheist_list_loaded) {
            this.performSearch(this.state.criteria)
        }
    },
    performSearch(criteria) {
        var results = kivaloans.filterAllPartners(criteria)
        results = results.orderBy(p => p.name)
        this.setState({
            filteredPartners: results,
            totalPartners: kivaloans.partners_from_kiva.length,
            criteria: criteria
        })
    },
    selectPartner(partner) {
        this.setState({selectedPartner: partner})
    },
    toggleCriteria() {
        this.setState({showCriteria: !this.state.showCriteria})
    },
    onNameChange(e) {
        var criteria = this.state.criteria
        criteria.name = e.target.value
        this.performSearch(criteria)
    },
    onStatusChange(value) {
        var criteria = this.state.criteria
        criteria.status = value
        this.performSearch(criteria)
    },
    render() {
        var {filteredPartners, totalPartners, selectedPartner, showCriteria} = this.state

        return (
            <div>
                <Col md={4}>
                    <div className="side-results">
                        <ButtonGroup justified className="top-only">
                            <Button href="#" key={1}
                                onClick={this.toggleCriteria}>
                                {showCriteria ? 'Hide Criteria' : 'Show Criteria'}
                            </Button>
                        </ButtonGroup>

                        {showCriteria ?
                            <Panel className="partner-criteria-panel" style={{marginBottom: 0, borderRadius: 0}}>
                                <div style={{marginBottom: 8}}>
                                    <input type="text" className="form-control" placeholder="Search by name..."
                                        onChange={this.onNameChange} value={this.state.criteria.name || ''}/>
                                </div>
                            </Panel>
                        : null}

                        <div className="loan-count-bar">
                            Showing {numeral(filteredPartners.length).format('0,0')} of {numeral(totalPartners).format('0,0')} partners
                        </div>

                        <div className="loan_list_container" style={{height: 800, overflowY: 'auto'}}>
                            {filteredPartners.map(p =>
                                <PartnerListItem
                                    key={p.id}
                                    partner={p}
                                    selected={selectedPartner && selectedPartner.id === p.id}
                                    onClick={this.selectPartner.bind(this, p)}/>
                            )}
                        </div>
                    </div>
                </Col>
                <Col md={8}>
                    {selectedPartner ?
                        <PartnerDetail partner={selectedPartner} showStatus={true}/>
                    :
                        <div style={{padding: '40px', textAlign: 'center', color: '#999'}}>
                            <h3>Select a partner from the list</h3>
                            <p>Use the search box to find partners by name. Browse all {numeral(totalPartners).format('0,0')} partners including inactive and paused ones.</p>
                        </div>
                    }
                </Col>
            </div>
        )
    }
})

export default Partners
