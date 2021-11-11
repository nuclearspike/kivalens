import React from 'react';
import useStyles from 'isomorphic-style-loader/useStyles';
import Container from 'react-bootstrap/Container';
import Link from '../Link';
import s from './Options.css';

const Options = () => {
  useStyles(s);
  return (
    <Container>
      <h1>Options</h1>
      <Link to="/search/customize">Customize Search Options</Link>
      <div>
        default loan amount when double-clicking loans or using the "add to
        basket" button
      </div>
    </Container>
  );
};

export default Options;
