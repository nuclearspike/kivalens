#!/usr/bin/env node
// The release gate: a commit, built and checked in a clean copy of itself, the way Heroku will build it.
//
//   node scripts/gate.mjs [commit] [--out <dir>] [--keep]
//
// Steps: npm's version against package.json's engines.npm, which is the npm Heroku builds with
// (scripts/npm-engine.mjs says why the two must match); npm ci, build, the test suite, the language check,
// the RUM Worker's types, lint against the recorded baseline (scripts/lint-baseline.json), and npm audit.
// Logs and summary.json go to --out, by default analysis/gates/<UTC time>_<commit>/ in the main checkout,
// so they outlive a worktree. The summary also records the built entry script and its sha256, which
// scripts/deploy.mjs compares with what the live site serves. Exit 0 only if every step passes. The clean
// copy is deleted after a pass and kept after a failure (or with --keep), for a look at what failed.
import { execFileSync, spawnSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkNpm } from './npm-engine.mjs'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null }
const commitArg = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--out') ?? 'HEAD'

const git = (...a) => execFileSync('git', a, { cwd: REPO, encoding: 'utf8' }).trim()
const sha = git('rev-parse', '--verify', `${commitArg}^{commit}`)
const short = sha.slice(0, 8)
// The main checkout, also when this runs from a worktree: records belong with the repo, not the worktree.
const MAIN = path.dirname(path.resolve(REPO, git('rev-parse', '--git-common-dir')))
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const out = path.resolve(opt('--out') ?? path.join(MAIN, 'analysis', 'gates', `${stamp}_${short}`))
const tree = path.join(os.tmpdir(), `kivalens-gate-${short}-${process.pid}`)
fs.mkdirSync(out, { recursive: true })
fs.rmSync(tree, { recursive: true, force: true })
fs.mkdirSync(tree, { recursive: true })
execFileSync('sh', ['-c', `git archive ${sha} | tar -x -C "${tree}"`], { cwd: REPO })

const pkg = JSON.parse(fs.readFileSync(path.join(tree, 'package.json'), 'utf8'))
const baselineFile = path.join(tree, 'scripts', 'lint-baseline.json')
const baseline = fs.existsSync(baselineFile) ? JSON.parse(fs.readFileSync(baselineFile, 'utf8')).problems : null

const steps = []
function step(name, cmd, cmdArgs, { env = {}, judge } = {}) {
  const t0 = Date.now()
  const r = spawnSync(cmd, cmdArgs, { cwd: tree, env: { ...process.env, ...env }, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
  const log = `${r.stdout ?? ''}${r.stderr ?? ''}${r.error ? `\n${r.error}` : ''}`
  fs.writeFileSync(path.join(out, `${name}.log`), log)
  let verdict
  try {
    verdict = judge ? judge(r, log) : { ok: r.status === 0, detail: `exit ${r.status}` }
  } catch (e) {
    verdict = { ok: false, detail: `could not judge: ${e.message}` }
  }
  const s = { name, ...verdict, seconds: Math.round((Date.now() - t0) / 1000) }
  steps.push(s)
  console.log(`${s.ok ? 'PASS' : 'FAIL'}  ${name} — ${s.detail} (${s.seconds} s)`)
  return s.ok
}

console.log(`gate for ${sha} · node ${process.version}; Heroku builds with node ${pkg.engines?.node ?? '(engines not set)'}, npm ${pkg.engines?.npm ?? '(engines not set)'}`)
let npmVersion = null
let ok = step('npm-version', 'npm', ['--version'], {
  judge: (r) => {
    if (r.status !== 0) return { ok: false, detail: `npm --version exited ${r.status}` }
    npmVersion = r.stdout.trim()
    return checkNpm(pkg.engines?.npm, npmVersion)
  },
})
ok = ok && step('npm-ci', 'npm', ['ci', '--no-audit', '--no-fund'])
ok = ok && step('build', 'npm', ['run', 'build'], { env: { SOURCE_VERSION: sha } })
if (ok) {
  // Four workers and 30 s a test: on a machine busy with other work, the default run failed different
  // tests each time, every one on the 5 s timeout. A timeout says nothing about the code; an assertion does.
  step('tests', 'npx', ['vitest', 'run', '--maxWorkers=4', '--testTimeout=30000'], {
    judge: (r, log) => {
      const m = /Tests\s+(?:(\d+) failed \| )?(\d+) passed \((\d+)\)/.exec(log)
      return { ok: r.status === 0, detail: m ? `${m[2]} of ${m[3]} passed${m[1] ? `, ${m[1]} failed` : ''}` : `exit ${r.status}` }
    },
  })
  step('languages', 'node', ['scripts/check-i18n.mjs'], {
    judge: (r, log) => ({ ok: r.status === 0, detail: (/^.*i18n check.*$/m.exec(log)?.[0] ?? `exit ${r.status}`).trim().slice(0, 100) }),
  })
  step('rum-types', 'npx', ['tsc', '-p', 'cloudflare/rum/tsconfig.json', '--noEmit'])
  step('lint', 'npx', ['eslint', '.', '-f', 'json', '-o', path.join(out, 'lint.json')], {
    judge: (r) => {
      // ESLint exits 1 when it finds problems and 2 when it could not lint at all.
      if (r.status !== 0 && r.status !== 1) return { ok: false, detail: `eslint could not run (exit ${r.status}); see lint.log` }
      const files = JSON.parse(fs.readFileSync(path.join(out, 'lint.json'), 'utf8'))
      const problems = files.reduce((n, f) => n + f.errorCount + f.warningCount, 0)
      if (baseline === null) return { ok: false, detail: `${problems} problems; the commit has no scripts/lint-baseline.json` }
      // The repo carries old lint debt. The gate holds the line rather than pretending it is clean.
      return { ok: problems <= baseline, detail: `${problems} problems, baseline ${baseline}${problems < baseline ? ' (lower the baseline)' : ''}` }
    },
  })
  step('audit', 'npm', ['audit'], {
    judge: (r, log) => ({ ok: r.status === 0, detail: log.match(/found \d+ vulnerabilit\w+|\d+ \w+ severity vulnerabilit\w+/)?.[0] ?? `exit ${r.status}` }),
  })
}

let entry = null
const indexHtml = path.join(tree, 'dist', 'index.html')
if (fs.existsSync(indexHtml)) {
  const name = /assets\/index-[\w-]+\.js/.exec(fs.readFileSync(indexHtml, 'utf8'))?.[0]
  if (name) entry = { path: `/${name}`, sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(tree, 'dist', name))).digest('hex') }
}
const EXPECTED = ['npm-version', 'npm-ci', 'build', 'tests', 'languages', 'rum-types', 'lint', 'audit']
const passed = EXPECTED.every((n) => steps.find((s) => s.name === n)?.ok) && entry !== null
const keep = !passed || args.includes('--keep')
if (!keep) fs.rmSync(tree, { recursive: true, force: true })
const summary = { commit: sha, at: new Date().toISOString(), node: process.version, herokuNode: pkg.engines?.node ?? null, npm: npmVersion, herokuNpm: pkg.engines?.npm ?? null, passed, steps, entry, tree: keep ? tree : null }
fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify(summary, null, 2) + '\n')
console.log(`\n${passed ? 'GATE PASSED' : 'GATE FAILED'} for ${short}`)
console.log(`record: ${out}${keep ? `\nclean copy kept: ${tree}` : ''}`)
process.exit(passed ? 0 : 1)
