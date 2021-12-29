import CritTester from '../../kiva-api/CritTester';
import { arrayWithElements } from '../../utils';
import { basicReverseOrder, fundraising } from '../../utils/linqextras.mjs';

const performSort = (loans, sort) => {
  if (loans.length > 1)
    switch (sort) {
      case 'half_back':
        loans = loans
          .orderBy(loan => loan.kls_half_back)
          .thenBy(loan => loan.kls_half_back_actual, basicReverseOrder)
          .thenBy(loan => loan.kls_75_back)
          .thenBy(loan => loan.kls_75_back_actual, basicReverseOrder)
          .thenBy(loan => loan.kls_final_repayment);
        break;
      case 'popularity':
        loans = loans.orderBy(
          loan => loan.kl_dollars_per_hour(),
          basicReverseOrder,
        );
        break;
      case 'newest':
        loans = loans
          .orderBy(loan => loan.kl_newest_sort, basicReverseOrder)
          .thenByDescending(loan => loan.id);
        break;
      case 'expiring':
        loans = loans
          .orderBy(loan => loan.kl_planned_expiration_date.getTime())
          .thenBy(loan => loan.id);
        break;
      case 'still_needed':
        loans = loans.orderBy(loan => loan.kl_still_needed);
        break;
      case 'none': // when all you want is a count... skip sorting.
        break;
      default:
        loans = loans
          .orderBy(loan => loan.kls_final_repayment)
          .thenBy(loan => loan.kls_half_back)
          .thenBy(loan => loan.kls_half_back_actual, basicReverseOrder)
          .thenBy(loan => loan.kls_75_back)
          .thenBy(loan => loan.kls_75_back_actual, basicReverseOrder);
    }
  return loans;
};

const searchPartners = (appState, { useCache = false, idsOnly = true }) => {
  const { criteria, partnerDetails, atheistList } = appState;
  let spArr = [];
  try {
    spArr =
      typeof criteria.partner.social_performance === 'string'
        ? criteria.partner.social_performance
            .split(',')
            .filter(sp => sp && !Number.isNaN(sp))
            .select(sp => parseInt(sp, 10))
        : [];
    // cannot be reduced to select(parseInt) :(
  } catch (e) {}

  let partnersGiven = [];
  if (criteria.partner.partners) {
    // explicitly given by user.
    partnersGiven = criteria.partner.partners
      .split(',')
      .select(id => parseInt(id, 10)); // cannot be reduced to select(parseInt) :(
  }

  // first filter partners, then pass in partner ids as one of the tests for loans
  const ct = new CritTester(criteria.partner);
  ct.addAnyAllNoneTester(
    'region',
    null,
    'any',
    partner => partner.kl_regions,
    true,
  );
  ct.addAnyAllNoneTester(
    'social_performance',
    spArr,
    'all',
    partner => partner.kl_sp,
    true,
  );
  ct.addAnyAllNoneTester(
    'partners',
    partnersGiven,
    'any',
    partner => partner.id,
  );
  ct.addRangeTesters(
    'partner_risk_rating',
    partner => partner.rating,
    partner => Number.isNaN(parseFloat(partner.rating)),
    crit => crit.partner_risk_rating.min === null, // what???
  );
  ct.addRangeTesters('partner_default', partner => partner.default_rate);
  ct.addRangeTesters('partner_arrears', partner => partner.delinquency_rate);
  ct.addRangeTesters('portfolio_yield', partner => partner.portfolio_yield);
  ct.addRangeTesters('profit', partner => partner.profitability);
  ct.addRangeTesters(
    'loans_at_risk_rate',
    partner => partner.loans_at_risk_rate,
  );
  ct.addRangeTesters(
    'currency_exchange_loss_rate',
    partner => partner.currency_exchange_loss_rate,
  );
  ct.addRangeTesters(
    'average_loan_size_percent_per_capita_income',
    partner => partner.average_loan_size_percent_per_capita_income,
  );
  ct.addRangeTesters('years_on_kiva', partner => partner.kl_years_on_kiva);
  ct.addRangeTesters('loans_posted', partner => partner.loans_posted);
  ct.addThreeStateTester(
    criteria.partner.charges_fees_and_interest,
    partner => partner.charges_fees_and_interest,
  );

  // atheist list criteria
  const isConstrained = ({ min, max }) => min || max;
  if (
    isConstrained(criteria.partner.secular_rating) ||
    isConstrained(criteria.partner.social_rating)
  ) {
    const cta = new CritTester(criteria.partner);
    cta.addRangeTesters('secular_rating', partner => partner.secularRating);
    cta.addRangeTesters('social_rating', partner => partner.socialRating);

    const passingAtheistList = Object.keys(atheistList)
      .map(id => atheistList[id])
      .nonBlank()
      .filter(p => cta.allPass(p))
      .ids();

    ct.testers.push(p => passingAtheistList.contains(p.id));
  }

  // let result = []; // this.active_partners.filter(p => ct.allPass(p));
  let result = Object.keys(partnerDetails)
    .map(id => partnerDetails[id])
    .filter(p => ct.allPass(p));

  if (idsOnly) {
    result = result.map(p => p.id);
  }

  return result;
};

