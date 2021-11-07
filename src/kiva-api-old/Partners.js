'use strict'

const PagedKiva = require("./PagedKiva")
const ResultProcessors = require('./ResultProcessors')

/**
 * Even though Kiva currently returns all partners on a single page, using this class
 * will ensure that once Kiva hits > 500 partners it'll start paging
 */
class Partners extends PagedKiva {
  constructor() {
    super(`partners.json`, {per_page: 500}, 'partners')
  }

  start() {
    return super.start().then(ResultProcessors.processPartners)
  }
}

module.exports = Partners
