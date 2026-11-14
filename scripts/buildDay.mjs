// The UTC day a build is made for. The build stamps it into the app as its version (2026.11.14), which
// usage reports and the shared Feedback service carry, and Feedback orders releases by. KL_BUILD_DAY pins
// it, so one commit builds to the same bytes on any day: the gate records the day it built for, and a
// deploy whose gate is from another day builds the commit again for the day Heroku built it on.
// Production must never run with a pinned day: deploy.mjs refuses an app that has one.

const DAY_MS = 86_400_000
// The push time is this machine's clock and the release time Heroku's. An hour either side covers clocks
// that disagree by up to an hour; beyond that the day Heroku built on may be missed, and a correct release
// then fails the check. A day the allowance adds that nobody built on costs nothing unless the live script
// is not the gate's, and then only a build.
const SLACK_MS = 60 * 60_000

/** The UTC day of a moment, as YYYY-MM-DD. */
export const utcDay = (ms) => new Date(ms).toISOString().slice(0, 10)

/** KL_BUILD_DAY when set, which must be a real day; otherwise today in UTC. */
export function buildDay(env, now = Date.now()) {
  const pinned = env.KL_BUILD_DAY
  if (pinned === undefined || pinned === '') return utcDay(now)
  const real = /^\d{4}-\d{2}-\d{2}$/.test(pinned) && !Number.isNaN(Date.parse(`${pinned}T00:00:00Z`)) && utcDay(Date.parse(`${pinned}T00:00:00Z`)) === pinned
  if (!real) throw new Error(`KL_BUILD_DAY must be a real day as YYYY-MM-DD, not ${JSON.stringify(pinned)}`)
  return pinned
}

/** The app's version for a build day: 2026-11-04 is 2026.11.4. */
export function klVersion(day) {
  const [y, m, d] = day.split('-').map(Number)
  return `${y}.${m}.${d}`
}

/** Every UTC day from one moment to another, both included. */
export function daysSpanned(from, to) {
  const days = []
  for (let day = utcDay(from); day <= utcDay(to); day = utcDay(Date.parse(`${day}T00:00:00Z`) + DAY_MS)) days.push(day)
  return days
}

/**
 * Every UTC day Heroku's build of a push can have been made on: the days the push and its release span,
 * an hour wider either side for clocks that disagree, the release's own day first, as the likeliest.
 * Moments days apart mean a clock is wrong, and that is an error rather than a guess.
 */
export function herokuBuildDays(pushStartedAt, releasedAt) {
  const from = Math.min(pushStartedAt, releasedAt) - SLACK_MS
  const to = Math.max(pushStartedAt, releasedAt) + SLACK_MS
  if (to - from > 2 * DAY_MS) {
    throw new Error(`the Heroku push (${new Date(pushStartedAt).toISOString()}) and its release (${new Date(releasedAt).toISOString()}) are days apart: a clock is wrong`)
  }
  const releaseDay = utcDay(releasedAt)
  return [releaseDay, ...daysSpanned(from, to).filter((day) => day !== releaseDay).reverse()]
}

/**
 * The days a gate's build can have been made for: the day it recorded, or, for a gate run before it
 * recorded one, every day its run spanned (its summary's time is when it finished).
 */
export function gateBuildDays(gate) {
  if (gate.buildDay) return [gate.buildDay]
  const finished = Date.parse(gate.at)
  const seconds = (gate.steps ?? []).reduce((n, s) => n + (Number(s.seconds) || 0), 0)
  // A minute before its first step: the run's own clock, so no allowance for another one.
  return daysSpanned(finished - seconds * 1000 - 60_000, finished)
}

/**
 * What the live entry script may equal: the gate's build, when it was made for one known day Heroku can
 * have built on, and the days the commit may be built again for, in herokuDays' order (deploy.mjs tries
 * them until one matches). A gate whose day is not known exactly (an old gate whose run crossed midnight)
 * stands for no day, and every day is a candidate.
 */
export function buildsToCompare(gateDays, herokuDays) {
  const known = gateDays.length === 1 ? gateDays[0] : null
  return {
    gateCounts: known !== null && herokuDays.includes(known),
    rebuild: herokuDays.filter((day) => day !== known),
  }
}
