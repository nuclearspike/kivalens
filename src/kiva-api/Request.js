import extend from 'extend'
import semaphore from 'semaphore'
import {api_options, getUrl, serialize} from './kivaBase'
import {Deferred} from 'jquery-deferred'

const sem_one = semaphore(8)
const sem_two = semaphore(8)

const ReqState = {ready: 1, downloading: 2, done: 3, failed: 4, cancelled: 5}

class Request {
  constructor(url, params, page, collection, isSingle) {
    this.url = url
    this.params = params
    this.page = page || 1
    this.state = ReqState.ready
    this.collection = collection
    this.isSingle = isSingle
    this.ids = []
    this.results = []
    this.continuePaging = true
    this.raw_result = {}
  }

  //fetch data from kiva right now. use sparingly. sem_get makes sure the browser never goes above a certain number of active requests.
  static get(path, params) {
    params = extend({}, params, {app_id: api_options.app_id})
    return getUrl(`https://api.kivaws.org/v1/${path}?${serialize(params)}`, {parseJSON: true}).fail(e => cl(e))
    //can't use the following because this is semaphored... they stack up (could now that there are more options to block semaphore?). return req.kiva.api.get(path, params).fail(e => cl(e) )
  }

  //semaphored access to kiva api to not overload it. also, it handles collections.
  static sem_get(url, params, collection, isSingle) {
    const def = Deferred()
    sem_one.take(function () {
      this.get(url, params)
        .always(x => sem_one.leave())
        .done(def.resolve)
        .fail(def.reject)
        .progress(def.notify)
    }.bind(this))

    //should this be a wrapping function?
    if (collection) { //'loans' 'partners' etc... then do another step of processing. will resolve as undefined if no result.
      return def.then(result => isSingle ? result[collection][0] : result[collection])
    } else {
      return def
    }
  }

  fetch() {
    const def = Deferred()

    sem_one.take(function () {
      if (this.state === ReqState.cancelled) { //this only works with single stage.
        sem_one.leave()
        //def.reject() //failing the process is dangerous, done() won't fire!
        return def
      } else {
        if (this.page)
          extend(this.params, {page: this.page})
        def.fail(() => this.state = ReqState.failed)
        Request.get(this.url, this.params)
          .always(x => sem_one.leave(1))
          .done(result => {
            if (result.paging.page === 1)
              this.raw_paging = result.paging
          }) //cannot pass the func itself since it takes params.
          .done(def.resolve)
          .progress(def.notify)
          .fail(def.reject)
      }
    }.bind(this))

    if (this.collection) { //'loans' 'partners' etc... then do another step of processing. will resolve as undefined if no result.
      return def.then(result => this.isSingle ? result[this.collection][0] : result[this.collection])
    } else {
      return def
    }
  }

  fetchFromIds(ids) {
    this.state = ReqState.downloading
    this.ids = ids

    const def = Deferred()

    sem_two.take(function () { //this pattern happens several times, it should be a function.
      if (this.state === ReqState.cancelled) { //this only works with single stage.
        sem_two.leave()
        //def.reject() bad idea
        return def
      } else {
        def.fail(() => this.state = ReqState.failed)
        Request.get(`${this.collection}/${ids.join(',')}.json`, {})
          .always(x => sem_two.leave(1))
          .progress(def.notify)
          .done(result => def.resolve(result[this.collection]))
          .fail(def.reject) //does this really fire properly? no one is listening for this
      }
    }.bind(this))

    return def
  }
}


export {Request, ReqState}
export default Request

