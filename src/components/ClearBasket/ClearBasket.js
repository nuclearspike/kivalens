import React from 'react';
import { useDispatch } from 'react-redux';
import { basketClear } from '../../actions/basket';
import history from '../../history';

const ClearBasket = () => {
  if (process.env.BROWSER) {
    const dispatch = useDispatch();
    dispatch(basketClear());
    history.push('/search');
  }
  return <div />;
};

export default ClearBasket;
