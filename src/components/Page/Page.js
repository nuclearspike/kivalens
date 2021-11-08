import useStyles from 'isomorphic-style-loader/useStyles'
import React from 'react'
import PropTypes from 'prop-types'
import s from './Page.css'

export default function Page({title, html}) {
  useStyles(s)
  return (
    <div className={s.root}>
      <div className={s.container}>
        <h1>{title}</h1>
        <div
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{__html: html}}
        />
      </div>
    </div>
  );
}

Page.propTypes = {
  title: PropTypes.string.isRequired,
  html: PropTypes.string.isRequired,
};
