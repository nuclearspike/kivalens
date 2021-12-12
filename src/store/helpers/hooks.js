import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import store from 'store2';

/**
 * This unit is for common selectors or other common hooks.
 *
 */

export const useLoanDetails = id =>
  useSelector(({ loanDetails }) => loanDetails[id]);
export const usePartnerDetails = id =>
  useSelector(({ partnerDetails }) => partnerDetails[id]);
export const useBasket = () => useSelector(({ basket }) => basket);

export const useStateSetterCallbacks = (initial, valueArray) => {
  const [current, setCurrent] = useState(initial);
  const valueFunctions = valueArray.map(newValue =>
    useCallback(() => setCurrent(newValue), [setCurrent]),
  );
  return [current, ...valueFunctions];
};

export const useStored = (keyName, initial) => {
  const combinedInitial = useMemo(() => {
    const stored = store(keyName);
    if (stored === null) {
      return initial;
    }
    return stored;
  }, [keyName]);
  const [current, setCurrent] = useState(combinedInitial);

  // setter function needs to be a callback that calls the state set func
  const setCurrentCB = useCallback(
    newValue => {
      if (current !== newValue) {
        setCurrent(newValue);
      }
      store(keyName, newValue);
    },
    [current, keyName],
  );

  // respond to event of change.
  const handleStorageChange = useCallback(
    ({ key, newValue }) => {
      if (key === keyName) {
        let parsedNew = store._.parse(newValue);
        if (parsedNew === null) {
          parsedNew = initial;
        }
        if (parsedNew !== current) {
          setCurrentCB(parsedNew);
        }
      }
    },
    [keyName, current],
  );

  useEffect(() => {
    if (typeof window === 'undefined') return null;
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [handleStorageChange]);

  return [current, setCurrentCB];
};
