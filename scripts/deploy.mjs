#!/usr/bin/env node
// Deploys one commit to www.kivalens.org, and is the only way a commit should get there.
//
//   node scripts/deploy.mjs <commit> --dry-run    every step but the two pushes, and the live checks on
//                                                  production as it is
//   node scripts/deploy.mjs <commit> --yes        the deploy
//   [--gate <summary.json>]                        reuse a passed gate run of the same commit
//   [--site <url>] [--app <name>]                  another site and Heroku app, to test this script
//
// In order: GitHub's and Heroku's master must both fast-forward to the commit; the release gate
// (scripts/gate.mjs) passes; the live checks (scripts/smoke-live.mjs) run on production as it is, so a
// failure afterwards can be told apart from one that was already there; push to GitHub, then to Heroku;
// wait until the live page serves the gated build's entry script byte for byte (or, when Heroku built on
// another UTC day than the gate, the commit built again for that day: the build stamps its day into the
// app, scripts/buildDay.mjs); run the live checks
// again; read the server log since the release. A failure at any step ends in a banner that says what
// failed, what production is running, and the rollback command. The script does not roll back by itself:
// a person decides that, with the failure in front of them. Records go to analysis/deploys/ in the main
// checkout.
import { execFileSync, spawn } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { judgeServerLog } from './serverLog.mjs'
import { buildsToCompare, gateBuildDays, herokuBuildDays } from './buildDay.mjs'
import { stepProblems } from './gateSteps.mjs'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null }
const TAKES_VALUE = ['--gate', '--site', '--app']
const APP = opt('--app') ?? 'kivalens'
const SITE = (opt('--site') ?? 'https://www.kivalens.org').replace(/\/$/, '')
const BRANCH = 'master'
const LIVE_WAIT_MS = 6 * 60_000
const dryRun = args.includes('--dry-run')
const yes = args.includes('--yes')
const commitArg = args.find((a, i) => !a.startsWith('--') && !TAKES_VALUE.includes(args[i - 1]))
if (!commitArg || dryRun === yes) {
  console.error('usage: node scripts/deploy.mjs <commit> --dry-run | --yes  [--gate <summary.json>] [--site <url>] [--app <name>]')
  process.exit(2)
}

