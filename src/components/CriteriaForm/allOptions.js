import React from 'react';
import PT from 'prop-types';
import { Col, Row } from '../bs';
import HoverOver from '../Common/HoverOver';
import { AllAnyNoneSelectorField, MultiSelectField } from './AllAnyNoneField';
import MinMaxField from './MinMaxField';
import StringCriteriaField from './StringCriteriaField';
import PartialExactSelectorField from './PartialExactSelectorField';

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
        partial_exact: {
          type: 'string',
          default: 'partial',
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
            "Text entered allows for partial searches, so 'chris' will find 'christopher', 'christina', etc.",
          $ref: '#/definitions/string_partial_exact',
        },
        borrower_count: {
          title: 'Borrower Count',
          description:
            'The number of borrowers included in the loan. To see only individual loans, set the max to 1. To see only group loans, set the min to 2 and the max at the far right.',
          min: 1,
          max: 20,
          $ref: '#/definitions/double_range',
        },
        percent_female: {
          title: 'Percent Female',
          description:
            "What percentage of the borrowers are female. For individual borrowers, the loan will either be 0% or 100%. On Kiva, a group is considered 'Female' if more than half of the members are women. So you can set the lower bound to 50% and the upper to 100% to mimic that behavior. Additionally, you could look for groups that are 100% female, or set the lower to 40% and upper to 60% to find groups that are about evenly mixed.",
          min: 0,
          max: 100,
          $ref: '#/definitions/double_range',
        },
        age_mentioned: {
          title: 'Age Mentioned',
          description:
            "KivaLens looks for variations of the pattern '20-99 year(s) old' in the description and uses the first one mentioned... which may be the age of the borrower's parent or child. Read the description to double-check it! More than half of the loans have ages that can be pulled out, but many cannot. You must set the lower slider to something other than 'min' or loans with no ages found will be included as well.",
          min: 19,
          max: 100,
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
            "Kiva has a 'loan use' (very short) as well as the long description for the loan. Text entered will do partial searches so 'build' will find 'build', 'building', and 'builder'.",
          $ref: '#/definitions/string_partial_exact',
        },
        repaid_in: {
          title: 'Repaid In (months)',
          description:
            "The number of months between today and the final scheduled repayment. Kiva's sort by repayment terms, which is how many months the borrower has to pay back, creates sorting and filtering issues due to when the loan was posted and the disbursal date. KivaLens just looks at the final scheduled repayment date relative to today.",
          min: 2,
          max: 90,
          $ref: '#/definitions/double_range',
        },
        loan_amount: {
          title: 'Loan Amount ($)',
          description:
            'How much is the loan for? Smaller loans are given to poorer people, so this can help you to focus on either large loans from established borrowers or smaller loans.',
          min: 0,
          max: 10000,
          step: 25,
          $ref: '#/definitions/double_range',
        },
        dollars_per_hour: {
          title: '$/Hour',
          description:
            'Funded Amounts + Basket Amounts / Time since posting. Find the fastest funding loans.',
          min: 0,
          max: 500,
          $ref: '#/definitions/double_range',
        },
        still_needed: {
          title: 'Still Needed ($)',
          description:
            'How much is still needed to fully fund the loan. Loan Amount - Funded Amount - Basket Amount. Set the lower bound to $25 to exclude loans that are fully funded with basket amounts. Set both the lower and upper bound to $25 to find loans where they just need one more lender.',
          min: 0,
          max: 1000,
          step: 25,
          $ref: '#/definitions/double_range',
        },
        percent_funded: {
          title: 'Funded (%)',
          description:
            'What percent of the loan has already been funded (includes amounts in baskets)',
          min: 0,
          max: 100,
          step: 1,
          $ref: '#/definitions/double_range',
        },
        expiring_in_days: {
          title: 'Expiring (days)',
          description:
            'The number of days left before the loan expires if not funded.',
          min: 0,
          max: 35,
          $ref: '#/definitions/double_range',
        },
        disbursal: {
          title: 'Disbursal (days)',
          description:
            'Relative to today, when does the borrower get the money? Negative days mean the borrower already has the money and the Kiva loan is used to back-fill the loan from the MFI rather than making the borrower wait for fundraising. Positive days mean the borrower does not yet have the money.',
          min: -90,
          max: 90,
          $ref: '#/definitions/double_range',
        },
        sectors: {
          title: 'Sectors',
          $ref: '#/definitions/any_none',
          defaultAan: 'any',
        },
        activities: {
          title: 'Activities',
          $ref: '#/definitions/any_none',
          defaultAan: 'any',
        },
        themes: {
          title: 'Themes',
          $ref: '#/definitions/all_any_none',
          defaultAan: 'any',
        },
        tags: {
          title: 'Tags',
          $ref: '#/definitions/all_any_none',
          defaultAan: 'any',
        },
        countries: {
          title: 'Countries',
          $ref: '#/definitions/any_none',
          defaultAan: 'any',
        },
        currency_loss: {
          title: 'Currency Loss',
          type: 'string',
          default: '',
        },
        bonus_credit: {
          title: 'Bonus Credit',
          type: 'string',
          default: '',
        },
        repayment_interval: {
          title: 'Repayment Interval',
          type: 'string',
        },
      },
    },
    partner: {
      type: 'object',
      title: 'Partner',
      properties: {
        name: {
          title: 'Name',
          $ref: '#/definitions/string_partial_exact',
        },
      },
    },
    balancing: {
      type: 'object',
      title: 'Balancing',
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
        },
      },
    },
  },
};

function TwoFieldObjectFieldTemplate({ title, description, properties }) {
  if (properties.length !== 2)
    throw new Error(`Too few/many properties: ${title}`);
  return (
    <>
      <HoverOver title={title} description={description} />
      <Row>
        <Col xs={2}>{properties[0].content}</Col>
        <Col xs={10}>{properties[1].content}</Col>
      </Row>
    </>
  );
}

TwoFieldObjectFieldTemplate.propTypes = {
  title: PT.string.isRequired,
  description: PT.string,
  properties: PT.arrayOf(
    PT.shape({
      content: PT.string,
    }).isRequired,
  ).isRequired,
};

TwoFieldObjectFieldTemplate.defaultProps = {
  description: null,
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
  partial_exact: {
    'ui:field': PartialExactSelectorField,
  },
  text: {
    'ui:field': StringCriteriaField,
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
  },
  partner: {
    name: PartialExactUiSchema,
  },
};
