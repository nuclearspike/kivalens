import useStyles from 'isomorphic-style-loader/useStyles'
import React from 'react'
import s from './Header.css'
import Link from '../Link'
import Navigation from '../Navigation'

const Header = () => {
  useStyles(s)
  return (
    <div className={s.root}>
      <div className={s.container}>
        <Navigation/>
        <Link className={s.brand} to="/">
          <span className={s.brandTxt}>KivaLens</span>
        </Link>
      </div>
    </div>
  )
}

export default Header
