import React, { memo } from 'react';
import useStyles from 'isomorphic-style-loader/useStyles';
import Container from 'react-bootstrap/Container';
import s from './Options.css';

const mustDo = [
  'default loan amount when double-clicking loans or using the "add to basket" button',
  'set username',
  'saved searches',
  'quick loading on heroku servers',
  'new loans are not discovered after initial load',
  'bonus credit criteria does not work',
  'cannot do zero percent female, it sets it to max (bigger issue, similar things with other crit)',
  'before go-live, new site needs to convert old options and saved searches to new storage methods',
  'partner name search/exact search',
  'if loans in basket while loading loans and go to /basket it errors',
  "basket/:id doesn't work when loading to that page (or backing into it)",
];

const toDo = [
  'default % to tip kiva',
  'https always',
  'break About into tabs',
  'have strikeout and other styling indicate which drop down options are not available for any loan or just currently selected loans',
  'some strangeness on double-slider when clearing (mostly cleared without the debounce)',
  'adjust basket amount (not current KL feature)',
  'refresh the basket data and clean funded loans when page is loaded',
  'GA view and basket data',
  'clear up About info',
];

const Options = memo(() => {
  useStyles(s);
  return (
    <Container>
      <h1>Options</h1>
      <div>
        <h3>Must Do:</h3>
        <ul>
          {mustDo.nonBlank().map((text, idx) => (
            // eslint-disable-next-line react/no-array-index-key
            <li key={idx}>{text}</li>
          ))}
        </ul>
      </div>
      <div>
        <h3>To Do:</h3>
        <ul>
          {toDo.nonBlank().map((text, idx) => (
            // eslint-disable-next-line react/no-array-index-key
            <li key={idx}>{text}</li>
          ))}
        </ul>
      </div>
    </Container>
  );
});

Options.displayName = 'Options';

export default Options;
