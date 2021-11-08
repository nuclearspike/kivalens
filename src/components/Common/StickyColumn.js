import React from 'react'
import PT from 'prop-types'
import useStyles from 'isomorphic-style-loader/useStyles'
import s from './StickyColumn.css'

const StickyColumn = ({children}) => {
  useStyles(s)
  return <div className={s.sticky}>{children}</div>
}

StickyColumn.propTypes = {
  children: PT.node,
}

StickyColumn.defaultProps = {
  children: null,
}

export default StickyColumn
