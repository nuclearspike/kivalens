import React, { memo, useMemo } from 'react';
import PT from 'prop-types';
import { useSelector } from 'react-redux';

const LoanTypeProgress = ({ label, description, progress }) => {
  if (!process.env.BROWSER) {
    return <div />;
  }

  // for some reason, this import causes a bunch of issues when SSR. the progress only shows on client and errors were resolved.
  const {
    ProgressIndicator,
    // eslint-disable-next-line global-require
  } = require('@fluentui/react/lib/ProgressIndicator');
  const perc = useMemo(() => {
    return progress && progress.done && progress.total
      ? progress.done / progress.total
      : 1;
  }, [progress, progress && progress.done, progress && progress.total]);

  return (
    <ProgressIndicator
      label={`${label} ${Math.round(perc * 100)}%`}
      description={`${description} ${progress.done} / ${progress.total}`}
      percentComplete={perc}
    />
  );
};

LoanTypeProgress.propTypes = {
  label: PT.string.isRequired,
  description: PT.string.isRequired,
  progress: PT.shape({
    done: PT.number,
    total: PT.number,
  }),
};

LoanTypeProgress.defaultProps = {
  progress: null,
};

const LoansProgress = memo(() => {
  const progress = useSelector(({ loansProgress }) => loansProgress);
  const loadingLoans = useSelector(({ loading }) => loading.loans);

  if (!loadingLoans) {
    return <div />;
  }

  const { ids, details } = progress;

  return (
    <div>
      {ids && (
        <LoanTypeProgress
          label="Loan IDs"
          description="Fundraising IDs downloaded"
          progress={progress.ids}
        />
      )}
      {details && (
        <LoanTypeProgress
          label="Loan Details"
          description="Full Details of Loans downloaded"
          progress={progress.details}
        />
      )}
    </div>
  );
});

LoansProgress.displayName = 'LoansProgress';

export default LoansProgress;
