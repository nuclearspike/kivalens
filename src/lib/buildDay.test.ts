import { describe, expect, it } from 'vitest'
import { buildDay, buildsToCompare, gateBuildDays, herokuBuildDays, klVersion, utcDay } from '../../scripts/buildDay.mjs'

// The build stamps its UTC day into the app as its version. On 2026-11-14 a deploy reused a gate built
// on 2026-11-13; Heroku built the same commit on the 14th, the bytes differed by that day alone, and the
// deploy reported a failure that was not one. A pinned day makes one commit build the same on any day.

const at = (iso: string) => Date.parse(iso)

describe('the day a build is made for', () => {
  it('is today in UTC unless pinned', () => {
    expect(buildDay({}, at('2026-11-14T04:21:00Z'))).toBe('2026-11-14')
    expect(buildDay({ KL_BUILD_DAY: '' }, at('2026-11-13T23:59:59Z'))).toBe('2026-11-13')
  })

  it('is the pinned day whatever the clock says', () => {
    expect(buildDay({ KL_BUILD_DAY: '2026-11-13' }, at('2026-11-14T04:21:00Z'))).toBe('2026-11-13')
  })

  it('refuses a pinned day that is not a real one, rather than stamping it', () => {
    for (const bad of ['2026-13-01', '2026-02-30', '2026-11-4', 'today', '2026-11-14T00:00:00Z']) {
      expect(() => buildDay({ KL_BUILD_DAY: bad }), bad).toThrow(/KL_BUILD_DAY/)
    }
  })

  it('becomes the version the app reports, without leading zeros', () => {
    expect(klVersion('2026-11-04')).toBe('2026.11.4')
    expect(klVersion('2026-01-14')).toBe('2026.1.14')
  })
})

describe("the days Heroku's build can have been made on", () => {
  it('is one day when the push and the release fall well inside it', () => {
    expect(herokuBuildDays(at('2026-11-14T04:20:30Z'), at('2026-11-14T04:21:04Z'))).toEqual(['2026-11-14'])
  })

  it("is both days when the build ran across midnight UTC, the release's own day first", () => {
    expect(herokuBuildDays(at('2026-11-13T23:59:40Z'), at('2026-11-14T00:00:50Z'))).toEqual(['2026-11-14', '2026-11-13'])
  })

  it('covers clocks that disagree near midnight by up to an hour', () => {
    expect(herokuBuildDays(at('2026-11-14T00:00:10Z'), at('2026-11-14T00:00:20Z'))).toEqual(['2026-11-14', '2026-11-13'])
    // Pushed at 23:59:40 by Heroku's clock, read as 00:11:40 here, released at 00:13 (a review's case).
    expect(herokuBuildDays(at('2026-11-14T00:11:40Z'), at('2026-11-14T00:13:00Z'))).toEqual(['2026-11-14', '2026-11-13'])
    expect(herokuBuildDays(at('2026-11-14T00:00:10Z'), at('2026-11-13T23:59:58Z'))).toEqual(['2026-11-13', '2026-11-14'])
  })

  it('says a clock is wrong when the push and its release are days apart, rather than dropping days', () => {
    expect(() => herokuBuildDays(at('2026-11-10T12:00:00Z'), at('2026-11-14T12:00:00Z'))).toThrow(/a clock is wrong/)
  })

  it('agrees with utcDay at the edges of a day', () => {
    expect(utcDay(at('2026-11-13T23:59:59.999Z'))).toBe('2026-11-13')
    expect(utcDay(at('2026-11-14T00:00:00Z'))).toBe('2026-11-14')
  })
})

describe("the days a gate's build was made for", () => {
  it('is the day it recorded', () => {
    expect(gateBuildDays({ buildDay: '2026-11-13', at: '2026-11-14T00:05:00Z' })).toEqual(['2026-11-13'])
  })

  it('is every day its run spanned for a gate that recorded none, its time being when it finished', () => {
    const steps = [{ seconds: 300 }, { seconds: 200 }]
    expect(gateBuildDays({ at: '2026-11-14T00:05:00Z', steps })).toEqual(['2026-11-13', '2026-11-14'])
    expect(gateBuildDays({ at: '2026-11-14T13:36:10Z', steps })).toEqual(['2026-11-14'])
  })
})

describe('what the live script may equal', () => {
  it("is the gate's build alone when it was made for the day Heroku built on", () => {
    expect(buildsToCompare(['2026-11-14'], ['2026-11-14'])).toEqual({ gateCounts: true, rebuild: [] })
  })

  it("is a build for Heroku's day when the gate's is from the day before (the v713 case)", () => {
    expect(buildsToCompare(['2026-11-13'], ['2026-11-14'])).toEqual({ gateCounts: false, rebuild: ['2026-11-14'] })
  })

  it("is the gate's build, and one for the other day, when Heroku's build ran across midnight", () => {
    expect(buildsToCompare(['2026-11-13'], ['2026-11-14', '2026-11-13'])).toEqual({ gateCounts: true, rebuild: ['2026-11-14'] })
  })

  it("never counts a gate pinned to a day Heroku did not build on", () => {
    expect(buildsToCompare(['2099-01-01'], ['2026-11-14']).gateCounts).toBe(false)
  })

  it('never counts a gate that does not know its own day exactly, and builds every day again', () => {
    // An old gate built on the 13th and finished on the 14th must not stand for a release built on the 14th.
    expect(buildsToCompare(['2026-11-13', '2026-11-14'], ['2026-11-14'])).toEqual({ gateCounts: false, rebuild: ['2026-11-14'] })
  })
})
