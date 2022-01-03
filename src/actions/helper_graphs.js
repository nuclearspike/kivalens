import extend from 'extend';
import { humanize } from '../utils';
import { basicReverseOrder } from '../utils/linqextras.mjs';
import { HELPER_GRAPH_CLEAR, HELPER_GRAPH_SET } from '../constants';
import performSearch from '../components/Search/performSearch';
import { criteriaSchema } from '../components/CriteriaForm/allOptions';
import { criteriaSetToPreset } from './criteria';

export const getHelperGraphs = props => {
  let field;
  let lookup;
  let presets;
  let selector;
  let title;
  let selected;
  let group;
  let orderGraph = true;

  if (typeof props === 'object') {
    ({ field, lookup, presets, selector, title } = props);
    selected = field || lookup;
  } else {
    // deprecated. always pass a schema object
    selected = props;
    title = humanize(props);
  }

  return (dispatch, getState) => {
    let data;
    const appState = getState();
    const {
      partnerDetails,
      criteria,
      allLoanIds,
      loanDetails,
      helperGraphs,
      atheistList,
      loading,
    } = appState;

    // don't do it again.
    if (
      helperGraphs &&
      helperGraphs.selected &&
      helperGraphs.selected === selected
    ) {
      return;
    }

    const critExcludeSelected = extend(true, {}, criteria); // must do deep copy, or mods to critExcludeSelected alter stored criteria sub objects
    switch (selected) {
      // loan values that need to be killed with an object.
      case 'sectors':
      case 'activities':
      case 'themes':
      case 'tags':
      case 'countries':
        group = 'loan';
        critExcludeSelected.loan[selected] = {};
        break;

      case 'borrower_count':
      case 'percent_female':
      case 'age_mentioned':
        group = 'borrower';
        critExcludeSelected.borrower[selected] = { min: null, max: null };
        break;

      case 'repaid_in':
      case 'loan_amount':
      case 'dollars_per_hour':
      case 'still_needed':
      case 'percent_funded':
      case 'expiring_in_days':
      case 'disbursal':
        orderGraph = false;
        group = 'loan';
        critExcludeSelected.loan[selected] = { min: null, max: null };
        break;

      // loan values that need to be killed with empty arrays
      case 'repayment_interval':
      case 'currency_exchange_loss_liability':
        group = 'loan';
        critExcludeSelected.loan[selected] = [];
        break;

      case 'region':
      case 'social_performance':
        group = 'partner';
        critExcludeSelected.partner[selected] = [];
        break;

      // partner stuff.
      case 'years_on_kiva':
      case 'partner_risk_rating':
      case 'partner_arrears':
      case 'partner_default':
      case 'portfolio_yield':
      case 'profit':
      case 'loans_at_risk_rate':
      case 'currency_exchange_loss_rate':
      case 'average_loan_size_percent_per_capita_income':
      case 'loans_posted':
      case 'secular_rating':
      case 'social_rating':
        group = 'partner';
        critExcludeSelected.partner[selected] = { min: null, max: null };
        break;

      default:
        break;
    }

    // must alter criteria to exclude the thing that's currently selected.
    const loans = performSearch(
      {
        partnerDetails,
        criteria: critExcludeSelected,
        allLoanIds,
        loanDetails,
        atheistList,
        loading,
      },
      'loans',
    );

    const minMaxGroupCounts = (pGroup, critField) => {
      return presets.map(preset => {
        const presetCriteria = extend(true, {}, critExcludeSelected);
        presetCriteria[pGroup][critField] = {
          min: preset.min,
          max: preset.max,
        };
        const ids = performSearch({
          partnerDetails,
          criteria: presetCriteria,
          allLoanIds,
          loanDetails,
          atheistList,
          loading,
        });
        return {
          name: preset.name,
          count: ids.length,
        };
      });
    };

    const minMaxGroupCounts2 = (pGroup, critField) => {
      const figurePresets = loan => {
        const {
          presets: critPresets,
          selector: loanField,
        } = criteriaSchema.properties[pGroup].properties[critField];

        return critPresets
          .filter(p => {
            const value = loanField(loan);
            // remember we are removing presets, do not use >=/<= or it messes everything up.
            if (p.min !== null && p.min > value) {
              return false;
            }
            return !(p.max !== null && p.max < value);
          })
          .map(p => p.name);
      };

      const grouped = performSearch(
        {
          partnerDetails,
          criteria: critExcludeSelected,
          allLoanIds,
          loanDetails,
          atheistList,
          loading,
        },
        'loans',
      )
        .map(figurePresets)
        .flatten()
        .groupByWithCount();

      return presets.map(p => grouped.first(g => p.name === g.name)).nonBlank();
    };

    switch (selected) {
      case 'borrower_count':
      case 'percent_female':
      case 'age_mentioned':
        group = 'borrower';
        data = minMaxGroupCounts2('borrower', field);
        break;

      case 'repaid_in':
      case 'loan_amount':
      case 'dollars_per_hour':
      case 'still_needed':
      case 'percent_funded':
      case 'expiring_in_days':
      case 'disbursal':
        group = 'loan';
        data = minMaxGroupCounts('loan', field);
        break;

      // PARTNER STUFF
      case 'years_on_kiva':
      case 'partner_risk_rating':
      case 'partner_arrears':
      case 'partner_default':
      case 'portfolio_yield':
      case 'profit':
      case 'loans_at_risk_rate':
      case 'currency_exchange_loss_rate':
      case 'average_loan_size_percent_per_capita_income':
      case 'loans_posted':
      case 'secular_rating':
      case 'social_rating':
        orderGraph = false;
        group = 'partner';
        data = minMaxGroupCounts('partner', field);
        break;

      case 'countries':
      case 'sectors':
      case 'activities':
      case 'currency_exchange_loss_liability':
      case 'bonus_credit_eligibility':
        group = 'loan';
        data = loans.groupByWithCount(selector);
        break;

      case 'tags':
        group = 'loan';
        data = loans
          .map(l => l.kls_tags)
          .flatten()
          .groupByWithCount(t => humanize(t));
        break;
      case 'themes':
        group = 'loan';
        data = loans
          .map(l => l.themes)
          .flatten()
          .filter(t => t !== undefined)
          .groupByWithCount();
        break;
      case 'direct':
        group = 'partner';
        data = loans.groupByWithCount(l =>
          l.partner_id == null ? 'Direct' : 'MFI',
        );
        break;
      case 'repayment_interval':
        group = 'partner';
        data = loans.groupByWithCount(l =>
          l.terms.repayment_interval ? l.terms.repayment_interval : 'unknown',
        );
        break;
      case 'social_performance':
        group = 'partner';
        data = loans
          .map(l => {
            const p = partnerDetails[l.partner_id];
            return p ? p.social_performance_strengths : [];
          })
          .flatten()
          .filter(sp => sp !== undefined)
          .groupByWithCount(sp => sp.name);
        break;
      case 'partners':
        group = 'partner';
        data = loans
          .map(l => {
            const p = partnerDetails[l.partner_id];
            return p ? p.name : null;
          })
          .groupByWithCount();
        break;
      case 'region': // this won't come out with the right number of loans....
        group = 'partner';
        data = loans
          .map(l => {
            const p = partnerDetails[l.partner_id];
            return p ? p.countries : [];
          })
          .flatten()
          .map(c => c.region)
          .groupByWithCount();
        break;
      case 'charges_fees_and_interest':
        group = 'partner';
        data = loans
          .map(l => {
            const p = partnerDetails[l.partner_id];
            return p ? p.charges_fees_and_interest : null;
          })
          .groupByWithCount();
        break;
      default:
        return;
    }

    data = data.filter(d => d.count !== 0);

    if (orderGraph) {
      // const graphMin = data.first(d => d.count !== 0);
      data = data.orderBy(d => d.count, basicReverseOrder);
    }

    function onBarClick() {
      dispatch(criteriaSetToPreset(group, selected, this.category));
    }

    const height = Math.max(
      300,
      Math.min(data.length * 30, window.innerHeight),
    );

    const config = {
      chart: {
        type: 'bar',
        animation: false,
        renderTo: 'loan_options_graph',
        height,
      },
      title: { text: title }, // allOptions[selected].label
      xAxis: {
        categories: data.map(d => d.name),
        title: { text: null },
      },
      yAxis: {
        min: 0,
        dataLabels: { enabled: false },
        labels: { overflow: 'justify' },
        title: { text: 'Matching Loans' },
      },
      plotOptions: {
        series: {
          point: {
            events: {
              click: onBarClick,
            },
          },
        },
        bar: {
          dataLabels: {
            enabled: true,
            format: '{y:.0f}',
          },
        },
      },
      legend: { enabled: false },
      credits: { enabled: false },
      series: [
        {
          animation: false,
          name: 'Loans',
          data: data.map(d => d.count),
        },
      ],
    };

    dispatch({
      type: HELPER_GRAPH_SET,
      payload: { config, selected, visible: true },
    });
  };
};

// export const selectFieldForHelperGraphs = selected => {
//   return (dispatch) => {
//     dispatch(getHelperGraphs(selected));
//   };
// };

export const clearHelperGraphs = () => ({
  type: HELPER_GRAPH_CLEAR,
});
