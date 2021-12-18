import CritTester from '../../kiva-api/CritTester';
import { arrayWithElements } from '../../utils';

const performSearch = (criteria, loanIds, loanDetails) => {
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
  // first filter partners, then pass in partner ids as one of the tests for loans

  const ct = new CritTester(criteria.borrower);

  ct.addRangeTesters('borrower_count', loan => loan.borrowers.length);
  ct.addRangeTesters('percent_female', loan => loan.kl_percent_women);
  ct.addRangeTesters('age_mentioned', loan => loan.kls_age);
  ct.addArrayAllPartialExactWithTester(
    criteria.borrower.name,
    loan => loan.kl_name_arr,
  );

  ct.switchGroup(criteria.loan);

  ct.addRangeTesters('still_needed', loan => loan.kl_still_needed());
  ct.addRangeTesters('loan_amount', loan => loan.loan_amount);
  ct.addRangeTesters('percent_funded', loan => loan.kl_percent_funded());
  ct.addRangeTesters('dollars_per_hour', loan => loan.kl_dollars_per_hour());
  ct.addRangeTesters('expiring_in_days', loan => loan.kl_expiring_in_days());
  ct.addRangeTesters('disbursal', loan => loan.kl_disbursal_in_days());
  ct.addArrayAllPartialExactWithTester(
    criteria.loan.use_or_description,
    loan => loan.kls_use_or_descr_arr,
  );
  ct.addRangeTesters('repaid_in', loan => loan.kls_repaid_in());

  ct.addAnyAllNoneTester('sectors', null, 'any', loan => loan.sector);
  ct.addAnyAllNoneTester('activities', null, 'any', loan => loan.activity);
  // ct.addAnyAllNoneTester(
  //   'country_code',
  //   null,
  //   'any',
  //   loan => loan.location.country_code,
  // );
  ct.addAnyAllNoneTester('tags', null, 'all', loan => loan.kls_tags, true);
  ct.addAnyAllNoneTester('themes', null, 'all', loan => loan.themes, true);

  // ct.addFieldContainsOneOfArrayTester(criteria.loan.repayment_interval, loan =>
  //   loan.terms.repayment_interval ? loan.terms.repayment_interval : 'unknown',
  // );
  // ct.addFieldContainsOneOfArrayTester(
  //   criteria.loan.currency_exchange_loss_liability,
  //   loan =>
  //     loan.terms.loss_liability && loan.terms.loss_liability.currency_exchange,
  // );
  //

  //
  // MORE TO COPY!!!
  //

  ct.testers.push(loan => loan.status === 'fundraising');

  return loanIds
    .map(id => loanDetails[id])
    .filter(loan => loan && ct.allPass(loan))
    .map(l => l.id);
};

export default performSearch;
