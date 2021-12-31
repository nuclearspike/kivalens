import store from 'store2';
import './storeOn';

const registerStorageWatcher = (key, callback) => {
  if (process.env.BROWSER) {
    store.on(key, callback);
  }
};

export default registerStorageWatcher;
