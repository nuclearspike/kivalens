import React from 'react'
import useStyles from 'isomorphic-style-loader/useStyles'
import Container from 'react-bootstrap/Container'
import s from './Options.css'
import Link from '../Link'

const Options = () => {
  useStyles(s)
  return (
    <Container>
      <h1>Options</h1>
      <Link to="/search/customize">Customize Search Options</Link>
    </Container>
  )
}

export default Options
