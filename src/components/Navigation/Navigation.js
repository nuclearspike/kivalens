import useStyles from 'isomorphic-style-loader/useStyles'
import React from 'react'
import Link from '../Link'
import s from './Navigation.css'
import {useBasket} from '../../store/helpers/hooks'

const Navigation = () => {
  useStyles(s)
  const basketCount = useBasket().length
  return (
    <div className={s.root} role="navigation">
      <Link className={s.link} to="/search">
        Search
      </Link>
      <Link className={s.link} to="/basket">
        Basket <span style={{color: 'white'}}>{basketCount}</span>
      </Link>
      {/* <Link className={s.link} to="/teams"> */}
      {/*  Teams */}
      {/* </Link> */}
      <Link className={s.link} to="/options">
        Options
      </Link>
      <Link className={s.link} to="/about">
        About
      </Link>
    </div>
  )
};

export default Navigation

// <span className={s.spacer}> | </span>
// <Link className={s.link} to="/login">
//   Log in
// </Link>
// <span className={s.spacer}>or</span>
// <Link className={cx(s.link, s.highlight)} to="/register">
//   Sign up
// </Link>