const performSearch = (appState, output = 'loanIds') => {
  const { criteria, allLoanIds: loanIds, loanDetails } = appState;
  if (
    !criteria ||
    !criteria.borrower ||
    !criteria.loan ||
    !criteria.partner ||
    !arrayWithElements(loanIds) ||
    typeof loanDetails !== 'object'
  ) {
    return [];
  }

  const ct = new CritTester(criteria.borrower);
  ct.addRangeTesters('borrower_count', loan => loan.borrowers.length);
  ct.addRangeTesters('percent_female', loan => loan.kl_percent_women);
  ct.addRangeTesters('age_mentioned', loan => loan.kls_age);
  ct.addArrayAllPartialExactWithTester(
    criteria.borrower.name,
    loan => loan.kl_name_arr,
  );

  ct.switchGroup(criteria.loan);

  // partner list limiting can have profound impact on what loans are available and should be done ASAP
  if (!criteria.partner.direct) {
    ct.addFieldContainsOneOfArrayTester(
      searchPartners(appState, { idsOnly: true }),
      loan => loan.partner_id,
      true,
    ); // always added!
  } else if (criteria.partner.direct === 'direct') {
    ct.testers.push(loan => loan.partner_id == null);
  }

  ct.addRangeTesters('still_needed', loan => loan.kl_still_needed());
  ct.addRangeTesters('loan_amount', loan => loan.loan_amount);
  ct.addRangeTesters('percent_funded', loan => loan.kl_percent_funded());
  ct.addRangeTesters('dollars_per_hour', loan => loan.kl_dollars_per_hour());
  ct.addRangeTesters('expiring_in_days', loan => loan.kl_expiring_in_days());
  ct.addRangeTesters('disbursal', loan => loan.kl_disbursal_in_days());
  ct.addThreeStateTester(
    criteria.loan.bonus_credit_eligibility,
    loan => loan.bonus_credit_eligibility === true,
  );
  ct.addArrayAllPartialExactWithTester(
    criteria.loan.use_or_description,
    loan => loan.kls_use_or_descr_arr,
  );
  ct.addRangeTesters('repaid_in', loan => loan.kls_repaid_in());

  ct.addAnyAllNoneTester('sectors', null, 'any', loan => loan.sector);
  ct.addAnyAllNoneTester('activities', null, 'any', loan => loan.activity);
  ct.addAnyAllNoneTester(
    'countries',
    null,
    'any',
    loan => loan.location.country,
  );
  ct.addAnyAllNoneTester('tags', null, 'all', loan => loan.kls_tags, true);
  ct.addAnyAllNoneTester('themes', null, 'all', loan => loan.themes, true);

  ct.addFieldContainsOneOfArrayTester(criteria.loan.repayment_interval, loan =>
    loan.terms.repayment_interval ? loan.terms.repayment_interval : 'unknown',
  );
  ct.addFieldContainsOneOfArrayTester(
    criteria.loan.currency_exchange_loss_liability,
    loan =>
      loan.terms.loss_liability && loan.terms.loss_liability.currency_exchange,
  );

  //
  // MORE TO COPY!!!
  //

  ct.testers.push(fundraising);

  // perform the filtering!!
  let loans = loanIds
    .map(id => loanDetails[id])
    .filter(loan => loan && ct.allPass(loan));

  // if group by for limit is defined... then do limits...
  // ...
  if (criteria.results.limit_to_top && criteria.results.limit_to_top.enabled) {
    const count = isNaN(criteria.results.limit_to_top.count)
      ? 1
      : criteria.results.limit_to_top.count;
    let selector;
    switch (criteria.results.limit_to_top.per) {
      case 'Partner':
        selector = l => l.partner_id;
        break;
      case 'Country':
        selector = l => l.location.country;
        break;
      case 'Activity':
        selector = l => l.activity;
        break;
      case 'Sector':
        selector = l => l.sector;
        break;
    }

    if (selector) {
      // group by the field, sort each grouping of loans, then take the first x of those, then flatten all loans back to a regular array
      loans = loans
        .groupBy(selector)
        .map(g => performSort(g, criteria.loan.sort).take(count))
        .flatten();
    }
    // these then go and get sorted again so that the result list is fully sorted (otherwise it is still clustered, only matters when limit is more than 1)
  }
  // perform sort
  loans = performSort(loans, criteria.results.sort);

  if (output === 'loans') {
    return loans;
  }

  // default returns only ids.
  return loans.ids();
};

export default performSearch;
