import extend from 'extend';
import { humanize } from '../utils';
import { basicReverseOrder } from '../utils/linqextras.mjs';
import { HELPER_GRAPH_CLEAR, HELPER_GRAPH_SET } from '../constants';
import performSearch from '../components/Search/performSearch';

export const getHelperGraphs = selected => {
  return (dispatch, getState) => {
    let data;
    const { partnerDetails, criteria, allLoanIds, loanDetails } = getState();
    const crit = extend(true, {}, criteria); // must do deep copy, or mods to crit alter stored criteria sub objects
    switch (selected) {
      case 'sectors':
      case 'activities':
      case 'themes':
      case 'tags':
      case 'countries':
        crit.loan[selected] = {};
        break;
      // partner stuff.
      default:
        break;
    }

    // must alter criteria to exclude the thing it's currently displaying.
    const loans = performSearch(crit, allLoanIds, loanDetails, 'loans');
    switch (selected) {
      case 'country_code':
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
            if (p) {
              return p.social_performance_strengths;
            }
            return [];
          })
          .flatten()
          .filter(sp => sp !== undefined)
          .groupByWithCount(sp => sp.name);
        break;
      case 'partners':
        data = loans
          .map(l => {
            const p = partnerDetails[l.partner_id];
            if (p) {
              return p.name;
            }
            return null;
          })
          .groupByWithCount(l => l.getPartner().name);
        break;
      case 'regions': // this won't come out with the right number of loans....
        data = loans
          .map(l => {
            const p = partnerDetails[l.partner_id];
            if (p) {
              return p.countries;
            }
            return [];
          })
          .flatten()
          .map(c => c.region)
          .groupByWithCount();
        break;
      case 'charges_fees_and_interest':
        data = loans
          .map(l => {
            const p = partnerDetails[l.partner_id];
            if (p) {
              return p.charges_fees_and_interest;
            }
            return null;
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
      title: { text: humanize(selected) }, // allOptions[selected].label
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
