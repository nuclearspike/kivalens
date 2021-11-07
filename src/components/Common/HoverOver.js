import React from 'react'
import {OverlayTrigger, Popover} from '../bs'

const HoverOver = ({title, description}) => {
  const placement = 'auto'
  return (
    <OverlayTrigger
      trigger={['hover', 'click']}
      placement={placement}
      overlay={
        <Popover id={`popover-positioned-${placement}`}>
          <Popover.Title as="h3">{title}</Popover.Title>
          <Popover.Content>
            {description}
          </Popover.Content>
        </Popover>
      }
    >
      <span style={{borderBottom: '1px dotted', cursor: 'pointer'}}>{title}</span>
    </OverlayTrigger>
  )
}

export default HoverOver


