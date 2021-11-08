import React, {useEffect, useMemo} from 'react'
import PT from 'prop-types'
import {useDispatch} from 'react-redux'
import TimeAgo from 'react-timeago'
import numeral from 'numeral'
import * as Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import {Col, OverlayTrigger, Popover, ProgressBar, Row} from '../bs'
import {humanize, humanizeArray} from '../../utils'
import {loanDetailsFetch} from '../../actions/loan_details'
import DTDD from '../DTDD'

const DisplayDate = ({date}) => (
  <>
    {date.toString('MMM d, yyyy @ h:mm:ss tt')} (<TimeAgo date={date}/>)
  </>
)

DisplayDate.propTypes = {
  date: PT.object.isRequired,
}

const LoanTab = ({loan}) => {
  const dispatch = useDispatch()

  // this causes a double call but also refreshes
  useEffect(() => {
    // cannot shorten to () since this returns a promise
    setImmediate(() => {
      dispatch(loanDetailsFetch(loan.id))
    })
  }, [loan.id])

  const lentPercentages = useMemo(() => {
    if (!loan || !loan.status === 'fundraising') {
      return {}
    }
    const fundedPerc = (loan.funded_amount * 100) / loan.loan_amount
    const basketPerc = (loan.basket_amount * 100) / loan.loan_amount
    return {funded_perc: fundedPerc, basket_perc: basketPerc}
  }, [loan])

  const loanDictionary = useMemo(() => {
    const result = []
    const addTerm = (term, def) => result.push({term, def})
    if (loan) {
      addTerm('Saved Searches', '(Not Implemented Yet)')
      addTerm('Tags', humanizeArray(loan.tags, '(none)'))
      addTerm('Themes', humanizeArray(loan.themes, '(none)'))

      addTerm(
        'Borrowers',
        <>
          {loan.borrowers.length} ({Math.round(loan.kl_percent_women)}% Female)
        </>,
      )
      addTerm('Posted', <DisplayDate date={loan.kl_posted_date}/>)
      if (loan.status !== 'fundraising') {
        addTerm('Status', humanize(loan.status))
      }
      if (loan.funded_date) {
        addTerm('Funded', <DisplayDate date={new Date(loan.funded_date)}/>)
      }
      if (loan.status === 'fundraising') {
        addTerm(
          'Expires',
          <DisplayDate date={loan.kl_planned_expiration_date}/>,
        )
      }
      if (loan.terms.disbursal_date) {
        addTerm(
          'Disbursed',
          <span>
            {new Date(loan.terms.disbursal_date).toString('MMM d, yyyy')} (
            <TimeAgo date={loan.terms.disbursal_date}/>)
          </span>,
        )
      }
      if (loan.status === 'fundraising') {
        addTerm(
          'Final Repayment In',
          <span>{numeral(loan.kls_repaid_in).format('0.0')} months</span>,
        )
      }
    }
    return result.map(dict => (
      <DTDD key={dict.term} term={dict.term} def={dict.def}/>
    ))
  }, [loan]);

  const loanStats = useMemo(() => {
    const result = []
    const addTerm = (term, def) => result.push({term, def})
    if (loan) {
      addTerm(
        '$/Hour',
        <span>${numeral(loan.kl_dollars_per_hour()).format('0.00')}</span>,
      )
      addTerm('Loan Amount', <span>${loan.loan_amount}</span>)
      addTerm('Funded Amount', <span>${loan.funded_amount}</span>)
      addTerm('In Baskets', <span>${loan.basket_amount}</span>)
      addTerm('Still Needed', <span>${loan.kl_still_needed}</span>)
    }
    return result.map(dict => (
      <DTDD key={dict.term} term={dict.term} def={dict.def}/>
    ))
  }, [loan]);

  const overlay = useMemo(() => {
    return (
      <Popover id="progress-hint" style={{padding: 10}}>
        ${loan.basket_amount} in Baskets
        <br/>${loan.funded_amount} Funded
        <br/>${loan.kl_still_needed} Needed
      </Popover>
    )
  }, [lentPercentages])

  const graphConfig = useMemo(() => {
    if (!loan) return null

    if (!loan.kl_repay_categories) {
      loan.kl_repay_categories = loan.kl_repayments.map(
        payment => payment.display,
      )
      loan.kl_repay_data = loan.kl_repayments.map(payment => payment.amount)
      loan.kl_repay_percent = loan.kl_repayments.map(
        payment => payment.percent,
      )
    }

    const height = Math.max(
      400,
      Math.min(loan.kl_repay_categories.length * 50, 1000),
    )

    return {
      chart: {
        alignTicks: false,
        type: 'bar',
        animation: false,
        renderTo: 'graph_container',
        height,
      },
      title: {text: 'Repayments'},
      xAxis: {
        categories: loan.kl_repay_categories,
        title: {text: null},
      },
      yAxis: [
        {
          min: 0,
          dataLabels: {enabled: false},
          labels: {overflow: 'justify'},
          title: {text: 'USD'},
        },
        {
          min: 0,
          max: 100,
          dataLabels: {enabled: false},
          labels: {overflow: 'justify'},
          title: {text: 'Percent'},
        },
      ],
      tooltip: {
        valueDecimals: 2,
      },
      plotOptions: {
        bar: {
          dataLabels: {
            enabled: true,
            valueDecimals: 2,
            // eslint-disable-next-line no-template-curly-in-string
            format: '${y:.2f} USD',
          },
        },
        area: {
          marker: {enabled: false},
          dataLabels: {
            enabled: false,
            valueDecimals: 0,
            format: '{y:.0f}%',
          },
        },
      },
      legend: {enabled: false},
      credits: {enabled: false},
      series: [
        {
          type: 'column',
          animation: false,
          zIndex: 6,
          name: 'Repayment',
          data: loan.kl_repay_data,
        },
        {
          type: 'area',
          animation: false,
          yAxis: 1,
          zIndex: 5,
          name: 'Percentage',
          data: loan.kl_repay_percent,
        },
      ],
    };
  }, [loan]);

  return (
    <Row>
      <Col xs={12} md={8}>
        <Row>
          <Col xs={12}>
            {lentPercentages && (
              <OverlayTrigger
                overlay={overlay}
                trigger={['hover', 'focus', 'click']}
                placement="top"
              >
                <ProgressBar>
                  <ProgressBar
                    label="Funded"
                    variant="success"
                    now={lentPercentages.funded_perc}
                    key="funded"
                  />
                  <ProgressBar
                    label="Baskets"
                    animated
                    striped
                    variant="warning"
                    now={lentPercentages.basket_perc}
                    key="basket"
                  />
                </ProgressBar>
              </OverlayTrigger>
            )}
          </Col>
        </Row>

        <Row className="margin-bottom-20">
          <Col xs={12}/>
        </Row>

        <dl className="row">{loanDictionary}</dl>

        <dl className="row">{loanStats}</dl>

        <p dangerouslySetInnerHTML={{__html: loan.description.texts.en}}/>
      </Col>
      <Col xs={12} md={4}>
        {loan.status === 'fundraising' && (
          <>
            <div id="graph_container">
              <HighchartsReact highcharts={Highcharts} options={graphConfig}/>
            </div>

            <dl className="row" style={{width: '100%'}}>
              <DTDD
                term="Interval"
                def={loan.terms.repayment_interval}
                ddClass="col-sm-6"
                dtClass="col-sm-6"
              />
              {loan.kls_half_back_actual < 100 && (
                <DTDD
                  term={
                    <span>
                      {Math.round(loan.kls_half_back_actual)}% back by
                    </span>
                  }
                  def={loan.kls_half_back.toString('MMM d, yyyy')}
                  ddClass="col-sm-6"
                  dtClass="col-sm-6"
                />
              )}
              {loan.kls_75_back_actual < 100 && (
                <DTDD
                  term={
                    <span>{Math.round(loan.kls_75_back_actual)}% back by</span>
                  }
                  def={loan.kls_75_back.toString('MMM d, yyyy')}
                  ddClass="col-sm-6"
                  dtClass="col-sm-6"
                />
              )}
              {loan.kls_final_repayment && (
                <DTDD
                  term="Final repayment"
                  def={loan.kls_final_repayment.toString('MMM d, yyyy')}
                  ddClass="col-sm-6"
                  dtClass="col-sm-6"
                />
              )}
            </dl>
          </>
        )}
      </Col>
    </Row>
  );
};

