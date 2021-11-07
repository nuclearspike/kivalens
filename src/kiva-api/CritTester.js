import 'linqjs'

// instantiate one of these to test your partner/loan criteria against the data. all functions are very generic.
// the idea behind it is you take all of the criteria, and for anything that is set, it adds a "tester" function
// to it's array of testers. All testers must pass or the entity fails to match the criteria. so, the criteria
// has a lower range for age set of 20 and an upper range is set to 30. The addRangeTesters() func will add a separate
// tester for each the lower and upper bound, then when testing a loan to see if it matches it runs the tester funcs
// in the order they were added (until one fails). So it barely takes any time to set up the testers then it can quickly
// run. It sets up highly targeted anon funcs to test exactly what the criteria specifies. used in filter() and filterPartners()
class CritTester {
  constructor(crit_group) {
    this.crit_group = crit_group
    this.testers = []
    this.fail_all = false
  }

  addRangeTesters(crit_name, selector, overrideIf, overrideFunc) {
    const min = this.crit_group[`${crit_name}_min`]
    if (min !== undefined) {
      const low_test = entity => {
        if (overrideIf && overrideIf(entity))
          return overrideFunc ? overrideFunc(this.crit_group, entity) : true
        return min <= selector(entity)
      }
      this.testers.push(low_test)
    }
    const max = this.crit_group[`${crit_name}_max`]
    if (max !== undefined) {
      const high_test = entity => {
        if (overrideIf && overrideIf(entity))
          return overrideFunc ? overrideFunc(this.crit_group, entity) : true
        return selector(entity) <= max
      }
      this.testers.push(high_test)
    }
  }

  addAnyAllNoneTester(
    crit_name,
    values,
    def_value,
    selector,
    entityFieldIsArray,
  ) {
    if (!values) values = this.crit_group[crit_name]
    if (values && values.length > 0) {
      const all_any_none =
        this.crit_group[`${crit_name}_all_any_none`] || def_value
      // if (all_any_none == 'all' && !entityFieldIsArray) throw new Exception('Invalid Option')
      switch (all_any_none) {
        case 'any':
          if (entityFieldIsArray) this.addArrayAnyTester(values, selector)
          else this.addFieldContainsOneOfArrayTester(values, selector)
          break
        case 'all': // field is always an array for an 'all'
          this.addArrayAllTester(values, selector)
          break
        case 'none':
          if (entityFieldIsArray) this.addArrayNoneTester(values, selector)
          else this.addFieldNotContainsOneOfArrayTester(values, selector)
          break
      }
    }
  }

  addArrayAllTester(crit, selector) {
    if (crit && crit.length > 0) {
      const terms_arr = Array.isArray(crit) ? crit : crit.split(',')
      this.testers.push(
        entity =>
          selector(entity) &&
          terms_arr.all(term => selector(entity).contains(term)),
      )
    }
  }

  addArrayAnyTester(crit, selector) {
    if (crit && crit.length > 0) {
      const terms_arr = Array.isArray(crit) ? crit : crit.split(',')
      this.testers.push(
        entity =>
          selector(entity) &&
          terms_arr.any(term => selector(entity).contains(term)),
      )
    }
  }

  addArrayNoneTester(crit, selector) {
    if (crit && crit.length > 0) {
      const terms_arr = Array.isArray(crit) ? crit : crit.split(',')
      this.testers.push(
        entity =>
          selector(entity) &&
          !terms_arr.any(term => selector(entity).contains(term)),
      )
    }
  }

  addBalancer(crit, selector) {
    if (crit && crit.enabled) {
      if (crit.hideshow == 'show') {
        if (Array.isArray(crit.values) && crit.values.length == 0)
          this.fail_all = true
        else this.addFieldContainsOneOfArrayTester(crit.values, selector)
      } else this.addFieldNotContainsOneOfArrayTester(crit.values, selector)
    }
  }

  addFieldContainsOneOfArrayTester(crit, selector, fail_if_empty) {
    if (crit) {
      if (crit.length > 0) {
        const terms_arr = Array.isArray(crit) ? crit : crit.split(',')
        this.testers.push(entity =>
          selector(entity) !== null
            ? terms_arr.contains(selector(entity))
            : false,
        )
      } else if (fail_if_empty) this.fail_all = true
    }
  }

  addFieldNotContainsOneOfArrayTester(crit, selector) {
    if (crit && crit.length > 0) {
      const terms_arr = Array.isArray(crit) ? crit : crit.split(',')
      this.testers.push(entity =>
        selector(entity) !== null
          ? !terms_arr.contains(selector(entity))
          : false,
      )
    }
  }

  addArrayAllStartWithTester(crit, selector) {
    if (crit && crit.trim().length > 0) {
      let terms_arr = Array.isArray(crit) ? crit : crit.match(/(\w+)/g)
      terms_arr = terms_arr.select(term => term.toUpperCase())
      this.testers.push(entity =>
        terms_arr.all(search_term =>
          selector(entity).any(w => w.startsWith(search_term)),
        ),
      )
    }
  }

  addSimpleEquals(crit, selector) {
    if (crit && crit.trim().length > 0) {
      this.testers.push(entity => selector(entity) == crit)
    }
  }

  addSimpleContains(crit, selector) {
    // no longer used
    const search =
      crit && crit.trim().length > 0
        ? crit
          .match(/(\w+)/g)
          .distinct()
          .select(word => word.toUpperCase())
        : []
    if (search.length)
      this.testers.push(entity =>
        search.all(
          searchText =>
            selector(entity)
              .toUpperCase()
              .indexOf(searchText) > -1,
        ),
      )
  }

  addThreeStateTester(crit, selector) {
    // '', 'true', 'false'
    if (crit === 'true') {
      this.testers.push(entity => selector(entity) === true)
    } else if (crit === 'false') {
      this.testers.push(entity => selector(entity) === false)
    }
  }

  // this is the main event.
  allPass(entity) {
    if (this.fail_all) return false // must happen first
    if (this.testers.length === 0) return true // all on 0-length array will fail :(
    try {
      return this.testers.all(func => func(entity)) // pass the entity to all of the tester functions, all must pass
    } catch (e) {
      console.log(
        `!!!!!!!!!!!! allPass: ${JSON.stringify(entity)} ${e.message}`,
      )
      return false
    }
  }
}

export default CritTester
