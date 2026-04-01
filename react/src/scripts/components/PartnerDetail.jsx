'use strict'

import React from 'react'
import {Col, Label, Button} from 'react-bootstrap'
import {KivaImage, NewTabLink, KivaLink} from '.'
import numeral from 'numeral'
import a from '../actions'
import s from '../stores'

const statusColors = {
    active: null,
    inactive: 'default',
    paused: 'warning',
    closed: 'danger'
}

const PartnerDetail = React.createClass({
    propTypes: {
        partner: React.PropTypes.object.isRequired,
        showStatus: React.PropTypes.bool
    },
    getDefaultProps() {
        return { showStatus: true }
    },
    searchLoans() {
        var partner = this.props.partner
        var crit = s.criteria.syncBlankCriteria()
        crit.partner.partners = partner.id.toString()
        s.criteria.onChange(crit)
        a.criteria.reload(crit)
        window.location.hash = '#/search'
    },
    render() {
        var partner = this.props.partner
        if (!partner) return null
        var atheistScore = partner.atheistScore || {}
        var showAtheistResearch = !!partner.atheistScore

        var loanCount = 0
        if (partner.status === 'active' && typeof kivaloans !== 'undefined' && kivaloans.loans_from_kiva) {
            loanCount = kivaloans.loans_from_kiva.filter(l => l.partner_id === partner.id).length
        }

        return (
            <div className="PartnerDetail">
                {loanCount > 0 ?
                    <div style={{marginBottom: 10, padding: '8px 12px', background: '#e8f5e9', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                        <span><b>{numeral(loanCount).format('0,0')}</b> fundraising loan{loanCount !== 1 ? 's' : ''}</span>
                        <Button bsSize="small" bsStyle="success" onClick={this.searchLoans}>Show Loans</Button>
                    </div>
                : null}
                <h2>
                    <KivaLink path={`about/where-kiva-works/partners/${partner.id}`}><span style={{display: 'inline-block', width: 18, height: 18, lineHeight: '18px', borderRadius: '50%', background: '#2C8C5E', color: '#fff', textAlign: 'center', fontSize: 11, fontWeight: 700, verticalAlign: 'middle', marginRight: 6, position: 'relative', top: -2}}>K</span></KivaLink>
                    {partner.name}
                    {this.props.showStatus && partner.status !== 'active' ?
                        <span> <Label bsStyle={statusColors[partner.status] || 'default'}>{partner.status}</Label></span>
                    : null}
                </h2>
                <Col lg={6}>
                    <dl className="dl-horizontal">
                        <dt>Rating</dt><dd>{partner.rating}</dd>
                        {partner.status !== 'active' ?
                            <span><dt>Status</dt><dd style={{textTransform: 'capitalize'}}>{partner.status}</dd></span>
                        : null}
                        <dt>Start Date</dt><dd>{new Date(partner.start_date).toString("MMM d, yyyy")}</dd>
                        <dt>{partner.countries && partner.countries.length === 1 ? 'Country' : 'Countries'}</dt>
                        <dd>{partner.countries ? partner.countries.select(c => c.name).join(', ') : '(unknown)'}</dd>
                        <dt>Delinquency</dt><dd>{numeral(partner.delinquency_rate).format('0.000')}% {partner.delinquency_rate_note}</dd>
                        <dt>Loans at Risk Rate</dt><dd>{numeral(partner.loans_at_risk_rate).format('0.000')}%</dd>
                        <dt>Default</dt><dd>{numeral(partner.default_rate).format('0.000')}% {partner.default_rate_note}</dd>
                        <dt>Total Raised</dt><dd>${numeral(partner.total_amount_raised).format('0,0')}</dd>
                        <dt>Loans</dt><dd>{numeral(partner.loans_posted).format('0,0')}</dd>
                        <dt>Portfolio Yield</dt><dd>{numeral(partner.portfolio_yield).format('0.0')}% {partner.portfolio_yield_note}</dd>
                        <dt>Profitability</dt>
                        {partner.profitability ?
                            <dd>{numeral(partner.profitability).format('0.0')}%</dd>
                        :
                            <dd>(unknown)</dd>
                        }
                        <dt>Charges Fees / Interest</dt><dd>{partner.charges_fees_and_interest ? 'Yes' : 'No'}</dd>
                        <dt>Avg Loan/Cap Income</dt><dd>{numeral(partner.average_loan_size_percent_per_capita_income).format('0.00')}%</dd>
                        <dt>Currency Ex Loss</dt><dd>{numeral(partner.currency_exchange_loss_rate).format('0.000')}%</dd>
                        {partner.url ?
                            <span><dt>Website</dt><dd><NewTabLink href={partner.url}>{partner.url}</NewTabLink></dd></span>
                        : null}
                    </dl>
                </Col>
                <Col lg={6}>
                    {partner.image ?
                        <KivaImage key={partner.id} className="float_left" type="width" loan={partner} image_width={800} width="100%" style={{maxHeight: 300, objectFit: 'contain'}}/>
                    : null}
                </Col>
                <Col lg={12}>
                    {partner.kl_sp && partner.kl_sp.length ?
                        <div>
                            <h3>Social Performance Strengths</h3>
                            <ul>
                                {partner.social_performance_strengths.map((sp, i) =>
                                    <li key={i}><b>{sp.name}</b>: {sp.description}</li>
                                )}
                            </ul>
                        </div>
                    : null}

                    {showAtheistResearch && atheistScore ?
                        <div>
                            <h3>A+ Team Research</h3>
                            <dl className="dl-horizontal">
                                <dt>Secular Rating</dt><dd>{atheistScore.secularRating}</dd>
                                <dt>Religious Affiliation</dt><dd>{atheistScore.religiousAffiliation}</dd>
                                <dt>Comments on Rating</dt><dd>{atheistScore.commentsOnSecularRating}</dd>
                                <dt>Social Rating</dt><dd>{atheistScore.socialRating}</dd>
                                <dt>Comments on Rating</dt><dd>{atheistScore.commentsOnSocialRating}</dd>
                                <dt>Review Comments</dt><dd>{atheistScore.reviewComments}</dd>
                            </dl>
                        </div>
                    : null}
                </Col>
            </div>
        )
    }
})

export default PartnerDetail
