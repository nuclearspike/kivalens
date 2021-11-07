import React from 'react'
import PT from 'prop-types'
import cx from 'classnames'

const DTDD = ({term, def, dtClass, ddClass}) => (
  <>
    <dt className={cx(dtClass, "text-right")}>{term}</dt>
    <dd className={cx(ddClass, "text-left")}>{def}</dd>
  </>
)

DTDD.propTypes = {
  term: PT.string,
  def: PT.node,
  dtClass: PT.string,
  ddClass: PT.string,
}

DTDD.defaultProps = {
  dtClass: 'col-sm-3',
  ddClass: 'col-sm-9',
}

export default DTDD
