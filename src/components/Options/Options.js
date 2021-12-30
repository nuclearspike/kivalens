import React, { memo } from 'react';
import useStyles from 'isomorphic-style-loader/useStyles';
import Container from 'react-bootstrap/Container';
import s from './Options.css';

const toDo = [
  'Pass basket to Kiva',
  'default loan amount when double-clicking loans or using the "add to basket" button',
  'default % to tip kiva',
  'set username',
  'adjust basket amount',
  'basket shared between tabs and reloads (localStorage)',
  'https always',
  'saved searches',
  'quick loading on heroku servers',
  'new loans are not discovered after initial load',
  'bonus credit criteria does not work',
  'break About into tabs',
  'have strikeout and other styling indicate which drop down options are not available for any loan or just currently selected loans',
  'some strangeness on double-slider when clearing',
  'cannot do zero percent female, it sets it to max',
  'before go-live, new site needs to convert old options and saved searches to new methods',
  'double-slider comp modal needs to display presets',
  'partner name search/exact search',
  'years on kiva is not displayed on partnerTab (put parenthetically after start date)',
  'loans posted need to go much higher! adapt to partner data',
  '',
];

const Options = memo(() => {
  useStyles(s);
  return (
    <Container>
      <h1>Options</h1>
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
