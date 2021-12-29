import extend from 'extend';
import { humanize } from '../utils';
import { basicReverseOrder } from '../utils/linqextras.mjs';
import { HELPER_GRAPH_CLEAR, HELPER_GRAPH_SET } from '../constants';
import performSearch from '../components/Search/performSearch';

export const getHelperGraphs = props => {
  let field;
  let lookup;
  let presets;
  let selector;
  let title;
  let selected;

  if (typeof props === 'object') {
    ({ field, lookup, presets, selector, title } = props);
    selected = field || lookup;
  } else {
    // phase out!
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
        critExcludeSelected.loan[selected] = {};
        break;

      case 'borrower_count':
      case 'percent_female':
      case 'age_mentioned':
        critExcludeSelected.borrower[selected] = { min: null, max: null };
        break;

      // loan values that need to be killed with empty arrays
      case 'repayment_interval':
      case 'currency_exchange_loss_liability':
        critExcludeSelected.loan[selected] = [];
        break;

      // partner stuff.
      case 'years_on_kiva':
      case 'secular_rating':
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
      },
      'loans',
    );

    const minMaxGroupCounts = (group, critField) => {
      return presets.map(preset => {
        const presetCriteria = extend(true, {}, critExcludeSelected);
        presetCriteria[group][critField] = {
          min: preset.min,
          max: preset.max,
        };
        const ids = performSearch({
          partnerDetails,
          criteria: presetCriteria,
          allLoanIds,
          loanDetails,
          atheistList,
        });
        return {
          name: preset.name,
          count: ids.length,
        };
      });
    };

    switch (selected) {
      case 'borrower_count':
      case 'percent_female':
      case 'age_mentioned':
        data = minMaxGroupCounts('borrower', field);
        break;

      case 'repaid_in':
      case 'still_needed':
      case 'expiring_in_days':
        // case 'loan_amount':
        // case 'dollars_per_hour':
        data = minMaxGroupCounts('loan', field);
        break;

      case 'years_on_kiva':
      case 'secular_rating':
        data = minMaxGroupCounts('partner', field);
        break;

      case 'countries':
        data = loans.groupByWithCount(l => l.location.country);
        break;
      case 'sectors':
        data = loans.groupByWithCount(l => l.sector);
        break;
      case 'activities':
        data = loans.groupByWithCount(l => l.activity);
        break;

      case 'tags':
        data = loans
          .map(l => l.kls_tags)
          .flatten()
          .groupByWithCount(t => humanize(t));
        break;
      case 'themes':
        data = loans
          .map(l => l.themes)
          .flatten()
          .filter(t => t !== undefined)
          .groupByWithCount();
        break;
      case 'currency_exchange_loss_liability':
        data = loans.groupByWithCount(
          l => l.terms.loss_liability.currency_exchange,
        );
        break;
      case 'bonus_credit_eligibility':
        data = loans.groupByWithCount(l => l.bonus_credit_eligibility === true);
        break;
      case 'direct':
        data = loans.groupByWithCount(l =>
          l.partner_id == null ? 'Direct' : 'MFI',
        );
        break;
      case 'repayment_interval':
        data = loans.groupByWithCount(l =>
          l.terms.repayment_interval ? l.terms.repayment_interval : 'unknown',
        );
        break;
      case 'social_performance':
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
        data = loans
          .map(l => {
            const p = partnerDetails[l.partner_id];
            return p ? p.name : null;
          })
          .groupByWithCount(l => l.getPartner().name);
        break;
      case 'regions': // this won't come out with the right number of loans....
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

    data = data.orderBy(d => d.count, basicReverseOrder);

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