const git = (...a) => execFileSync('git', a, { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
const sha = git('rev-parse', '--verify', `${commitArg}^{commit}`)
const short = sha.slice(0, 8)
const MAIN = path.dirname(path.resolve(REPO, git('rev-parse', '--git-common-dir')))
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const rec = path.join(MAIN, 'analysis', 'deploys', `${stamp}_${short}${dryRun ? '_dry-run' : ''}`)
fs.mkdirSync(rec, { recursive: true })

const summary = { commit: sha, dryRun, startedAt: new Date().toISOString(), steps: [] }
function say(line = '') {
  console.log(line)
  fs.appendFileSync(path.join(rec, 'deploy.log'), line + '\n')
}
function done(name, detail) {
  summary.steps.push({ name, ok: true, detail })
  say(`PASS  ${name} — ${detail}`)
}
function save() {
  summary.endedAt = new Date().toISOString()
  fs.writeFileSync(path.join(rec, 'summary.json'), JSON.stringify(summary, null, 2) + '\n')
}

// Runs a command, showing its output and keeping it in <name>.log.
function run(name, cmd, cmdArgs, { quiet = false, env = {} } = {}) {
  return new Promise((resolve) => {
    const file = fs.createWriteStream(path.join(rec, `${name}.log`))
    const child = spawn(cmd, cmdArgs, { cwd: REPO, env: { ...process.env, ...env } })
    let text = ''
    let stdout = ''
    const take = (chunk) => {
      text += chunk
      file.write(chunk)
      if (!quiet) process.stdout.write(chunk)
    }
    child.stdout.on('data', (chunk) => {
      stdout += chunk
      take(chunk)
    })
    child.stderr.on('data', take)
    child.on('error', (e) => take(`\n${e}\n`))
    child.on('close', (status) => file.end(() => resolve({ status, text, stdout })))
  })
}

let previous = null
let pushedOrigin = false
let released = null
function fail(name, reason) {
  summary.steps.push({ name, ok: false, detail: reason })
  summary.outcome = 'failed'
  save()
  const prev = previous ? `v${previous.version} (${previous.description})` : 'the release before'
  say('')
  say('!'.repeat(78))
  say(`DEPLOY FAILED at "${name}": ${reason}`)
  if (released) {
    say(`Production is running v${released.version}, this commit, and it failed the step above.`)
    say(`The release before it is ${prev}. To go back to it:`)
    say(`    heroku rollback v${previous?.version ?? '<version>'} -a ${APP}`)
    say('Decide with the failure in front of you: if the step that failed was already failing before')
    say('the deploy (see smoke-before.json), rolling back does not fix it.')
  } else {
    say(previous ? `Nothing was released. Production still runs ${prev}.` : 'Nothing was released.')
    if (pushedOrigin) say(`GitHub's ${BRANCH} is at ${short}, ahead of production; the next deploy takes it from there.`)
  }
  say(`Record: ${rec}`)
  say('!'.repeat(78))
  process.exit(1)
}

// Heroku's releases, newest first, from the CLI's standard output alone: the CLI writes warnings to
// standard error (Node deprecation notices, "update available"), and those can hold a "[" of their own.
let releasesProblem = ''
async function releases(n) {
  const r = await run('heroku-releases', 'heroku', ['releases', '-a', APP, '-n', String(n), '--json'], { quiet: true })
  releasesProblem = r.text.trim().split('\n').filter((l) => !/DeprecationWarning|trace-deprecation|update available/.test(l)).at(-1) ?? ''
  if (r.status !== 0) return null
  try {
    const list = JSON.parse(r.stdout)
    return Array.isArray(list) ? list : null
  } catch {
    return null
  }
}

async function liveEntry() {
  const res = await fetch(`${SITE}/`, { headers: { 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(20_000) })
  const entry = /\/assets\/index-[\w-]+\.js/.exec(await res.text())?.[0] ?? null
  return entry
}
async function sha256Of(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) })
  if (!res.ok) throw new Error(`${url} answered ${res.status}`)
  return crypto.createHash('sha256').update(Buffer.from(await res.arrayBuffer())).digest('hex')
}

say(`${dryRun ? 'DRY RUN: ' : ''}deploy ${sha} to ${SITE} (Heroku app ${APP})`)
say(`record: ${rec}`)

// 1. Both remotes must fast-forward to the commit.
for (const remote of ['origin', 'heroku']) {
  const f = await run(`fetch-${remote}`, 'git', ['fetch', remote, BRANCH], { quiet: true })
  if (f.status !== 0) fail('remotes', `git fetch ${remote} failed: ${f.text.trim().split('\n').at(-1)}`)
  const head = git('rev-parse', `refs/remotes/${remote}/${BRANCH}`)
  summary[`${remote}Before`] = head
  if (head === sha) {
    done(`${remote} ${BRANCH}`, `already at ${short}`)
    continue
  }
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', head, sha], { cwd: REPO })
  } catch {
    fail('remotes', `${short} is not a fast-forward of ${remote}/${BRANCH} (${head.slice(0, 8)}). Rebase onto it first.`)
  }
  const n = git('rev-list', '--count', `${head}..${sha}`)
  done(`${remote} ${BRANCH}`, `${head.slice(0, 8)} → ${short}, ${n} commit${n === '1' ? '' : 's'}`)
}

// 2. What production runs now, for the rollback command.
const before = await releases(1)
if (!before?.length) fail('heroku', `the Heroku CLI could not read ${APP}'s releases${releasesProblem ? `: ${releasesProblem.slice(0, 160)}` : ''} (see heroku-releases.log; "heroku login" if it is signed out)`)
previous = before[0]
summary.previousRelease = { version: previous.version, description: previous.description }
done('production now', `v${previous.version}, ${previous.description}`)

