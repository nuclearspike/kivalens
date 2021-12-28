import extend from 'extend';
import 'linqjs';
import 'datejs';
import { isServer } from './kivaBase.mjs';

const commonUse = [
  'PURCHASE',
  'FOR',
  'AND',
  'BUY',
  'OTHER',
  'HER',
  'BUSINESS',
  'SELL',
  'MORE',
  'HIS',
  'THE',
  'PAY',
];
const commonDescr = commonUse.concat([
  'THIS',
  'ARE',
  'SHE',
  'THAT',
  'HAS',
  'LOAN',
  'BE',
  'OLD',
  'BEEN',
  'YEARS',
  'FROM',
  'WITH',
  'INCOME',
  'WILL',
  'HAVE',
]);

const ageRegEx1 = new RegExp(/([2-9]\d)[ |-]years?[ |-](?:of age|old)/i);
const ageRegEx2 = new RegExp(/(?:aged?|is) ([2-9]\d)/i); // reduce to a single regex?

const getAge = text => {
  let ageMatch = ageRegEx1.exec(text);
  ageMatch = ageMatch || ageRegEx2.exec(text);
  return Array.isArray(ageMatch) && ageMatch.length === 2
    ? parseInt(ageMatch[1], 10)
    : null;
};

// also: age(d) 34, 50 years of age
// static class to hold standard functions that prepare kiva api objects for use with kiva lens.
// should be "transforms"
class ResultProcessors {
  static processLoans(loans) {
    // this alters the loans in the array. no need to return the array ?
    loans.forEach(ResultProcessors.processLoan);
    return loans;
  }

  static unprocessLoans(loans) {
    return loans.map(ResultProcessors.unprocessLoan);
  }

  // remove any KivaLens-added fields/functions
  static unprocessLoan(loan) {
    const l = extend(true, {}, loan); // make a copy, strip it out
    this.unprocessLoanDestructive(l);
    return l;
  }

  static unprocessLoanDestructive(loan) {
    Object.keys(loan)
      .filter(f => f.indexOf('kl_') === 0)
      .forEach(field => delete loan[field]);
    loan.kls_half_back = loan.kls_half_back ? loan.kls_half_back.toISOString() : null;
    loan.kls_75_back = loan.kls_75_back ? loan.kls_75_back.toISOString() : null;
    loan.kls_final_repayment = loan.kls_final_repayment
      ? loan.kls_final_repayment.toISOString()
      : null;
    delete loan.getPartner;
  }

  static processLoanDescription(loan) {
    const processText = (text, ignoreWords) => {
      if (text && text.length > 0) {
        // remove common words.
        const matches = text.match(/(\w+)/g); // splits on word boundaries
        if (!Array.isArray(matches)) return [];
        return matches
          .distinct() // ignores repeats
          .filter(word => typeof word === 'string' && word.length > 2) // ignores words 2 characters or less
          .map(word => word.toUpperCase()) // UPPERCASE
          .filter(word => !ignoreWords.contains(word)); // ignores common words
      }
      return []; // no indexable words.
    };

    /**
     * on the server, on the first-pass the kls will be empty, the description and use will be populated.
     * on the client, the kls will be populated but no description.
     */

    // I do not like this function at all. used in too many situations and too much is being inferred.

    const processDescr = true;
    let descrArr = [];
    if (isServer()) {
      if (loan.description.texts.en) {
        descrArr = processText(loan.description.texts.en, commonDescr);
      }
      loan.kls_has_descr = loan.description.texts.en !== undefined;
    } else if (!loan.description.texts.en)
      loan.description.texts.en = loan.kls_has_descr
        ? ''
        : 'No English description available.';
    else {
      // client gets a full detail
      descrArr = processText(loan.description.texts.en, commonDescr);
    }

    // no matter what, this function
    if (processDescr) {
      const useArr = processText(loan.use, commonUse);
      loan.kls_use_or_descr_arr = useArr.concat(descrArr).distinct();
    } else {
      if (!loan.kls_use_or_descr_arr)
        // make sure it is an array.
        loan.kls_use_or_descr_arr = [];
      // console.log('kls_use_or_descr_arr has no value')
    }

    if (!loan.kls_age)
      // skip if populated from server since the description will be empty.
      loan.kls_age = getAge(loan.description.texts.en);
  }

