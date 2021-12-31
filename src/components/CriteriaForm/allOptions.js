import React from 'react';
import { AllAnyNoneSelectorField, MultiSelectField } from './AllAnyNoneField';
import MinMaxField from './MinMaxField';
import StringCriteriaField from './StringCriteriaField';
import PartialExactSelectorField from './StartsWithExactSelectorField';
import TwoFieldObjectFieldTemplate from './TwoFieldObjectFieldTemplate';
import SelectMultiField from './SelectMultiField';
import SelectSingleField from './SelectSingleField';
import AnyAllSelectorField from './AnyAllSelectorField';

const buildPresets = (
  low,
  high,
  step = 10,
  append = '%',
  minIsNull = true,
  maxIsNull = true,
) => {
  const result = [];
  for (let i = low; i < high; i += step) {
    result.push({
      name: `${i} to ${i + step}${append}`,
      min: low === i && minIsNull ? null : i,
      max: high === i + step && maxIsNull ? null : i + step,
    });
  }
  // console.log(result);
  return result;
};

export const criteriaSchema = {
  definitions: {
    all_any_none: {
      type: 'object',
      properties: {
        aan: {
          type: 'string',
          default: 'all',
          canAll: true,
        },
        value: {
          type: 'array',
          items: {
            type: 'string',
          },
        },
      },
    },
    any_none: {
      type: 'object',
      properties: {
        aan: {
          type: 'string',
          default: 'any',
          canAll: false,
        },
        value: {
          type: 'array',
          items: {
            type: 'string',
          },
        },
      },
    },
    double_range: {
      type: 'object',
      properties: {
        min: {
          type: ['integer', 'null'],
        },
        max: {
          type: ['integer', 'null'],
        },
      },
    },
    string_partial_exact: {
      type: 'object',
      properties: {
        startswith_exact: {
          type: 'string',
          default: 'starts_With',
        },
        any_all: {
          type: 'string',
          default: 'any',
        },
        text: {
          type: 'string',
        },
      },
    },
  },
  type: 'object',
  title: 'Criteria',
  hide_title: true,
  properties: {
    borrower: {
      type: 'object',
      title: 'Borrower',
      properties: {
        name: {
          title: 'Name',
          description:
            "Text entered allows for either starts-with or exact searches. With 'starts with' 'chris' will find 'christopher', 'christina', etc. With 'exact' then 'chris' will only with only 'chris' not 'christopher' or 'christina'.",
          $ref: '#/definitions/string_partial_exact',
        },
        borrower_count: {
          title: 'Borrower Count',
          field: 'borrower_count',
          selector: l => l.borrower_count,
          description:
            'The number of borrowers included in the loan. To see only individual loans, set the max to 1. To see only group loans, set the min to 2 and the max at the far right.',
          min: 1,
          max: 20,
          step: 1,
          presets: [
            { name: 'Individuals', min: null, max: 1 },
            { name: 'Groups (any size)', min: 2, max: null },
            { name: 'Large Groups (10+)', min: 10, max: null },
          ],
          $ref: '#/definitions/double_range',
        },
        percent_female: {
          title: 'Percent Female',
          field: 'percent_female',
          selector: l => l.percent_female,
          description:
            "What percentage of the borrowers are female. For individual borrowers, the loan will either be 0% or 100%. On Kiva, a group is considered 'Female' if more than half of the members are women. So you can set the lower bound to 50% and the upper to 100% to mimic that behavior. Additionally, you could look for groups that are 100% female, or set the lower to 40% and upper to 60% to find groups that are about evenly mixed.",
          min: 0,
          max: 100,
          presets: [
            { name: 'Only Women', min: 100, max: null },
            { name: 'Mostly Women', min: 60, max: null },
            { name: 'About Evenly Split', min: 40, max: 60 },
            { name: 'Mostly Men', min: null, max: 40 },
            { name: 'Only Men', min: null, max: 1 },
          ],
          $ref: '#/definitions/double_range',
        },
        age_mentioned: {
          title: 'Age Mentioned',
          field: 'age_mentioned',
          selector: l => l.age_mentioned,
          description:
            "KivaLens looks for variations of the pattern '20-99 year(s) old' in the description and uses the first one mentioned... which may be the age of the borrower's parent or child. Read the description to double-check it! More than half of the loans have ages that can be pulled out, but many cannot. You must set the lower slider to something other than 'min' or loans with no ages found will be included as well.",
          min: 19,
          max: 100,
          presets: [
            { name: 'No Age Mentioned', min: null, max: 19 },
            { name: 'Twenties (20-29)', min: 20, max: 29 },
            { name: 'Thirties (30-39)', min: 30, max: 39 },
            { name: 'Middle Aged (40-59)', min: 40, max: 59 },
            { name: 'Elderly (60+)', min: 60, max: null },
          ],
          $ref: '#/definitions/double_range',
        },
      },
    },
    loan: {
      type: 'object',
      title: 'Loan',
      properties: {
        use_or_description: {
          title: 'Use or Description',
          description:
            "Kiva has a 'loan use' (very short) as well as the long description for the loan..",
          $ref: '#/definitions/string_partial_exact',
        },
        repaid_in: {
          title: 'Repaid In (months)',
          field: 'repaid_in',
          description:
            "The number of months between today and the final scheduled repayment. Kiva's sort by repayment terms, which is how many months the borrower has to pay back, creates sorting and filtering issues due to when the loan was posted and the disbursal date. KivaLens just looks at the final scheduled repayment date relative to today.",
          min: 0,
          max: 90,
          presets: [
            { name: 'Short Term (<= 6mo)', min: null, max: 6 },
            { name: 'Within a Year (<= 12mo)', min: null, max: 12 },
            { name: 'Within 2 Years (<= 24mo)', min: null, max: 24 },
            { name: 'More than 2 Years (>= 24mo)', min: 24, max: null },
          ],
          $ref: '#/definitions/double_range',
        },
        loan_amount: {
          title: 'Loan Amount ($)',
          field: 'loan_amount',
          description:
            'How much is the loan for? Smaller loans are given to poorer people, so this can help you to focus on either large loans from established borrowers or smaller loans.',
          min: 0,
          max: 10000,
          step: 25,
          $ref: '#/definitions/double_range',
          presets: [
            { name: '< $200', min: null, max: 200 },
            { name: '$200 - $500', min: 200, max: 500 },
            { name: '$500 - $750', min: 500, max: 750 },
            { name: '$750 - $1K', min: 750, max: 1000 },
            { name: '$1K - $2K', min: 1000, max: 2000 },
            { name: '$2K - $3K', min: 2000, max: 3000 },
            { name: '$3K +', min: 3000, max: null },
          ],
        },
        dollars_per_hour: {
          title: '$/Hour',
          field: 'dollars_per_hour',
          description:
            'Funded Amounts + Basket Amounts / Time since posting. Find the fastest funding loans.',
          min: 0,
          max: 500,
          $ref: '#/definitions/double_range',
          presets: [
            { name: 'Zero', min: null, max: 0 },
            { name: '1-5', min: 1, max: 5 },
            ...buildPresets(5, 40, 5, '', false, false),
            ...buildPresets(40, 500, 20, '', false, true),
          ],
        },
        still_needed: {
          title: 'Still Needed ($)',
          field: 'still_needed',
          description:
            'How much is still needed to fully fund the loan. Loan Amount - Funded Amount - Basket Amount. Set the lower bound to $25 to exclude loans that are fully funded with basket amounts. Set both the lower and upper bound to $25 to find loans where they just need one more lender.',
          min: 0,
          max: 1000,
          step: 25,
          presets: [
            { name: 'Only one more lender needed', min: null, max: 25 },
            { name: 'Still needs lenders', min: 25, max: null },
            { name: 'Fully funded (including baskets)', min: null, max: 0 },
          ],
          $ref: '#/definitions/double_range',
        },
        percent_funded: {
          title: 'Funded (%)',
          field: 'percent_funded',
          description:
            'What percent of the loan has already been funded (includes amounts in baskets)',
          min: 0,
          max: 100,
          step: 1,
          $ref: '#/definitions/double_range',
          presets: buildPresets(0, 100, 5),
        },
        expiring_in_days: {
          title: 'Expiring (days)',
          field: 'expiring_in_days',
          description:
            'The number of days left before the loan expires if not funded.',
          min: 0,
          max: 35,
          presets: [
            { name: 'Expiring today!', min: null, max: 1 },
            { name: 'Expiring within 2 days', min: null, max: 2 },
            { name: 'Expiring within 7 days', min: null, max: 7 },
            { name: 'Expiring between 7 - 14 days', min: 7, max: 14 },
            { name: 'Expiring between 14 - 30 days', min: 14, max: 30 },
            { name: 'Expiring in over a month', min: 30, max: null },
          ],
          $ref: '#/definitions/double_range',
        },
        disbursal: {
          title: 'Disbursal (days)',
          field: 'disbursal',
          description:
            'Relative to today, when does the borrower get the money? Negative days mean the borrower already has the money and the Kiva loan is used to back-fill the loan from the MFI rather than making the borrower wait for fundraising. Positive days mean the borrower does not yet have the money.',
          min: -90,
          max: 90,
          $ref: '#/definitions/double_range',
          presets: buildPresets(-90, 90, 10, ''),
        },
        sectors: {
          title: 'Sectors',
          $ref: '#/definitions/any_none',
          defaultAan: 'any',
          lookup: 'sectors',
          selector: l => l.sector,
        },
        activities: {
          title: 'Activities',
          $ref: '#/definitions/any_none',
          defaultAan: 'any',
          lookup: 'activities',
          selector: l => l.activity,
        },
        themes: {
          title: 'Themes',
          $ref: '#/definitions/all_any_none',
          defaultAan: 'any',
          lookup: 'themes',
        },
        tags: {
          title: 'Tags',
          $ref: '#/definitions/all_any_none',
          defaultAan: 'any',
          lookup: 'tags',
        },
        countries: {
          title: 'Countries',
          $ref: '#/definitions/any_none',
          defaultAan: 'any',
          lookup: 'countries',
          selector: l => l.location.country,
        },
        currency_exchange_loss_liability: {
          title: 'Currency Loss',
          field: 'currency_exchange_loss_liability',
          type: 'string',
          default: '',
          selector: l => l.terms.loss_liability.currency_exchange,
          enum: ['shared', 'none', 'partner', 'lender'],
          enumNames: [
            'Shared Loss',
            'No Currency Exchange Loss',
            'Partner Covers',
            'Lender Covers',
          ],
        },
        bonus_credit_eligibility: {
          title: 'Bonus Credit (not implemented)',
          type: 'string',
          field: 'bonus_credit_eligibility',
          default: null,
          enum: [null, true, false],
          selector: l => l.bonus_credit_eligibility === true,
          enumNames: [
            'Show All',
            'Only loans eligible',
            'Only loans NOT eligible',
          ],
        },
        repayment_interval: {
          title: 'Repayment Interval',
          field: 'repayment_interval',
          type: 'string',
          enum: ['Monthly', 'Irregularly', 'At end of term'],
        },
      },
    },
    partner: {
      type: 'object',
      title: 'Partner',
      properties: {
        name: {
          title: 'Name (not implemented)',
          $ref: '#/definitions/string_partial_exact',
        },
        partner_risk_rating: {
          title: 'Risk Rating (stars)',
          field: 'partner_risk_rating',
          $ref: '#/definitions/double_range',
          description:
            '5 star means that Kiva has estimated that the *institution servicing the loan* has very low probability of collapse, it does not indicate faith in individual borrowers or groups. 1 star means the partner may be new and untested. To include unrated partners, have the left-most slider all the way at left.',
          min: 0,
          max: 5,
          step: 0.5,
          presets: [
            {
              name: 'Least likely for institutional default (4.5+)',
              min: 4.5,
              max: null,
            },
            { name: 'Pretty safe MFIs (4+)', min: 4, max: null },
            { name: 'Established (3+)', min: 3, max: null },
            { name: 'Unproven (1)', min: null, max: 1 },
          ],
        },
        partner_arrears: {
          title: 'Delinq Rate (%)',
          field: 'partner_arrears',
          $ref: '#/definitions/double_range',
          description:
            'Kiva defines the Delinquency (Arrears) Rate as the amount of late payments divided by the total outstanding principal balance Kiva has with the Field Partner. Arrears can result from late repayments from Kiva borrowers as well as delayed payments from the Field Partner.  How this is calculated: Delinquency (Arrears) Rate = Amount of Paying Back Loans Delinquent / Amount Outstanding',
          min: 0,
          max: 50,
          step: 0.1,
          presets: [
            ...buildPresets(1, 5, 1, '%', true, false),
            ...buildPresets(5, 50, 5, '%', false),
          ],
        },
        partner_default: {
          title: 'Default Rate (%)',
          field: 'partner_default',
          $ref: '#/definitions/double_range',
          description:
            "The default rate is the percentage of ended loans (no longer paying back) which have failed to repay (measured in dollar volume, not units). How this is calculated: Default Rate = Amount of Ended Loans Defaulted / Amount of Ended Loans. For more information, please refer to Kiva's Help Center. ",
          min: 0,
          max: 15,
          step: 0.1,
          presets: buildPresets(0, 15, 1),
        },
        portfolio_yield: {
          title: 'Portfolio Yield (%)',
          field: 'portfolio_yield',
          $ref: '#/definitions/double_range',
          description:
            "Although Kiva and its lenders don't charge interest or fees to borrowers, many of Kiva's Field Partners do charge borrowers in some form in order to make possible the long-term sustainability of their operations, reach and impact. See Kiva for more information on Portfolio Yield. Also, see the About page, Reducing Risk section to understand why high Portfolio Yields are often to the poorest borrowers.",
          min: 0,
          max: 100,
          step: 0.1,
          presets: buildPresets(0, 100, 5),
        },
        profit: {
          title: 'Profit (%)',
          field: 'profit',
          $ref: '#/definitions/double_range',
          description:
            "'Return on Assets' is an indication of a Field Partner's profitability. It can also be an indicator of the long-term sustainability of an organization, as organizations consistently operating at a loss (those that have a negative return on assets) may not be able to sustain their operations over time unless they are receiving outside funding.",
          min: -100,
          max: 100,
          step: 0.1,
          presets: buildPresets(-100, 100),
        },
        loans_at_risk_rate: {
          title: 'Loans at Risk (%)',
          field: 'loans_at_risk_rate',
          $ref: '#/definitions/double_range',
          description:
            'The loans at risk rate refers to the percentage of Kiva loans being paid back by this Field Partner that are past due in repayment by at least 1 day. This delinquency can be due to either non-payment by Kiva borrowers or non-payment by the Field Partner itself. Loans at Risk Rate = Amount of paying back loans that are past due / Total amount of Kiva loans outstanding',
          min: 0,
          max: 100,
          presets: [
            ...buildPresets(0, 20, 2, '%', true, false),
            ...buildPresets(20, 100, 10, '%', false),
          ],
        },
        currency_exchange_loss_rate: {
          title: 'Currency Exchange Loss (%)',
          field: 'currency_exchange_loss_rate',
          $ref: '#/definitions/double_range',
          description:
            'Kiva calculates the Currency Exchange Loss Rate for its Field Partners as: Amount of Currency Exchange Loss / Total Loans.',
          min: 0,
          max: 10,
          step: 0.1,
          presets: buildPresets(0, 10, 1),
        },
        average_loan_size_percent_per_capita_income: {
          title: 'Average Loan/Capita Income',
          field: 'average_loan_size_percent_per_capita_income',
          $ref: '#/definitions/double_range',
          description:
            "The Field Partner's average loan size is expressed as a percentage of the country's gross national annual income per capita. Loans that are smaller (that is, as a lower percentage of gross national income per capita) are generally made to more economically disadvantaged populations. However, these same loans are generally more costly for the Field Partner to originate, disburse and collect.",
          min: 0,
          max: 300,
          presets: buildPresets(0, 300, 20),
        },
        years_on_kiva: {
          title: 'Years on Kiva',
          field: 'years_on_kiva',
          $ref: '#/definitions/double_range',
          description: 'How long the partner has been posting loans on Kiva.',
          min: 0,
          max: 20,
          step: 0.25,
          presets: [
            { name: 'Brand New (<= 1yr)', min: null, max: 1 },
            { name: 'Relatively New (<= 5yr)', min: null, max: 5 },
            { name: 'Less than 10 yr (<= 10yr)', min: null, max: 10 },
            { name: 'Long Term (>= 10 yr)', min: 10, max: null },
            { name: 'Very Long Term (>= 15 yr)', min: 15, max: null },
          ],
        },
        loans_posted: {
          title: 'Loans Posted',
          field: 'loans_posted',
          $ref: '#/definitions/double_range',
          description: 'How many loans the partner has posted to Kiva.',
          min: 0,
          max: 100000,
          step: 50,
          presets: buildPresets(0, 100000, 10000, ' loans'),
        },
        secular_rating: {
          title: 'Secular Score (Atheist List)',
          field: 'secular_rating',
          $ref: '#/definitions/double_range',
          description:
            '4 Completely secular, 3 Secular but with some religious influence (e.g. a secular MFI that partners with someone like World Vision), or it appears secular but with some uncertainty, 2 Nonsecular but loans without regard to borrower’s beliefs, 1 Nonsecular with a religious agenda.',
          min: 1,
          max: 4,
          step: 1,
          presets: [
            { name: 'Secular Only (4)', min: 4, max: null },
            {
              name: 'Mostly secular but mildly religious (>= 3)',
              min: 3,
              max: null,
            },
            {
              name: 'Religious as well as Not entirely religious (<= 2)',
              min: null,
              max: 2,
            },
            { name: 'Religious Only (1)', min: null, max: 1 },
          ],
        },
        social_rating: {
          title: 'Social Score (Atheist List)',
          field: 'social_rating',
          $ref: '#/definitions/double_range',
          description:
            '4 Excellent social initiatives - proactive social programs and efforts outside of lending. Truly outstanding social activities. 3 Good social initiatives in most areas. MFI has some formal and structured social programs. 2 Social goals but no/few initiatives (may have savings, business counseling). 1 No attention to social goals or initiatives. Typically the MFI only focuses on their own business issues (profitability etc.). They might mention social goals but it seems to be there just because it’s the right thing to say (politically correct).',
          min: 1,
          max: 4,
          step: 1,
          presets: [
            { name: 'Excellent social initiatives (4)', min: 4, max: 4 },
            {
              name: 'Good social initiatives in most areas (3)',
              min: 3,
              max: 3,
            },
            {
              name: 'Social goals without intiatives (2)',
              min: 2,
              max: 2,
            },
            { name: 'No attention to social goals (1)', min: 1, max: 1 },
          ],
        },
      },
    },
    balancing: {
      type: 'object',
      title: 'Balancing (not implemented)',
      description: '',
      properties: {},
    },
    results: {
      type: 'object',
      title: 'Results',
      properties: {
        sort: {
          title: 'Sort',
          type: 'string',
          enum: [
            '',
            'half_back',
            'newest',
            'expiring',
            'popularity',
            'still_needed',
          ],
          enumNames: [
            'Final repayment date (default)',
            'Date half is paid back, then 75%, then full',
            'Newest',
            'Expiring',
            'Popularity ($/hour)',
            '$ Still Needed',
          ],
        },
        limit_to_top: {
          type: 'object',
          title: 'Limit to top (not implemented)',
          properties: {
            enabled: {
              title: 'Enabled',
              type: 'boolean',
            },
            count: {
              title: 'Count',
              type: 'integer',
            },
            per: {
              title: 'Per',
              type: 'string',
            },
          },
        },
      },
    },
  },
};

