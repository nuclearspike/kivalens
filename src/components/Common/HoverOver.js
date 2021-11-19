import React from 'react';
import PT from 'prop-types';
import { OverlayTrigger, Popover } from '../bs';

const HoverOver = ({ title, description }) => {
  const placement = 'auto';
  return (
    <OverlayTrigger
      trigger={['hover', 'click']}
      placement={placement}
      overlay={
        <Popover id={`popover-positioned-${placement}`}>
          <Popover.Title as="h3">{title}</Popover.Title>
          <Popover.Content>{description}</Popover.Content>
        </Popover>
      }
    >
      <span style={{ borderBottom: '1px dotted', cursor: 'pointer' }}>
        {title}
      </span>
    </OverlayTrigger>
  );
};

HoverOver.propTypes = {
  title: PT.string,
  description: PT.string,
};

HoverOver.defaultProps = {
  title: null,
  description: null,
};

export default HoverOver;
