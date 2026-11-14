import { describe, expect, it } from 'vitest'
import { BUILD_STEPS, GATE_STEPS, stepProblems } from '../../scripts/gateSteps.mjs'

// gate.mjs passes a run, and deploy.mjs reuses a gate, only when stepProblems finds nothing. deploy.mjs
// once kept its own copy of the list, which had left out npm-version.

const ran = (names: string[], failed: string[] = []) => names.map((name) => ({ name, ok: !failed.includes(name) }))

describe('a gate run passes', () => {
  it('when exactly its steps ran, in order, and passed', () => {
    expect(stepProblems(ran(GATE_STEPS))).toEqual([])
    expect(stepProblems(ran(BUILD_STEPS), { buildOnly: true })).toEqual([])
  })

  it('never with a step missing, as when a step is commented out of gate.mjs', () => {
    expect(stepProblems(ran(GATE_STEPS.filter((n) => n !== 'rum-types')))).toEqual(['rum-types did not run'])
    expect(stepProblems(ran(GATE_STEPS.filter((n) => n !== 'npm-version')))).toEqual(['npm-version did not run'])
  })

  it('never with a failed step', () => {
    expect(stepProblems(ran(GATE_STEPS, ['tests']))).toEqual(['tests failed'])
  })

  it('never with a step the list does not name, failed or passed', () => {
    const extra = (ok: boolean) => [...ran(GATE_STEPS.slice(0, -1)), { name: 'extra-check', ok }, ...ran(GATE_STEPS.slice(-1))]
    expect(stepProblems(extra(false))).toEqual(['extra-check ran, and is not a gate step'])
    expect(stepProblems(extra(true))).toEqual(['extra-check ran, and is not a gate step'])
  })

  it('never with its steps out of order or run twice', () => {
    expect(stepProblems(ran([...GATE_STEPS].reverse()))).toHaveLength(1)
    expect(stepProblems(ran([...GATE_STEPS, 'lint']))).toHaveLength(1)
  })

  it('never as a gate when it was build-only, nor as build-only when the checks ran too', () => {
    expect(stepProblems(ran(BUILD_STEPS))).toContain('tests did not run')
    expect(stepProblems(ran(GATE_STEPS), { buildOnly: true })).toContain('tests ran, and is not a build-only step')
  })

  it('never with steps that are not a list, or a step whose ok is not true', () => {
    expect(stepProblems(undefined)).toHaveLength(GATE_STEPS.length)
    expect(stepProblems(GATE_STEPS.map((name) => ({ name, ok: 'yes' as unknown as boolean })))).toHaveLength(GATE_STEPS.length)
  })
})
