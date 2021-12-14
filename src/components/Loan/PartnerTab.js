import React, { useMemo } from 'react';
import PT from 'prop-types';
import numeral from 'numeral';
import { usePartnerDetails, useStored } from '../../store/helpers/hooks';
import { KivaLink, NewTabLink } from '../Links';
import { arrayWithElements, humanize } from '../../utils';
import DTDD from '../DTDD';
import { Col, Jumbotron, Row } from '../bs';
import KivaImage from '../KivaImage/KivaImage';
import { useSelector } from 'react-redux';

const PartnerTab = ({ partnerId }) => {
  // const dispatch = useDispatch()
  // useEffect(() => {
  //   // cannot shorten to () since this returns a promise
  //   // dispatch(partnerDetailsFetch(partnerId))
  // }, [partnerId])
  const partner = usePartnerDetails(partnerId);
  const loadingPartnerData = useSelector(({ loading }) => loading.partners);
  const atheistData = useSelector(({ atheistList }) => atheistList[partnerId]);
  const [showAtheistResearch] = useStored('Options.mergeAtheistList', true);

  const partnerDictionary = useMemo(() => {
    // ugh. i should have just had it render to react for each entry!
    const result = [];
    const addTerm = (term, def) => result.push({ term, def });
    if (partner) {
      addTerm('Rating', partner.rating);
      addTerm(
        'Start Date',
        new Date(partner.start_date).toString('MMM d, yyyy'),
      );
      addTerm(
        partner.countries.length === 1 ? 'Country' : 'Countries',
        partner.countries.select(c => c.name).join(', '),
      );

      addTerm(
        'Delinquency',
        <span>
          {numeral(partner.delinquency_rate).format('0.000')}%{' '}
          {partner.delinquency_rate_note}
        </span>,
      );
      addTerm(
        'Loans at Risk Rate',
        <span>{numeral(partner.partners_at_risk_rate).format('0.000')}%</span>,
      );
      addTerm(
        'Default',
        <span>
          {numeral(partner.default_rate).format('0.000')}%{' '}
          {partner.default_rate_note}
        </span>,
      );
      addTerm(
        'Total Raised',
        <span>${numeral(partner.total_amount_raised).format('0,0')}</span>,
      );
      addTerm(
        'Loans',
        <span>{numeral(partner.loans_posted).format('0,0')}</span>,
      );
      addTerm(
        'Portfolio Yield',
        <span>
          {numeral(partner.portfolio_yield).format('0.0')}%{' '}
          {partner.portfolio_yield_note}
        </span>,
      );
      addTerm(
        'Profitability',
        partner.profitability ? (
          <span>{numeral(partner.partners_at_risk_rate).format('0.000')}%</span>
        ) : (
          '(unknown)'
        ),
      );

      addTerm(
        'Charges Fees / Interest',
        partner.charges_fees_and_interest ? 'Yes' : 'No',
      );
      addTerm(
        'Avg Loan/Cap Income',
        <span>
          {numeral(partner.average_loan_size_percent_per_capita_income).format(
            '0.00',
          )}
          %
        </span>,
      );
      addTerm(
        'Currency Ex Loss',
        <span>
          {numeral(partner.currency_exchange_loss_rate).format('0.000')}%
        </span>,
      );
      if (partner.url) {
        addTerm(
          'Website',
          <NewTabLink href={partner.url}>{partner.url}</NewTabLink>,
        );
      }

      if (partner.status !== 'active') {
        // would only happen when looking up past loans which is not likely.
        addTerm('Status', humanize(partner.status));
      }
    }

    return result.map(dict => (
      <DTDD
        key={dict.term}
        term={dict.term}
        def={dict.def}
        ddClass="col-sm-6"
        dtClass="col-sm-6"
      />
    ));
  }, [partner]);

  const atheistDictionary = useMemo(() => {
    if (!showAtheistResearch) return <div />;
    const result = [];
    const addTerm = (term, def) => result.push({ term, def });
    // this isn't set to download yet! let alone
    if (atheistData) {
      addTerm('Secular Rating', atheistData.secularRating);
      addTerm('Religious Affiliation', atheistData.religiousAffiliation);
      addTerm('Comments on Rating', atheistData.commentsOnSecularRating);
      addTerm('Social Rating', atheistData.socialRating);
      addTerm('Comments on Rating', atheistData.commentsOnSocialRating);
      addTerm('Review Comments', atheistData.reviewComments);
    }

    return result.map(dict => (
      <DTDD
        key={dict.term}
        term={dict.term}
        def={dict.def}
        dtClass="col-sm-3"
        ddClass="col-sm-9"
      />
    ));
  }, [atheistData, showAtheistResearch]);

  if (loadingPartnerData) {
    return (
      <Jumbotron style={{ padding: '15px' }}>
        <h1>Loading Partner Data...</h1>
      </Jumbotron>
    );
  }

  if (!partner) {
    return (
      <Jumbotron style={{ padding: '15px' }}>
        <h1>Error: Partner does not exist</h1>
      </Jumbotron>
    );
  }

  return (
    <>
      <Row>
        <Col xs={12}>
          <h2>{partner.name}</h2>
        </Col>
        <Col xs={12} lg={6}>
          <dl className="row">{partnerDictionary}</dl>
        </Col>
        <Col xs={12} lg={6}>
          <KivaImage
            key={partner.id}
            type="width"
            loan={partner}
            imageWidth={600}
            width="100%"
          />
          <KivaLink path={`about/where-kiva-works/partners/${partner.id}`}>
            View Partner on Kiva.org
          </KivaLink>
        </Col>
      </Row>
      {arrayWithElements(partner.kl_sp) && (
        <Row>
          <Col xs={12}>
            <hr />
            <h3>Social Performance Strengths</h3>
            {partner.social_performance_strengths.map(sp => (
              <li key={sp.name}>
                <b>{sp.name}</b>: {sp.description}
              </li>
            ))}
          </Col>
        </Row>
      )}
      {atheistDictionary && (
        <Row>
          <Col xs={12}>
            <hr />
            <h3>Atheist Team Research</h3>
            <dl className="row">{atheistDictionary}</dl>
          </Col>
        </Row>
      )}
    </>
  );
};

PartnerTab.propTypes = {
  partnerId: PT.number.isRequired,
};

export default PartnerTab;
