const sem_one = require('semaphore')(8);
const sem_two = require('semaphore')(8);
const { Deferred } = require('jquery-deferred');
const extend = require('extend');
require('linqjs');
require('datejs');

let _isServer = false;
if (typeof XMLHttpRequest === 'undefined') {
  _isServer = true;
  global.XMLHttpRequest = require('xhr2');
}

if (!global.cl)
  global.cl = function() {
    console.log(...arguments);
  };

const isServer = () => _isServer;
const canWebWork = () =>
  !_isServer &&
  typeof Worker !== 'undefined' &&
  typeof TextEncoder !== 'undefined';
Array.prototype.flatten =
  Array.prototype.flatten ||
  function() {
    return [].concat.apply([], this);
  };
Array.prototype.percentWhere = function(predicate) {
  return (this.where(predicate).length * 100) / this.length;
};

const getUrl = function(url, options) {
  const d = Deferred();

  options = extend({ parseJSON: true, withProgress: true }, options);

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

  function xhrFailed(e) {
    let msg = '';
    if (this.responseText) msg = this.responseText;

    d.reject(msg, xhr.status);
  }

  var xhr = new XMLHttpRequest();
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

const postUrl = function(url, options, query) {
  const d = Deferred();

  options = extend({ parseJSON: true }, options);

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

  function xhrFailed(e) {
    let msg = '';
    if (this.responseText) msg = this.responseText;

    d.reject(msg, xhr.status);
  }

  var xhr = new XMLHttpRequest();
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
  for (const p in obj) {
    if (obj.hasOwnProperty(p)) {
      const k = prefix ? `${prefix}[${p}]` : p;
      const v = obj[p];
      str.push(
        typeof v === 'object'
          ? serialize(v, k)
          : `${encodeURIComponent(k)}=${encodeURIComponent(v)}`,
      );
    }
  }
  return str.join('&');
}

const api_options = { max_concurrent: 8 };

function setAPIOptions(options) {
  extend(api_options, options);
  if (api_options.max_concurrent) sem_one.capacity = api_options.max_concurrent;
}

exports.getUrl = getUrl;
exports.postUrl = postUrl;
exports.isServer = isServer;
exports.canWebWork = canWebWork;
exports.sem_one = sem_one;
exports.sem_two = sem_two;
exports.serialize = serialize;
exports.api_options = api_options;
exports.setAPIOptions = setAPIOptions;
