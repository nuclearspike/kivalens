import React, { memo } from 'react';
import useStyles from 'isomorphic-style-loader/useStyles';
import Container from 'react-bootstrap/Container';
import Link from '../Link';
import s from './Options.css';

const Options = memo(() => {
  useStyles(s);
  return (
    <Container>
      <h1>Options</h1>
      <Link to="/search/customize">Customize Search Options</Link>
      <div>
        <h3>To Do:</h3>
        <ul>
          <li>
            default loan amount when double-clicking loans or using the "add to
            basket" button
          </li>
          <li>default % to tip kiva</li>
          <li>set username</li>
          <li>show atheist list searches and data</li>
        </ul>
      </div>
    </Container>
  );
});

Options.displayName = 'Options';

export default Options;
