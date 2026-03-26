'use strict'

import React from 'react'
import Reflux from 'reflux'
import {Col, Row, ListGroupItem, Label, Panel, Button} from 'react-bootstrap'
import {KivaImage} from '.'
import PartnerDetail from './PartnerDetail.jsx'
import {SelectRow, SliderRow, allOptions} from './CriteriaTabs.jsx'
import {DelayStateTriggerMixin} from './Mixins'
import {Cursor} from 'react-cursor'
import a from '../actions'
import s from '../stores/'
import numeral from 'numeral'
import cx from 'classnames'
import extend from 'extend'

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
        var loanCount = this.props.loanCount
        var bgColor = !isSelected && statusColors[p.status] ? statusColors[p.status] : null
        return (
            <ListGroupItem
                className={cx('loan_list_item', {selected: isSelected})}
                style={bgColor ? {backgroundColor: bgColor, position: 'relative'} : {position: 'relative'}}
                onClick={this.props.onClick}
                href="javascript:void(0)">
                <div className="details" style={{marginLeft: 0}}>
                    <div className="loan-name">
                        {p.name}
                        {p.status !== 'active' ?
                            <span> <Label bsSize="xsmall" bsStyle={p.status === 'paused' ? 'warning' : 'default'}>{p.status}</Label></span>
                        : null}
                    </div>
                    <div className="loan-meta">
                        {p.countries && p.countries.length > 0 ?
                            <span className="loan-tag">{p.countries.select(c => c.name).join(', ')}</span>
                        : null}
                        {p.rating ? <span className="loan-tag">{p.rating} stars</span> : null}
                    </div>
                </div>
                {loanCount !== null && loanCount > 0 ?
                    <span className="badge" style={{position: 'absolute', bottom: 6, right: 8, backgroundColor: '#4a8b5c', fontSize: '10px'}}>{loanCount}</span>
                : null}
            </ListGroupItem>
        )
    }
})

