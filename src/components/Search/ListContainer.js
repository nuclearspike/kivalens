import React, { useEffect, useRef, useState } from 'react';
import PT from 'prop-types';

const ListContainer = ({ children, defaultHeight }) => {
  const ref = useRef(null);
  const [height, setHeight] = useState(defaultHeight);

  const refig = () => {
    if (ref.current) {
      const divHeight = ref.current.clientHeight;
      if (height !== divHeight) {
        setHeight(divHeight);
      }
    }
  };

  useEffect(() => {
    // needs to refig after a window resize.
    refig();
  }, [height, ref.current, ref.current && ref.current.clientHeight]);

  return (
    <div ref={ref} style={{ height: 550 }}>
      {children(ref.current ? ref.current.clientHeight : defaultHeight)}
    </div>
  );
};

ListContainer.propTypes = {
  children: PT.func.isRequired,
  defaultHeight: PT.number.isRequired,
};

export default ListContainer;
