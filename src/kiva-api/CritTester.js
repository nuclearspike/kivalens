import 'linqjs'

// instantiate one of these to test your partner/loan criteria against the data. all functions are very generic.
// the idea behind it is you take all of the criteria, and for anything that is set, it adds a "tester" function
// to it's array of testers. All testers must pass or the entity fails to match the criteria. so, the criteria
// has a lower range for age set of 20 and an upper range is set to 30. The addRangeTesters() func will add a separate
// tester for each the lower and upper bound, then when testing a loan to see if it matches it runs the tester funcs
// in the order they were added (until one fails). So it barely takes any time to set up the testers then it can quickly
// run. It sets up highly targeted anon funcs to test exactly what the criteria specifies. used in filter() and filterPartners()
class CritTester {
  constructor(critGroup) {
    this.critGroup = critGroup
    this.testers = []
    this.fail_all = false
  }

  addRangeTesters(critName, selector, overrideIf, overrideFunc) {
    const min = this.critGroup[`${critName}_min`]
    if (min !== undefined) {
      const lowTest = entity => {
        if (overrideIf && overrideIf(entity))
          return overrideFunc ? overrideFunc(this.critGroup, entity) : true
        return min <= selector(entity)
      }
      this.testers.push(lowTest)
    }
    const max = this.critGroup[`${critName}_max`]
    if (max !== undefined) {
      const highTest = entity => {
        if (overrideIf && overrideIf(entity))
          return overrideFunc ? overrideFunc(this.critGroup, entity) : true
        return selector(entity) <= max
      }
      this.testers.push(highTest)
    }
  }

  addAnyAllNoneTester(
    critName,
    values,
    defValue,
    selector,
    entityFieldIsArray,
  ) {
    if (!values) values = this.critGroup[critName]
    if (values && values.length > 0) {
      const allAnyNone =
        this.critGroup[`${critName}_all_any_none`] || defValue
      // if (allAnyNone == 'all' && !entityFieldIsArray) throw new Exception('Invalid Option')
      switch (allAnyNone) {
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
      const termsArr = Array.isArray(crit) ? crit : crit.split(',')
      this.testers.push(
        entity =>
          selector(entity) &&
          termsArr.any(term => selector(entity).contains(term)),
      )
    }
  }

  addArrayNoneTester(crit, selector) {
    if (crit && crit.length > 0) {
      const termsArr = Array.isArray(crit) ? crit : crit.split(',')
      this.testers.push(
        entity =>
          selector(entity) &&
          !termsArr.any(term => selector(entity).contains(term)),
      )
    }
  }

  addBalancer(crit, selector) {
    if (crit && crit.enabled) {
      if (crit.hideshow === 'show') {
        if (Array.isArray(crit.values) && crit.values.length === 0)
          this.fail_all = true
        else this.addFieldContainsOneOfArrayTester(crit.values, selector)
      } else this.addFieldNotContainsOneOfArrayTester(crit.values, selector)
    }
  }

  addFieldContainsOneOfArrayTester(crit, selector, failIfEmpty) {
    if (crit) {
      if (crit.length > 0) {
        const termsArr = Array.isArray(crit) ? crit : crit.split(',')
        this.testers.push(entity =>
          selector(entity) !== null
            ? termsArr.contains(selector(entity))
            : false,
        )
      } else if (failIfEmpty) this.fail_all = true
    }
  }

  addFieldNotContainsOneOfArrayTester(crit, selector) {
    if (crit && crit.length > 0) {
      const termsArr = Array.isArray(crit) ? crit : crit.split(',')
      this.testers.push(entity =>
        selector(entity) !== null
          ? !termsArr.contains(selector(entity))
          : false,
      )
    }
  }

  addArrayAllStartWithTester(crit, selector) {
    if (crit && crit.trim().length > 0) {
      let termsArr = Array.isArray(crit) ? crit : crit.match(/(\w+)/g)
      termsArr = termsArr.select(term => term.toUpperCase())
      this.testers.push(entity =>
        termsArr.all(searchTerm =>
          selector(entity).any(w => w.startsWith(searchTerm)),
        ),
      )
    }
  }

  addSimpleEquals(crit, selector) {
    if (crit && crit.trim().length > 0) {
      this.testers.push(entity => selector(entity) === crit)
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
