import React from 'react'
import PropTypes from 'prop-types'
import useStyles from 'isomorphic-style-loader/useStyles'
import s from './StickyColumn.css'

const StickyColumn = ({children}) => {
  useStyles(s)
  return (
    <div className={s.sticky}>
      {children}
    </div>
  )
}

StickyColumn.propTypes = {
  children: PropTypes.node,
}

export default StickyColumn
