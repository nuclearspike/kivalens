const { Deferred } = require('jquery-deferred');
const extend = require('extend');
const { sem_one } = require('./kivaBase');
const { serialize } = require('./kivaBase');
const { getUrl } = require('./kivaBase');

/**
 * semaphored access to a server. this is to replace Request.sem_get
 */
class SemRequest {
  constructor(
    serverAndBasePath,
    asJSON,
    requestedWith,
    defaultParams,
    ttlSecs,
  ) {
    if (asJSON === undefined) asJSON = true;
    this.serverAndBasePath = serverAndBasePath;
    this.defaultParams = defaultParams;
    this.asJSON = asJSON;
    this.requestedWith = requestedWith;
    this.ttlSecs = ttlSecs || 0;
    this.requests = {};
  }

  sem_get(path, params, getUrlOpts) {
    const def = Deferred();
    sem_one.take(
      function() {
        return this.raw(path, params, getUrlOpts)
          .fail(e => cl(e))
          .always(x => sem_one.leave())
          .done(def.resolve)
          .fail(def.reject)
          .progress(def.notify);
      }.bind(this),
    );
    return def;
  }

  raw(path, params, getUrlOpts) {
    params = serialize(extend({}, this.defaultParams, params));
    params = params ? `?${params}` : '';
    return getUrl(
      `${this.serverAndBasePath}${path}${params}`,
      extend(
        { parseJSON: this.asJSON, includeRequestedWith: this.requestedWith },
        getUrlOpts,
      ),
    ).fail(e => cl(e));
  }

  get(path, params, getOpts, getUrlOpts) {
    if (!path) path = '';
    if (!params) params = {};
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
      ? this.sem_get(path, params, getUrlOpts)
      : this.raw(path, params, getUrlOpts);
    if (this.ttlSecs > 0) {
      this.requests[key] = { promise: p, requested: Date.now() };
      setTimeout(
        function() {
          delete this.requests[key];
        }.bind(this),
        this.ttlSecs * 1000,
      );
    }
    return p;
  }
}

module.exports = SemRequest;