const AANUiSchema = {
  'ui:ObjectFieldTemplate': TwoFieldObjectFieldTemplate,
  aan: {
    'ui:field': AllAnyNoneSelectorField,
  },
  value: {
    'ui:field': MultiSelectField,
  },
};

const PartialExactUiSchema = {
  'ui:ObjectFieldTemplate': TwoFieldObjectFieldTemplate,
  startswith_exact: {
    'ui:field': PartialExactSelectorField,
  },
  any_all: {
    'ui:field': AnyAllSelectorField,
  },
  text: {
    'ui:field': StringCriteriaField,
    'ui:placeholder': 'Use a space between multiple words',
  },
};

export const uiCriteriaSchema = {
  borrower: {
    name: PartialExactUiSchema,
    borrower_count: {
      'ui:field': MinMaxField,
    },
    percent_female: {
      'ui:field': MinMaxField,
    },
    age_mentioned: {
      'ui:field': MinMaxField,
    },
  },
  loan: {
    use_or_description: PartialExactUiSchema,
    sectors: AANUiSchema,
    activities: AANUiSchema,
    themes: AANUiSchema,
    tags: AANUiSchema,
    countries: AANUiSchema,
    repaid_in: {
      'ui:field': MinMaxField,
    },
    loan_amount: {
      'ui:field': MinMaxField,
    },
    dollars_per_hour: {
      'ui:field': MinMaxField,
    },
    still_needed: {
      'ui:field': MinMaxField,
    },
    percent_funded: {
      'ui:field': MinMaxField,
    },
    expiring_in_days: {
      'ui:field': MinMaxField,
    },
    disbursal: {
      'ui:field': MinMaxField,
    },
    repayment_interval: {
      'ui:field': SelectMultiField,
    },
    currency_exchange_loss_liability: {
      'ui:field': SelectMultiField,
    },
    bonus_credit_eligibility: {
      'ui:field': SelectSingleField,
    },
  },
  partner: {
    name: PartialExactUiSchema,
    // region, social perf, partners?
    partner_risk_rating: { 'ui:field': MinMaxField },
    partner_arrears: { 'ui:field': MinMaxField },
    partner_default: { 'ui:field': MinMaxField },
    portfolio_yield: { 'ui:field': MinMaxField },
    profit: { 'ui:field': MinMaxField },
    loans_at_risk_rate: { 'ui:field': MinMaxField },
    currency_exchange_loss_rate: { 'ui:field': MinMaxField },
    average_loan_size_percent_per_capita_income: { 'ui:field': MinMaxField },
    years_on_kiva: { 'ui:field': MinMaxField },
    loans_posted: { 'ui:field': MinMaxField },
    secular_rating: { 'ui:field': MinMaxField },
    social_rating: { 'ui:field': MinMaxField },
  },
  results: {
    sort: {
      'ui:field': SelectSingleField,
    },
  },
};
