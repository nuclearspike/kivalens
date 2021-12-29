import useStyles from 'isomorphic-style-loader/useStyles'
import React from 'react'
import Link from '../Link'
import s from './Footer.css'

export default function Footer() {
  useStyles(s)

  return (
    <div className={s.root}>
      <div className={s.container}>
        <span className={s.text}>© KivaLens</span>
        <span className={s.spacer}>·</span>
        <Link className={s.link} to="/">
          Home
        </Link>
        <span className={s.spacer}>·</span>
        <Link className={s.link} to="/privacy">
          Privacy
        </Link>
        <span className={s.spacer}>·</span>
        <Link className={s.link} to="/about">
          About
        </Link>
      </div>
    </div>
  );
}
