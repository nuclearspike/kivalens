import { Deferred } from 'jquery-deferred';
import extend from 'extend';
import { getUrl, semOne, serialize } from './kivaBase.mjs';

/**
 * semaphored access to a server. this is to replace Request.sem_get
 *
 * currently only used in req.js
 */

class SemRequest {
  constructor(
    serverAndBasePath,
    asJSON = true,
    requestedWith,
    defaultParams,
    ttlSecs,
  ) {
    this.serverAndBasePath = serverAndBasePath;
    this.defaultParams = defaultParams;
    this.asJSON = asJSON;
    this.requestedWith = requestedWith;
    this.ttlSecs = ttlSecs || 0;
    this.requests = {};
  }

  semGet(path, params, getUrlOpts) {
    const def = Deferred();
    semOne.take(() => {
      return this.raw(path, params, getUrlOpts)
        .fail(e => typeof cl === 'function' && cl(e))
        .always(() => semOne.leave())
        .progress(def.notify)
        .fail(def.reject)
        .done(def.resolve);
    });
    return def;
  }

  raw(path, params, getUrlOpts) {
    params = serialize(extend({}, this.defaultParams, params));
    params = params ? `?${params}` : ''; // this wouldn't work>>..??
    return getUrl(
      `${this.serverAndBasePath}${path}${params}`,
      extend(
        { parseJSON: this.asJSON, includeRequestedWith: this.requestedWith },
        getUrlOpts,
      ),
    ).fail(e => typeof cl === 'function' && cl(e));
  }

  get(path = '', params = {}, getOpts, getUrlOpts) {
    getOpts = extend({ semaphored: true, useCache: true }, getOpts);
    getUrlOpts = extend({}, getUrlOpts);

    const key = `${path}?${JSON.stringify(params)}`;
    if (getOpts.useCache && this.requests[key]) {
      const req = this.requests[key];
      if (req) {
        return req.promise;
      }
    }
    // should be some type of cleanup of old cached but dead requests.

    const p = getOpts.semaphored
      ? this.semGet(path, params, getUrlOpts)
      : this.raw(path, params, getUrlOpts);
    if (this.ttlSecs > 0) {
      this.requests[key] = { promise: p, requested: Date.now() };
      setTimeout(() => {
        delete this.requests[key];
      }, this.ttlSecs * 1000);
    }
    return p;
  }
}

export default SemRequest;