  static processLoan(loan) {
    if (typeof loan !== 'object') {
      console.trace('processLoan is not a loan when is this happening.');
      return;
    } // for an ids_only search... should never get called though!

    loan.kl_processed = new Date();
    loan.kl_name_arr = loan.name.toUpperCase().match(/(\w+)/g);
    loan.kl_posted_date = new Date(loan.posted_date);
    loan.kl_newest_sort = loan.kl_posted_date.getTime();
    loan.kl_posted_hours_ago = function() {
      return (new Date() - this.kl_posted_date) / (60 * 60 * 1000);
    }.bind(loan);
    if (!loan.basket_amount) loan.basket_amount = 0;
    if (!loan.funded_amount) loan.funded_amount = 0;
    // eslint-disable-next-line func-names
    loan.kl_dollars_per_hour = function() {
      if (this.status === 'fundraising') {
        return (this.funded_amount + this.basket_amount) / this.kl_posted_hours_ago();
      }
      const hoursFundraising = (new Date(this.funded_date) - this.kl_posted_date) / (60 * 60 * 1000)
      return (this.loan_amount / hoursFundraising);
    }.bind(loan);
    loan.kl_still_needed = function() {
      return Math.max(
        this.loan_amount - this.funded_amount - this.basket_amount,
        0,
        // api can spit back that more is basketed than remains...
      );
    }.bind(loan);
    loan.kl_percent_funded = function() {
      return Math.round(
        (100 * (this.funded_amount + this.basket_amount)) / this.loan_amount,
      );
    }.bind(loan);

    if (Array.isArray(loan.tags))
      // if tags present, always use those.
      // loan.kls_tags = loan.tags.select(tag => tag.name.replace(/\s+/g, '')); // standardize to just an array without a hash.
      loan.kls_tags = loan.tags.map(tag => tag.name); // .replace(/^#/g, '')); // standardize to just an array without a hash.

    if (!loan.kls_tags) loan.kls_tags = [];

    // if (!isServer()) {
    //   loan.getPartner = function() {
    //     if (!this.partner_id) return null; // ZIP loans
    //     // todo: this should not reference kivaloans...
    //     if (!this.kl_partner)
    //       this.kl_partner = kivaloans.getPartner(this.partner_id);
    //     return this.kl_partner;
    //   }.bind(loan);
    // }

    if (loan.kls) {
      // replace what was stripped out by the server before sending down.
      loan.description = loan.description || {
        languages: ['en'],
        texts: { en: '' },
      };
      loan.status = loan.status || 'fundraising';
      // this is clumsy... can't we just populate borrower_count and percent_female?
      // loan.borrowers = Array.range(1, loan.klb.M || 0).map(x => ({
      //   gender: 'M',
      //   first_name: '...',
      // }));
      // loan.borrowers = loan.borrowers.concat(
      //   Array.range(1, loan.klb.F || 0).map(() => ({
      //     gender: 'F',
      //     first_name: '...',
      //   })),
      // );
      if (loan.klb) {
        loan.borrower_count = loan.klb.M + loan.klb.F;
        loan.kl_percent_women = loan.klb.F * 100 / loan.borrower_count
      } else {
        loan.borrower_count = loan.borrowers.length;
        loan.kl_percent_women = loan.borrowers.percentWhere(
          b => b.gender === 'F' || b.gender === 'female',
        );
      }
      loan.kls = false;
    }

    // i don't like this.
    if (typeof loan.kls_half_back === 'string') {
      // true when from kl api
      loan.kls_half_back = new Date(loan.kls_half_back);
      loan.kls_75_back = new Date(loan.kls_75_back);
      loan.kls_final_repayment = new Date(loan.kls_final_repayment);
    }

    if (loan.description.texts) {
      // the presence implies this is a detail result; this doesn't run during the background refresh.
      ResultProcessors.processLoanDescription(loan);

      loan.kl_planned_expiration_date = new Date(loan.planned_expiration_date);
      loan.kl_expiring_in_days = function () {
        return (this.kl_planned_expiration_date - Date.now()) / (24 * 60 * 60 * 1000);
      }.bind(loan)

      loan.kl_disbursal_in_days = function() {
        return (
          (new Date(this.terms.disbursal_date) - Date.now()) /
          (24 * 60 * 60 * 1000)
        );
      }.bind(loan);

      // only works on KIVA REST API.
      loan.kl_percent_women = loan.borrowers.percentWhere(
        b => b.gender === 'F',
      );

      ResultProcessors.processRepaymentData(loan);

      // this calculation needs to be always present.
      loan.kls_repaid_in = function() {
        const today = Date.today();
        return this.kls_final_repayment
          ? Math.abs(
            (this.kls_final_repayment.getFullYear() - today.getFullYear()) *
            12 +
            (this.kls_final_repayment.getMonth() - today.getMonth()),
          )
          : 0;
      }.bind(loan)
      // /REPAYMENT STUFF: END

      // memory clean up, delete all non-english descriptions.
      loan.description.languages
        .filter(lang => lang !== 'en')
        .forEach(lang => delete loan.description.texts[lang]);
      delete loan.terms.local_payments; // we don't care
      delete loan.terms.disbursal_currency;
      delete loan.terms.disbursal_amount;
      delete loan.terms.loan_amount;

      if (!loan.partner_id) loan.partner_id = null;

      // do memory clean up of larger pieces of the loan object.
      if (loan.borrowers)
        // only visible
        loan.borrowers
          .filter(b => b.last_name === '')
          .forEach(b => delete b.last_name);
    }
    // add kivalens specific fields to the loan.
    // extend(loan, addIt)

    delete loan.tags;
    delete loan.journal_totals;
    delete loan.translator;
    delete loan.location.geo;
    delete loan.location.town;
    delete loan.image.template_id;
    if (!loan.bonus_credit_eligibility) delete loan.bonus_credit_eligibility;
    return loan;
  }

