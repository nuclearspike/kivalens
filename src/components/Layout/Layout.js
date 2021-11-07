import React from 'react'
import useStyles from 'isomorphic-style-loader/useStyles'
import PropTypes from 'prop-types'

// external-global styles must be imported in your JS.
import normalizeCss from 'normalize.css'
import Header from '../Header'
import Footer from '../Footer'
import s from './Layout.css'

export default function Layout({children}) {
  useStyles(s, normalizeCss)
  return (
    <>
      <Header/>
      <div className={s.minPage}>
        {children}
      </div>
      <Footer/>
    </>
  )
}

Layout.propTypes = {
  children: PropTypes.node.isRequired,
};