const Partners = React.createClass({
    mixins: [Reflux.ListenerMixin, DelayStateTriggerMixin('criteria', 'performSearch', 200)],
    getInitialState() {
        return {
            criteria: { partner: { status: 'active' } },
            nameSearch: '',
            selectedPartner: null,
            filteredPartners: [],
            totalPartners: 0,
            displayAtheistOptions: false
        }
    },
    componentDidMount() {
        this.listenTo(a.loans.load.completed, this.onDataLoaded)
        this.listenTo(a.loans.load.secondaryLoad, this.onDataLoaded)
        this.setState({displayAtheistOptions: kivaloans.atheist_list_processed})
        this.performSearch()
    },
    onDataLoaded() {
        this.setState({displayAtheistOptions: kivaloans.atheist_list_processed})
        this.performSearch()
    },
    buildLoanCountMap() {
        var map = {}
        if (kivaloans.loans_from_kiva) {
            kivaloans.loans_from_kiva.forEach(l => {
                if (l.status === 'fundraising') {
                    map[l.partner_id] = (map[l.partner_id] || 0) + 1
                }
            })
        }
        return map
    },
    performSearch() {
        var c = extend(true, {}, this.state.criteria.partner || {})
        c.name = this.state.nameSearch
        var loanCountMap = this.buildLoanCountMap()
        var results = kivaloans.filterAllPartners(c)

        // Filter by fundraising loan count if set
        var flcMin = c.fundraising_loan_count_min
        var flcMax = c.fundraising_loan_count_max
        if (flcMin !== null && flcMin !== undefined) {
            results = results.filter(p => (loanCountMap[p.id] || 0) >= flcMin)
        }
        if (flcMax !== null && flcMax !== undefined) {
            results = results.filter(p => (loanCountMap[p.id] || 0) <= flcMax)
        }

        results = results.orderBy(p => p.name)
        this.setState({
            filteredPartners: results,
            totalPartners: kivaloans.partners_from_kiva ? kivaloans.partners_from_kiva.length : 0,
            loanCountMap: loanCountMap
        })
    },
    selectPartner(partner) {
        this.setState({selectedPartner: partner})
    },
    onNameChange(e) {
        this.setState({nameSearch: e.target.value}, this.performSearch)
    },
    clearCriteria() {
        this.setState({
            criteria: { partner: { status: 'active' } },
            nameSearch: ''
        }, this.performSearch)
    },
    render() {
        var {filteredPartners, totalPartners, selectedPartner, displayAtheistOptions} = this.state
        var cursor = Cursor.build(this).refine('criteria')
        var cPartner = cursor.refine('partner')

        return (
            <div>
                <Col md={4}>
                    <div style={{overflowY: 'auto', height: 'calc(100vh - 60px)', paddingRight: 15, overflowX: 'hidden'}}>
                        <input type="text" className="form-control" placeholder="Search by name..."
                            style={{marginBottom: 8}}
                            onChange={this.onNameChange} value={this.state.nameSearch}/>

                        <SelectRow name="status" cursor={cPartner.refine('status')}
                                   aanCursor={cPartner.refine('status_all_any_none')}/>

                        <SelectRow name="country_code" cursor={cPartner.refine('country_code')}
                                   aanCursor={cPartner.refine('country_code_all_any_none')}/>

                        {['region', 'social_performance', 'charges_fees_and_interest'].map((name, i) =>
                            <SelectRow key={i} name={name} cursor={cPartner.refine(name)}
                                       aanCursor={cPartner.refine(`${name}_all_any_none`)}/>
                        )}

                        <SelectRow name="religion" cursor={cPartner.refine('religion')}
                                   aanCursor={cPartner.refine('religion_all_any_none')}/>

                        {['partner_risk_rating', 'partner_arrears', 'loans_at_risk_rate', 'partner_default', 'portfolio_yield', 'profit', 'currency_exchange_loss_rate', 'average_loan_size_percent_per_capita_income', 'years_on_kiva', 'loans_posted'].map((name, i) =>
                            <SliderRow key={i} cursorMin={cPartner.refine(`${name}_min`)}
                                       cursorMax={cPartner.refine(`${name}_max`)} cycle={0}
                                       options={allOptions[name]}/>
                        )}

                        <SliderRow cursorMin={cPartner.refine('fundraising_loan_count_min')}
                                   cursorMax={cPartner.refine('fundraising_loan_count_max')} cycle={0}
                                   options={allOptions['fundraising_loan_count']}/>

                        {displayAtheistOptions ?
                            <div>
                                {['secular_rating', 'social_rating'].map((name, i) =>
                                    <SliderRow key={`${i}_atheist`} cursorMin={cPartner.refine(`${name}_min`)}
                                               cursorMax={cPartner.refine(`${name}_max`)} cycle={0}
                                               options={allOptions[name]}/>
                                )}
                            </div>
                        : null}
                    </div>
                </Col>
                <Col md={3}>
                    <div className="loan-count-bar" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                        <span>Showing {numeral(filteredPartners.length).format('0,0')} of {numeral(totalPartners).format('0,0')} partners</span>
                        <Button bsSize="xsmall" onClick={this.clearCriteria}>Reset</Button>
                    </div>
                    <div className="loan_list_container" style={{height: 'calc(100vh - 90px)', overflowY: 'auto'}}>
                        {filteredPartners.map(p =>
                            <PartnerListItem
                                key={p.id}
                                partner={p}
                                loanCount={p.status === 'active' ? (this.state.loanCountMap || {})[p.id] || 0 : null}
                                selected={selectedPartner && selectedPartner.id === p.id}
                                onClick={this.selectPartner.bind(this, p)}/>
                        )}
                    </div>
                </Col>
                <Col md={5}>
                    {selectedPartner ?
                        <PartnerDetail partner={selectedPartner} showStatus={true}/>
                    :
                        <div style={{padding: '40px', textAlign: 'center', color: '#999'}}>
                            <h3>Select a partner from the list</h3>
                            <p>Browse all {numeral(totalPartners).format('0,0')} partners including inactive and paused ones.</p>
                        </div>
                    }
                </Col>
            </div>
        )
    }
})

export default Partners