  static processPartners(partners) {
    const regionsLU = {
      'North America': 'na',
      'Central America': 'ca',
      'South America': 'sa',
      Africa: 'af',
      Asia: 'as',
      'Middle East': 'me',
      'Eastern Europe': 'ee',
      'Western Europe': 'we',
      Antarctica: 'an',
      Oceania: 'oc',
    };
    partners.forEach(p => {
      p.kl_sp = p.social_performance_strengths
        ? p.social_performance_strengths.map(sp => sp.id)
        : [];
      p.kl_regions = p.countries.map(c => regionsLU[c.region]).distinct();
      p.kl_years_on_kiva =
        (Date.today().getTime() - new Date(p.start_date).getTime()) /
        (365.25 * 24 * 60 * 60000); // in years.
    });
    return partners;
  }

  static processRepaymentData(loan) {
    // /REPAYMENT STUFF: START
    const amount50 = loan.loan_amount * 0.5;
    const amount75 = loan.loan_amount * 0.75;
    loan.kl_repayments = [];

    // some very old loans do not have scheduled payments and ones dl from kl server have them removed now.
    if (
      loan.terms.scheduled_payments &&
      loan.terms.scheduled_payments.length
    ) {
      // replace Kiva's version since it has too many entries.
      if (!loan.kls) {
        loan.terms.scheduled_payments = loan.terms.scheduled_payments
          .groupBy(p => p.due_date)
          .map(g => ({
            due_date: g[0].due_date,
            amount: g.sum(p => p.amount),
          }))
      }
      // for some loans, kiva will spit out non-summarized data and give 4+ repayment records for the same day.
      const repayments = loan.terms.scheduled_payments.map(p => {
        const date = new Date(p.due_date);
        return { date, display: date.toString('MMM-yyyy'), amount: p.amount };
      });

      // fill in the gaps for southern-guy-toothy-shaped repayments.
      let nextDate = new Date(
        Math.min(
          Date.next()
            .month()
            .set({ day: 1 })
            .clearTime(),
          repayments.first().date.clearTime(),
        ),
      );
      const lastDate = repayments.last().date.clearTime();
      while (nextDate <= lastDate) {
        const displayToTest = nextDate.toString('MMM-yyyy');
        const repayment = repayments.first(r => r.display === displayToTest);
        if (!repayment)
          // new Date() because it needs to make a copy of the date object or they all hold a ref.
          repayments.push({
            date: new Date(nextDate.getTime()),
            display: displayToTest,
            amount: 0,
          });
        nextDate = nextDate
          .next()
          .month()
          .set({ day: 1 })
          .clearTime(); // clearTime() to correct for DST bs?
      }
      // remove the leading 0 payment months. ordering needed to get the newly added ones in their proper spot.
      loan.kl_repayments = repayments
        .orderBy(p => p.date)
        .skipWhile(p => p.amount === 0);

      // two fold purpose: added a running percentage for all the repayments and track when the payments hit 50 and 75%
      let runningTotal = 0;
      loan.kl_repayments.forEach(payment => {
        // there's got to be a more accurate algorithm to handle this efficiently...
        runningTotal += payment.amount;
        payment.percent = (runningTotal * 100) / loan.loan_amount;
        if (!loan.kls_half_back && runningTotal >= amount50) {
          loan.kls_half_back = payment.date;
          loan.kls_half_back_actual = parseFloat(
            ((runningTotal * 100) / loan.loan_amount).toFixed(2),
          );
        }
        if (!loan.kls_75_back && runningTotal >= amount75) {
          loan.kls_75_back = payment.date;
          loan.kls_75_back_actual = parseFloat(
            ((runningTotal * 100) / loan.loan_amount).toFixed(2),
          );
        }
      });

      loan.kls_final_repayment = new Date(
        loan.terms.scheduled_payments.last().due_date,
      );
      // loan.kls_final_repayment =  loan.kl_repayments.last().date //doesn't have timezone
      // when looking at really old loans, can be null
    }
    return loan;
  }

