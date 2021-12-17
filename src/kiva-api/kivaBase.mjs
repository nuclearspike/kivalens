import extend from 'extend';
import 'linqjs';
import 'datejs';
import semaphore from 'semaphore';
import jqd from 'jquery-deferred'; // need to replace with Promise but can't be!
import XHR2 from 'xhr2';
const { Deferred } = jqd;

/**
 * jquery-deferred is similar to Promise but with some critical differences!
 * .notify is one of the main ones. It allows for updates to progress to make it
 *  back to the holder of the deferred variable.
 *
 *  here's the old docs for Kiva's REST API
 *  https://web.archive.org/web/20110714173244/http://build.kiva.org/api#GET*|loans|search
 *
 *
 * The API files are unique since they need to be .mjs so that they can be loaded in threads
 * in the server and still use import statements.
 */

const semOne = semaphore(8);
const semTwo = semaphore(8);

const XHR = () => {
  if (typeof global !== 'undefined' && typeof global.XMLHttpRequest !== 'undefined') {
    return new global.XMLHttpRequest;
  }
  return new XHR2;
}

if (typeof global !== 'undefined') {
  // eslint-disable-next-line no-console,no-undef
  if (process.env.BROWSER) {
    if (!global.cl) global.cl = () => console.log(...arguments);
  }
}

const isServer = () => !process.env.BROWSER;

const canWebWork = () =>
  !!process.env.BROWSER &&
  typeof Worker !== 'undefined' &&
  typeof TextEncoder !== 'undefined';

Array.prototype.flatten =
  Array.prototype.flatten ||
  function() {
    return [].concat.apply([], this);
  };

Array.prototype.percentWhere = function(predicate) {
  return (this.filter(predicate).length * 100) / this.length;
};

const getUrl = (url, options) => {
  const d = Deferred();

  options = extend({ parseJSON: true, withProgress: true }, options);

  const xhr = XHR();

  function xhrTransferComplete() {
    if (xhr.status === 200) {
      try {
        const res = options.parseJSON
          ? JSON.parse(this.responseText)
          : this.responseText;
        d.resolve(res);
      } catch (e) {
        d.reject(e.message, xhr.status);
      }
    } else {
      d.reject(this.responseText || '', xhr.status);
    }
  }

  function xhrFailed() {
    d.reject(this.responseText || '', xhr.status);
  }

  xhr.addEventListener('load', xhrTransferComplete);
  if (options.withProgress && !isServer())
    xhr.addEventListener('progress', e => {
      if (e.lengthComputable) options.contentLength = e.total;

      if (options.contentLength) {
        const notify = {
          percent: Math.round((e.loaded / options.contentLength) * 100),
          loaded: e.loaded,
          total: options.contentLength,
        };
        d.notify(notify);
      }
    });
  xhr.addEventListener('error', xhrFailed);
  xhr.addEventListener('abort', xhrFailed);
  xhr.open('GET', url, true);
  xhr.setRequestHeader('Accept', 'application/json,*/*');
  if (options.includeRequestedWith)
    xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
  xhr.send();

  return d;
};

const postUrl = (url, options, query) => {
  const d = Deferred();

  options = extend({ parseJSON: true }, options);

  const xhr = XHR();

  function xhrTransferComplete() {
    if (xhr.status === 200) {
      try {
        const res = options.parseJSON
          ? JSON.parse(this.responseText)
          : this.responseText;
        d.resolve(res);
      } catch (e) {
        d.reject(e.message, xhr.status);
      }
    } else {
      let msg = '';
      if (this.responseText) msg = this.responseText;

      d.reject(msg, xhr.status);
    }
  }

  function xhrFailed() {
    d.reject(this.responseText || '', xhr.status);
  }

  xhr.addEventListener('load', xhrTransferComplete);
  xhr.addEventListener('error', xhrFailed);
  xhr.addEventListener('abort', xhrFailed);
  xhr.open('POST', url, true);
  xhr.setRequestHeader('Content-Type', 'application/json;charset=UTF-8');
  xhr.setRequestHeader('Accept', 'application/json,*/*');
  if (options.includeRequestedWith)
    xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
  xhr.send(JSON.stringify({ query }));

  return d;
};

// turns {json: 'object', app_id: 'com.me'} into ?json=object&app_id=com.me
function serialize(obj, prefix) {
  const str = [];
  Object.keys(obj).forEach(p => {
    if (obj.hasOwnProperty(p)) {
      const k = prefix ? `${prefix}[${p}]` : p;
      const v = obj[p];
      str.push(
        typeof v === 'object'
          ? serialize(v, k)
          : `${encodeURIComponent(k)}=${encodeURIComponent(v)}`,
      );
    }
  });
  return str.join('&');
}

const apiOptions = { max_concurrent: 8 };

function setAPIOptions(options) {
  extend(apiOptions, options);
  if (apiOptions.max_concurrent) semOne.capacity = apiOptions.max_concurrent;
}

export {
  getUrl,
  postUrl,
  isServer,
  canWebWork,
  semOne,
  semTwo,
  serialize,
  apiOptions,
  setAPIOptions,
};
