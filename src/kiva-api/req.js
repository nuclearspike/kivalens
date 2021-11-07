import {isServer, postUrl} from './kivaBase'
import ResultProcessors from './ResultProcessors'
import SemRequest from './SemRequest'

/*
 * the req object is used for all calls to KL and Kiva APIs, as well as others.
 * this will fetch the loans given in the array.
 * req.kiva.api.loans([123,234,345]).done(loans => console.log(loans))
 */

const req = {}
let kivaBase
let gdocs
if (!isServer()) {
  // this has KivaLens-specific refs that won't work in other uses.
  // some of these can be switched to direct kiva/gdocs calls if needed on the server.
  req.kl = new SemRequest(
    `${global.location.protocol}//${global.location.host}/api/`,
    true,
    false,
    {},
    0,
  )
  // req.klcached = new SemRequest(`${location.protocol}//${location.host}/api/`,true,false,{},5*60000)
  req.klraw = new SemRequest(
    `${global.location.protocol}//${global.location.host}/`,
    false,
    false,
    {},
    0,
  )
  kivaBase = `${global.location.protocol}//${global.location.host}/proxy/kiva/`
  gdocs = `${global.location.protocol}//${global.location.host}/proxy/gdocs/`
  req.kl.graph = query => {
    return postUrl(
      `${global.location.protocol}//${global.location.host}/graphql`,
      {},
      query,
    ).then(response => response.data)
  }
} else {
  kivaBase = 'https://www.kiva.org/'
  gdocs = 'https://docs.google.com/'
}

req.kiva = {
  api: new SemRequest(
    'https://api.kivaws.org/v1/',
    true,
    false,
    {app_id: 'org.kiva.kivalens'},
    2,
  ),
  page: new SemRequest(kivaBase, false, !isServer(), {}, 5 * 60),
  ajax: new SemRequest(`${kivaBase}ajax/`, true, !isServer(), {}, 5 * 60),
}

// max of 100, not enforced or checked in this call.
req.kiva.api.loans = (ids, process = true) => {
  const p = req.kiva.api
    .get(`loans/${ids.join(',')}.json`)
    .then(res => res.loans)
  return process ? p.then(ResultProcessors.processLoans) : p
}

// hmm... really need a way to invoke immediately? on site load to a given loan url.
req.kiva.api.loan = id => {
  return req.kiva.api
    .get(`loans/${id}.json`)
    .then(res => res.loans[0])
    .then(ResultProcessors.processLoan)
}

req.kiva.api.similarTo = id => {
  return req.kiva.api.get(`loans/${id}/similar.json`).then(res => res.loans)
}

req.kiva.api.lender = lender => {
  return req.kiva.api.get(`lenders/${lender}.json`).then(res => res.lenders[0])
}

req.kiva.api.lenders = lenders => {
  return req.kiva.api
    .get(`lenders/${lenders.join(',')}.json`)
    .then(res => res.lenders)
}

req.gdocs = {
  atheist: new SemRequest(
    `${gdocs}spreadsheets/d/1KP7ULBAyavnohP4h8n2J2yaXNpIRnyIXdjJj_AwtwK0/export`,
    false,
    !isServer(),
    {
      gid: 1,
      format: 'csv',
    },
    5,
  ),
};

export default req
