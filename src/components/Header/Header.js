import React, {memo} from 'react'
import useStyles from 'isomorphic-style-loader/useStyles'
import Link from '../Link'
import Navigation from '../Navigation'
import s from './Header.css'

const Header = memo(() => {
  useStyles(s);
  return (
    <div className={s.root}>
      <div className={s.container}>
        <Link className={s.brand} to="/">
          <span className={s.brandTxt}>KivaLens</span>
        </Link>
        <Navigation />
      </div>
    </div>
  );
});

Header.displayName = 'Header';

export default Header;