// 3. The gate.
let gate
const gateFile = opt('--gate')
if (gateFile) {
  gate = JSON.parse(fs.readFileSync(gateFile, 'utf8'))
  if (gate.commit !== sha) fail('gate', `${gateFile} is a gate run of ${gate.commit?.slice(0, 8)}, not ${short}`)
  if (!gate.passed || !gate.entry) fail('gate', `${gateFile} did not pass`)
  // A build-only run (gate.mjs --build-only, which this script uses to build for Heroku's day) passes
  // without tests, lint or audit; it is not a gate.
  const problems = gate.buildOnly ? ['it is a build-only run'] : stepProblems(gate.steps)
  if (problems.length) fail('gate', `${gateFile} is not a full gate run: ${problems.join('; ')}`)
  done('gate', `reused ${gateFile}`)
} else {
  say('\nrunning the gate (several minutes)…')
  const g = await run('gate', 'node', [path.join(REPO, 'scripts', 'gate.mjs'), sha, '--out', path.join(rec, 'gate')])
  gate = JSON.parse(fs.readFileSync(path.join(rec, 'gate', 'summary.json'), 'utf8'))
  if (g.status !== 0 || !gate.passed) fail('gate', `failed: ${gate.steps.filter((s) => !s.ok).map((s) => `${s.name} (${s.detail})`).join(', ') || 'see gate/'}`)
  done('gate', gate.steps.map((s) => `${s.name} ${s.detail}`).join('; '))
}
summary.entry = gate.entry
// The day the gate built for, which the build stamps into the app as its version (scripts/buildDay.mjs).
const gateDays = gateBuildDays(gate)
summary.gateBuildDays = gateDays

// A KL_BUILD_DAY on the Heroku app would stamp every release with that day instead of its own, and a
// gate pinned to the same day would match it. Production builds for the day it builds on.
const pin = await run('heroku-config', 'heroku', ['config:get', 'KL_BUILD_DAY', '-a', APP], { quiet: true })
if (pin.status !== 0) fail('heroku config', `could not read ${APP}'s KL_BUILD_DAY setting; see heroku-config.log`)
if (pin.stdout?.trim()) fail('heroku config', `${APP} has KL_BUILD_DAY=${pin.stdout.trim()}; every release would carry that day as its version. Unset it first.`)

// 4. Production as it is, so a later failure can be compared with one that was already there.
say('\nlive checks on production before the deploy:')
const pre = await run('smoke-before', 'node', [path.join(REPO, 'scripts', 'smoke-live.mjs'), '--url', SITE, '--json', path.join(rec, 'smoke-before.json')])
summary.smokeBefore = pre.status === 0 ? 'passed' : 'failed'
if (pre.status === 0) done('production before', 'every live check passes')
else say(`NOTE  production before — some checks already fail; the deploy goes ahead, and they are compared afterwards`)

if (dryRun) {
  say('\nDRY RUN: would now run')
  say(`    git push origin ${sha}:refs/heads/${BRANCH}`)
  say(`    git push heroku ${sha}:refs/heads/${BRANCH}`)
  say(`then wait for ${gate.entry.path} (sha256 ${gate.entry.sha256.slice(0, 16)}…, built for ${gateDays.join(' or ')}) on ${SITE} and run the live checks;`)
  say(`if Heroku built on another UTC day and serves another script, the commit is built again for that day and compared.`)
  summary.outcome = 'dry run'
  save()
  process.exit(0)
}

