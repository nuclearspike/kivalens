import React from 'react';
import useStyles from 'isomorphic-style-loader/useStyles';
import { Icon, IconButton, PrimaryButton } from '@fluentui/react';
import s from './Feedback.css';

export default function Feedback() {
  useStyles(s);
  return (
    <div className={s.root}>
      <div className={s.container}>
        <a
          className={s.link}
          href="https://gitter.im/kriasoft/react-starter-kit"
        >
          Ask a question
        </a>
        <IconButton
          iconProps={{ iconName: 'Add' }}
          title="Add"
          ariaLabel="Add"
        />
        <Icon iconName="CompassNW" className="ms-IconExample" />
        <PrimaryButton>I'm a button</PrimaryButton>
        <span className={s.spacer}>|</span>
        <a
          className={s.link}
          href="https://github.com/kriasoft/react-starter-kit/issues/new"
        >
          Report an issue
        </a>
      </div>
    </div>
  );
}
