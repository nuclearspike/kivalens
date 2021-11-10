import useStyles from 'isomorphic-style-loader/useStyles'
import React, {memo} from 'react'
import Link from '../Link'
import {useBasket} from '../../store/helpers/hooks'
import s from './Navigation.css'

const Navigation = memo(() => {
  useStyles(s);
  const basketCount = useBasket().length;
  return (
    <div className={s.root} role="navigation">
      <Link className={s.link} to="/search">
        Search
      </Link>
      <Link className={s.link} to="/basket">
        Basket <span style={{ color: 'white' }}>{basketCount}</span>
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
  );
});

Navigation.displayName = 'Navigation'

export default Navigation;

// <span className={s.spacer}> | </span>
// <Link className={s.link} to="/login">
//   Log in
// </Link>
// <span className={s.spacer}>or</span>
// <Link className={cx(s.link, s.highlight)} to="/register">
//   Sign up
// </Link>