// 5. Push: GitHub first, so the code on GitHub is never behind the code that is live.
let beforeEntry = null
try {
  beforeEntry = await liveEntry()
} catch {
  // compared with what the site serves after the push; an answer now is not required
}
let herokuPushStartedAt = null
for (const remote of ['origin', 'heroku']) {
  if (summary[`${remote}Before`] === sha) continue
  say(`\npushing to ${remote}…`)
  if (remote === 'heroku') herokuPushStartedAt = Date.now()
  const p = await run(`${remote}-push`, 'git', ['push', remote, `${sha}:refs/heads/${BRANCH}`])
  if (p.status !== 0) {
    const last = p.text.trim().split('\n').slice(-3).join(' | ')
    fail(`push to ${remote}`, `git push exited ${p.status}: ${last}`)
  }
  if (remote === 'origin') pushedOrigin = true
  done(`push to ${remote}`, 'done')
}

// 6. The release this push made.
const after = await releases(1)
const newest = after?.[0]
if (!after) fail('release', `could not read Heroku's releases after the push${releasesProblem ? `: ${releasesProblem.slice(0, 160)}` : ''}`)
if (!newest || newest.version === previous.version) fail('release', 'Heroku made no new release')
if (!String(newest.description).includes(sha.slice(0, 7))) fail('release', `the newest release is v${newest.version}, "${newest.description}", not this commit`)
released = newest
summary.release = { version: newest.version, description: newest.description, status: newest.status }
if (newest.status !== 'succeeded') fail('release', `v${newest.version} is ${newest.status}`)
done('release', `v${newest.version}`)

// 7. The live site serves this build. The build stamps its UTC day into the app, so Heroku's build matches
// the gate's only when both were made for the same day. The gate's build counts when it was made for a day
// Heroku can have built on. When the site serves some other new script, the commit is built again for
// the other days Heroku can have built on, one at a time and its release day first, and stops at the first
// build that has the file name the site serves (the name is a hash of the file's content); the script
// must then equal that build byte for byte. Nothing is built again while a gate's build that counts is
// live. A gate counts for no day when the day it built for is not known exactly (an old gate that did not
// record its day and whose run crossed midnight) or is a day Heroku cannot have built on: its build is
// never accepted, and every day Heroku can have built on is a candidate. The time spent building is not
// taken from the wait.
const releasedAt = Date.parse(newest.created_at)
let herokuDays
try {
  herokuDays = herokuBuildDays(herokuPushStartedAt ?? releasedAt, releasedAt)
} catch (e) {
  fail('live build', e.message)
}
const plan = buildsToCompare(gateDays, herokuDays)
summary.herokuBuildDays = herokuDays
const expected = plan.gateCounts ? [{ day: gateDays[0], entry: gate.entry, what: 'the gated build' }] : []
const buildFailures = []
let rebuilt = false
// Builds the commit for Heroku's possible days one at a time, likeliest first, until one is the script the
// site serves. A build that fails is reported if no other build matches; it does not end the search.
async function buildAgain() {
  rebuilt = true
  for (const day of plan.rebuild) {
    say(`\n${SITE} serves ${seen}, not the gate's script: building ${short} for ${day}, a day Heroku can have built it on…`)
    const out = path.join(rec, `build-${day}`)
    const b = await run(`build-${day}`, 'node', [path.join(REPO, 'scripts', 'gate.mjs'), sha, '--build-only', '--out', out], { quiet: true, env: { KL_BUILD_DAY: day } })
    let built = null
    try {
      built = JSON.parse(fs.readFileSync(path.join(out, 'summary.json'), 'utf8'))
    } catch {
      // counted as a failed build below
    }
    if (b.status !== 0 || !built?.passed || !built.entry) {
      buildFailures.push(day)
      say(`WARN  build for ${day} — failed; see build-${day}.log`)
      continue
    }
    expected.push({ day, entry: built.entry, what: `the gated commit built for ${day}` })
    done(`build for ${day}`, `${built.entry.path}, sha256 ${built.entry.sha256.slice(0, 16)}…`)
    if (built.entry.path === seen) return
  }
}
say('\nwaiting for the live site to serve this build…')
let deadline = Date.now() + LIVE_WAIT_MS
let seen = null
for (;;) {
  try {
    seen = await liveEntry()
    let want = expected.find((e) => e.entry.path === seen)
    if (!want && !rebuilt && seen !== beforeEntry && plan.rebuild.length) {
      const started = Date.now()
      await buildAgain()
      deadline += Date.now() - started
      want = expected.find((e) => e.entry.path === seen)
    }
    if (want) {
      const live = await sha256Of(`${SITE}${seen}`)
      if (live !== want.entry.sha256) fail('live build', `${seen} on ${SITE} has sha256 ${live.slice(0, 16)}…, ${want.what} ${want.entry.sha256.slice(0, 16)}…`)
      summary.liveBuild = { day: want.day, ...want.entry }
      done('live build', `${seen}, ${want.what} byte for byte${want.what === 'the gated build' ? '' : ` (the gate built for ${gateDays.join(' or ')}; the build stamps its day)`}`)
      break
    }
  } catch (e) {
    seen = `(no answer: ${e.message})`
  }
  if (Date.now() > deadline) {
    const known = expected.map((e) => `${e.entry.path} (${e.what})`).join(' or ') || 'no build made for a day Heroku can have built on'
    const failed = buildFailures.length ? `; the builds for ${buildFailures.join(', ')} failed` : ''
    fail('live build', `after ${LIVE_WAIT_MS / 60_000} minutes ${SITE} serves ${seen}, not ${known}${failed}`)
  }
  await new Promise((r) => setTimeout(r, 10_000))
}
summary.expected = expected.map(({ day, entry }) => ({ day, ...entry }))

