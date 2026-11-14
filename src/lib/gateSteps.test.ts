import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { BUILD_STEPS, GATE_STEPS } from '../../scripts/gateSteps.mjs'

// gate.mjs passes a run when every step in this list passed, and deploy.mjs reuses a gate only when it
// did. A step gate.mjs runs that is missing here would be run but never required; a name here that
// gate.mjs does not run would fail every gate.
const gateSource = fs.readFileSync(path.join(__dirname, '../../scripts/gate.mjs'), 'utf8')
const stepsRun = [...gateSource.matchAll(/\bstep\('([\w-]+)'/g)].map((m) => m[1])

describe('the steps a gate passes', () => {
  it('are the steps gate.mjs runs, in its order', () => {
    expect(stepsRun).toEqual(GATE_STEPS)
  })

  it('for a build-only run are the steps before the checks', () => {
    expect(GATE_STEPS.slice(0, BUILD_STEPS.length)).toEqual(BUILD_STEPS)
    expect(BUILD_STEPS).toContain('build')
    expect(BUILD_STEPS).not.toContain('tests')
  })
})
