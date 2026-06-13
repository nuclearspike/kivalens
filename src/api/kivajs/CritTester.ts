export class CritTester {
  critGroup: Record<string, any>
  testers: Array<(entity: any) => boolean>
  failAll: boolean

  constructor(critGroup: Record<string, any>) {
    this.critGroup = critGroup
    this.testers = []
    this.failAll = false
  }

  addRangeTesters(
    critName: string,
    selector: (e: any) => any,
    overrideIf?: (e: any) => boolean,
    overrideFunc?: (crit: any, e: any) => boolean
  ): void {
    const min = this.critGroup[`${critName}_min`]
    if (min != null) {
      this.testers.push((entity) => {
        if (overrideIf && overrideIf(entity)) {
          return overrideFunc ? overrideFunc(this.critGroup, entity) : true
        }
        return min <= selector(entity)
      })
    }
    const max = this.critGroup[`${critName}_max`]
    if (max != null) {
      this.testers.push((entity) => {
        if (overrideIf && overrideIf(entity)) {
          return overrideFunc ? overrideFunc(this.critGroup, entity) : true
        }
        return selector(entity) <= max
      })
    }
  }

  addAnyAllNoneTester(
    critName: string,
    values: any[] | null,
    defValue: string,
    selector: (e: any) => any,
    entityFieldIsArray?: boolean
  ): void {
    if (!values) values = this.critGroup[critName]
    if (values && values.length > 0) {
      const allAnyNone =
        this.critGroup[`${critName}_all_any_none`] || defValue
      switch (allAnyNone) {
        case 'any':
          if (entityFieldIsArray) this.addArrayAnyTester(values, selector)
          else this.addFieldContainsOneOfArrayTester(values, selector)
          break
        case 'all':
          this.addArrayAllTester(values, selector)
          break
        case 'none':
          if (entityFieldIsArray) this.addArrayNoneTester(values, selector)
          else this.addFieldNotContainsOneOfArrayTester(values, selector)
          break
      }
    }
  }

  addArrayAllTester(crit: any, selector: (e: any) => any): void {
    if (crit && crit.length > 0) {
      const termsArr: any[] = Array.isArray(crit) ? crit : crit.split(',')
      this.testers.push(
        (entity) =>
          selector(entity) &&
          termsArr.every((term) => selector(entity).includes(term))
      )
    }
  }

  addArrayAnyTester(crit: any, selector: (e: any) => any): void {
    if (crit && crit.length > 0) {
      const termsArr: any[] = Array.isArray(crit) ? crit : crit.split(',')
      this.testers.push(
        (entity) =>
          selector(entity) &&
          termsArr.some((term) => selector(entity).includes(term))
      )
    }
  }

  addArrayNoneTester(crit: any, selector: (e: any) => any): void {
    if (crit && crit.length > 0) {
      const termsArr: any[] = Array.isArray(crit) ? crit : crit.split(',')
      this.testers.push(
        (entity) =>
          selector(entity) &&
          !termsArr.some((term) => selector(entity).includes(term))
      )
    }
  }

  addBalancer(crit: any, selector: (e: any) => any): void {
    if (crit && crit.enabled) {
      if (crit.hideshow === 'show') {
        if (Array.isArray(crit.values) && crit.values.length === 0) {
          this.failAll = true
        } else {
          this.addFieldContainsOneOfArrayTester(crit.values, selector)
        }
      } else {
        this.addFieldNotContainsOneOfArrayTester(crit.values, selector)
      }
    }
  }

  addFieldContainsOneOfArrayTester(
    crit: any,
    selector: (e: any) => any,
    failIfEmpty?: boolean
  ): void {
    if (crit) {
      if (crit.length > 0) {
        const termsArr: any[] = Array.isArray(crit) ? crit : crit.split(',')
        this.testers.push((entity) =>
          selector(entity) !== null ? termsArr.includes(selector(entity)) : false
        )
      } else {
        if (failIfEmpty) this.failAll = true
      }
    }
  }

  addFieldNotContainsOneOfArrayTester(
    crit: any,
    selector: (e: any) => any
  ): void {
    if (crit && crit.length > 0) {
      const termsArr: any[] = Array.isArray(crit) ? crit : crit.split(',')
      this.testers.push((entity) =>
        selector(entity) !== null
          ? !termsArr.includes(selector(entity))
          : false
      )
    }
  }

  addArrayAllStartWithTester(crit: any, selector: (e: any) => any): void {
    if (crit && crit.trim().length > 0) {
      const raw: string[] = Array.isArray(crit) ? crit : crit.match(/(\w+)/g)
      const termsArr = raw.map((term) => term.toUpperCase())
      this.testers.push((entity) =>
        termsArr.every((searchTerm) =>
          selector(entity).some((w: string) => w.startsWith(searchTerm))
        )
      )
    }
  }

  addSimpleEquals(crit: string, selector: (e: any) => any): void {
    if (crit && crit.trim().length > 0) {
      this.testers.push((entity) => selector(entity) == crit)
    }
  }

  addSimpleContains(crit: string, selector: (e: any) => any): void {
    const search =
      crit && crit.trim().length > 0
        ? [...new Set(crit.match(/(\w+)/g))].map((word) => word.toUpperCase())
        : []
    if (search.length) {
      this.testers.push((entity) =>
        search.every(
          (searchText) => selector(entity).toUpperCase().indexOf(searchText) > -1
        )
      )
    }
  }

  addThreeStateTester(crit: string, selector: (e: any) => any): void {
    if (crit === 'true') {
      this.testers.push((entity) => selector(entity) === true)
    } else if (crit === 'false') {
      this.testers.push((entity) => selector(entity) === false)
    }
  }

  allPass(entity: any): boolean {
    if (this.failAll) return false
    if (this.testers.length === 0) return true
    try {
      return this.testers.every((func) => func(entity))
    } catch (e: any) {
      console.log(
        `!!!!!!!!!!!! allPass: ${JSON.stringify(entity)} ${e.message}`
      )
      return false
    }
  }
}