  /**
   *
   * @param dynLoan
   * @returns {{terms: *, kl_dyn_updated: number, basket_amount: number, funded_date: *, kls_tags: *, funded_amount: number, loan_amount: number, id: *, status: *}}
   *
   * unlike many other static methods, this does NOT modify the passed in param, you MUST use the return value.
   */
  static processGQLDynLoan(dynLoan) {
    const result = {
      id: dynLoan.id,
      kls_tags: dynLoan.tags,
      basket_amount: parseFloat(dynLoan.loanFundraisingInfo.reservedAmount),
      funded_amount: parseFloat(dynLoan.loanFundraisingInfo.fundedAmount),
      status: dynLoan.status,
      funded_date: dynLoan.raisedDate,
      loan_amount: parseFloat(dynLoan.loanAmount),
      terms: dynLoan.terms, // if not present, no damage.
      kl_dyn_updated: new Date().getTime(),
    };

    if (dynLoan.description) {
      result.description = { texts: { en: dynLoan.description } };
    };

    if (dynLoan.terms)  {
      result.terms.scheduled_payments = dynLoan.terms.scheduled_payments.map(({ due_date, amount }) => ({ due_date, amount: parseFloat(amount) }))
      ResultProcessors.processRepaymentData(result)
    }

    if (dynLoan.borrowers) {
      result.borrowers = dynLoan.borrowers;
      result.kl_percent_women = dynLoan.borrowers.percentWhere(
        b => b.gender === 'female'
      );
    };

    return result;
  }
}

export default ResultProcessors;
