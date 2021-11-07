import React, {useMemo} from 'react'
import PT from 'prop-types'
import numeral from 'numeral'
import {usePartnerDetails} from '../../store/helpers/hooks'
import {NewTabLink} from '../Links'
import {humanize} from '../../utils'
import DTDD from '../DTDD'
import {Col, Row} from '../bs'

const PartnerTab = ({partner_id}) => {
  // const dispatch = useDispatch()
  // useEffect(() => {
  //   // cannot shorten to () since this returns a promise
  //   // dispatch(partnerDetailsFetch(partner_id))
  // }, [partner_id])
  const partner = usePartnerDetails(partner_id)

  const partnerDictionary = useMemo(() => {
    // ugh. i should have just had it render to react for each entry!
    const result = []
    const addTerm = (term, def) => result.push({term, def})
    if (partner) {
      addTerm('Rating', partner.rating)
      addTerm('Start Date', new Date(partner.start_date).toString("MMM d, yyyy"))
      addTerm(partner.countries.length === 1 ? 'Country' : 'Countries', partner.countries.select(c => c.name).join(', '))

      addTerm('Delinquency',
        <span>{numeral(partner.delinquency_rate).format('0.000')}% {partner.delinquency_rate_note}</span>)
      addTerm('Loans at Risk Rate', <span>{numeral(partner.partners_at_risk_rate).format('0.000')}%</span>)
      addTerm('Default', <span>{numeral(partner.default_rate).format('0.000')}% {partner.default_rate_note}</span>)
      addTerm('Total Raised', <span>${numeral(partner.total_amount_raised).format('0,0')}</span>)
      addTerm('Loans', <span>{numeral(partner.loans_posted).format('0,0')}</span>)
      addTerm('Portfolio Yield',
        <span>{numeral(partner.portfolio_yield).format('0.0')}% {partner.portfolio_yield_note}</span>)
      addTerm('Profitability', partner.profitability ?
        <span>{numeral(partner.partners_at_risk_rate).format('0.000')}%</span> : '(unknown)')

      addTerm('Charges Fees / Interest', partner.charges_fees_and_interest ? 'Yes' : 'No')
      addTerm('Avg Loan/Cap Income',
        <span>{numeral(partner.average_loan_size_percent_per_capita_income).format('0.00')}%</span>)
      addTerm('Currency Ex Loss', <span>{numeral(partner.currency_exchange_loss_rate).format('0.000')}%</span>)
      if (partner.url) {
        addTerm('Website', <NewTabLink href={partner.url}>{partner.url}</NewTabLink>)
      }

      {
        partner.status !== 'active' && (
          // would only happen when looking up past loans which is not likely.
          addTerm('Status', humanize(partner.status))
        )
      }
    }

    return result.map(dict => (
      <DTDD key={dict.term} term={dict.term} def={dict.def} ddClass="col-sm-6" dtClass="col-sm-6"/>
    ))
  }, [partner])

  if (!partner) {
    return <div/>
  }

  return (
    <Row>
      <Col xs={12} lg={6}>
        <h2>{partner.name}</h2>

        <dl className="row">
          {partnerDictionary}
        </dl>
      </Col>
    </Row>
  )
}

PartnerTab.propTypes = {
  partner: PT.shape({
    name: PT.string,
    rating: PT.string,
    start_date: PT.string,
    delinquency_rate: PT.number,
    delinquency_rate_note: PT.string,
    default_rate: PT.number,
    default_rate_note: PT.string,
    loans_at_risk_rate: PT.number,
    total_amount_raised: PT.number,
    loans_posted: PT.number,
    portfolio_yield: PT.number,
    portfolio_yield_note: PT.string,
    profitability: PT.number,

  }),
}

export default PartnerTab