LoanTab.propTypes = {
  loan: PT.shape({
    id: PT.number,
    status: PT.string,
    description: PT.shape({
      texts: PT.shape({
        en: PT.string,
      }),
    }),
    loan_amount: PT.number,
    basket_amount: PT.number,
    funded_amount: PT.number,
    kl_still_needed: PT.number,
    kls_repaid_in: PT.number,
    kl_dollars_per_hour: PT.func,
    funded_date: PT.string,
    tags: PT.arrayOf(PT.string),
    themes: PT.arrayOf(PT.string),
    borrowers: PT.arrayOf(PT.shape({})),
    terms: PT.shape({
      disbursal_date: PT.string,
      repayment_interval: PT.string,
    }),
    kl_percent_women: PT.number,
    kl_posted_date: PT.object,
    kl_repay_data: PT.object,
    kl_repay_percent: PT.object,
    kl_planned_expiration_date: PT.object,
    kl_repay_categories: PT.arrayOf(PT.object),
    kl_repayments: PT.arrayOf({
      display: PT.string,
      amount: PT.number,
    }),
    kls_half_back_actual: PT.number,
    kls_75_back_actual: PT.number,
    kls_final_repayment: PT.object,
    kls_half_back: PT.object,
    kls_75_back: PT.object,
  }).isRequired,
};

export default LoanTab