// 8. The live checks, given time for the server's first own batch.
say('\nlive checks on the new release:')
const post = await run('smoke-after', 'node', [path.join(REPO, 'scripts', 'smoke-live.mjs'), '--url', SITE, '--wait', '420', '--json', path.join(rec, 'smoke-after.json')])
if (post.status !== 0) {
  const read = (f) => { try { return JSON.parse(fs.readFileSync(path.join(rec, f), 'utf8')).results } catch { return [] } }
  const was = new Map(read('smoke-before.json').map((r) => [r.name, r.ok]))
  const failed = read('smoke-after.json').filter((r) => !r.ok)
  fail('live checks', failed.map((r) => `${r.name}: ${r.detail}${was.get(r.name) === false ? ' (also failed before the deploy)' : ''}`).join('; ') || 'see smoke-after.log')
}
done('live checks', 'every live check passes')

// 9. The server's own log since the release, judged by scripts/serverLog.mjs.
const logs = await run('heroku-logs', 'heroku', ['logs', '-a', APP, '-n', '1500'], { quiet: true })
const judged = judgeServerLog(logs, { since: Date.parse(newest.created_at) })
summary.logs = judged.summary
for (const n of judged.notes) say(`NOTE  server log — ${n}`)
for (const why of judged.incomplete) say(`WARN  server log — not read in full: ${why}`)
if (judged.crashed) fail('server log', `the app crashed after the release: ${judged.crashed.slice(0, 200)}`)
if (judged.errors.length) {
  say(`WARN  server log — ${judged.errors.length} error line${judged.errors.length === 1 ? '' : 's'} since the release; read ${judged.errors.length === 1 ? 'it' : 'them'} in heroku-logs.log:`)
  for (const l of judged.errors.slice(0, 5)) say(`        ${l.slice(0, 220)}`)
} else if (!judged.incomplete.length) {
  done('server log', `${judged.log.lines.length} line${judged.log.lines.length === 1 ? '' : 's'} since the release, no errors`)
}

summary.outcome = judged.tail ? `deployed, ${judged.tail}` : 'deployed'
save()
say(`\nDEPLOYED ${short} as v${newest.version} on ${SITE}${judged.tail ? `, ${judged.tail}` : ''}. Record: ${rec}`)
