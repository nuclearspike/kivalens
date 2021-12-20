import extend from 'extend';
import { Deferred } from 'jquery-deferred';
import 'linqjs';
import 'datejs';
import LenderLoans from './LenderLoans';

class LenderStatusLoans extends LenderLoans {
  constructor(lenderId, options) {
    // test for options.status... then can remove test in result()
    super(lenderId, extend(true, {}, options));
  }

  start() {
    // returns actual loan objects.
    return super.start().then(loans => {
      if (this.options.status) {
        return loans.filter(loan => loan.status === this.options.status);
      }
      return loans;
    });
  }
}

class LenderFundraisingLoans extends LenderStatusLoans {
  constructor(lenderId, options) {
    super(
      lenderId,
      extend(true, {}, options, {
        status: 'fundraising',
        fundraising_only: true,
      }),
    );
  }

  continuePaging(loans) {
    // only do this stuff if we are only wanting fundraising which is what we want now. but if open-sourced other
    // projects may want it for different reasons.
    if (
      this.options.fundraising_only &&
      !loans.any(loan => loan.status === 'fundraising')
    ) {
      // if all loans on the page would have expired. this could miss some mega-mega lenders in corner cases.
      const today = Date.today();
      // older loans do not have a planned_expiration_date field.
      if (
        loans.all(
          loan =>
            !loan.planned_expiration_date ||
            new Date(loan.planned_expiration_date).isBefore(today),
        )
      )
        return false;
    }
    return true;
  }

  ids() {
    const d = Deferred();
    this.promise.fail(d.reject);
    super.start().then(loans => d.resolve(loans.select(loan => loan.id)));
    return d;
  }
}

export default LenderFundraisingLoans;
