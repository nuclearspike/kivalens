import React, {memo, useMemo} from 'react'
import {useSelector} from 'react-redux'
// import { ProgressIndicator } from ''; causes errors to hard link with SSR and hot reloads (guessing)

const LoanTypeProgress = ({label, description, progress}) => {
  // for some reason, this unit causes a bunch of issues when SSR. the progress only shows on client and errors were resolved.
  const ProgressIndicator = require('@fluentui/react/lib/ProgressIndicator').ProgressIndicator
  const perc = useMemo(() => {
    return (progress && (progress.done && progress.total)) ? progress.done / progress.total : 1
  }, [progress, progress && progress.done, progress && progress.total])

  if (!process.env.BROWSER) {
    return <div/>
  }

  return (
    <ProgressIndicator
      label={`${label} ${Math.round(perc * 100)}%`}
      description={`${description} ${progress.done} / ${progress.total}`}
      percentComplete={perc}
    />
  )
}

const LoansProgress = memo(() => {
  const progress = useSelector(({loans_progress}) => loans_progress)

  if (Object.keys(progress).length === 0) {
    return <div/>
  }

  const {ids, details} = progress

  return (
    <div>
      {ids && (
        <LoanTypeProgress
          label="Loan IDs"
          description="Fundraising IDs download"
          progress={progress['ids']}
        />
      )}
      {details && (
        <LoanTypeProgress
          label="Loan Details"
          description="Full Details of Loans downloaded"
          progress={progress['details']}
        />
      )}
    </div>
  )
})

LoansProgress.displayName = 'LoansProgress'

export default LoansProgress
