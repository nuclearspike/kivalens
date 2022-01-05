import React from 'react';
import PropTypes from 'prop-types';

const CustomToggle = React.forwardRef(({ children, onClick }, ref) => (
  <small>
    <a
      href=""
      ref={ref}
      onClick={e => {
        e.preventDefault();
        onClick(e);
      }}
    >
      {children}
      &#x25bc;
    </a>
  </small>
));

CustomToggle.displayName = 'CustomToggle';

CustomToggle.propTypes = {
  children: PropTypes.node.isRequired,
  onClick: PropTypes.func.isRequired,
};

export default CustomToggle;
