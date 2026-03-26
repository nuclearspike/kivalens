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
        var bgColor = !isSelected && statusColors[p.status] ? statusColors[p.status] : null
        return (
            <ListGroupItem
                className={cx('loan_list_item', {selected: isSelected})}
                style={bgColor ? {backgroundColor: bgColor} : null}
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
                            <span className="loan-tag">{p.countries.length <= 3 ? p.countries.select(c => c.name).join(', ') : p.countries.length + ' countries'}</span>
                        : null}
                        {p.rating ? <span className="loan-tag">{p.rating} stars</span> : null}
                    </div>
                </div>
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
        this.listenTo(a.loans.live.progress, this.onProgress)
        this.setState({displayAtheistOptions: kivaloans.atheist_list_processed})
        this.performSearch()
    },
    onProgress(progress) {
        if (progress.partners_loaded || progress.atheist_list_loaded || progress.loans_loaded) {
            this.setState({displayAtheistOptions: kivaloans.atheist_list_processed})
            this.performSearch()
        }
    },
    performSearch() {
        var c = extend(true, {}, this.state.criteria.partner || {})
        c.name = this.state.nameSearch
        var results = kivaloans.filterAllPartners(c)
        results = results.orderBy(p => p.name)
        this.setState({
            filteredPartners: results,
            totalPartners: kivaloans.partners_from_kiva ? kivaloans.partners_from_kiva.length : 0
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
                        <div style={{display: 'flex', gap: 4, marginBottom: 8}}>
                            <input type="text" className="form-control" placeholder="Search by name..."
                                style={{flex: 1}}
                                onChange={this.onNameChange} value={this.state.nameSearch}/>
                            <Button bsSize="small" onClick={this.clearCriteria}>Clear</Button>
                        </div>

                        <SelectRow name="status" cursor={cPartner.refine('status')}
                                   aanCursor={cPartner.refine('status_all_any_none')}/>

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
                    <div className="loan-count-bar">
                        Showing {numeral(filteredPartners.length).format('0,0')} of {numeral(totalPartners).format('0,0')} partners
                    </div>
                    <div className="loan_list_container" style={{height: 'calc(100vh - 90px)', overflowY: 'auto'}}>
                        {filteredPartners.map(p =>
                            <PartnerListItem
                                key={p.id}
                                partner={p}
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
