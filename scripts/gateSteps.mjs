// The steps of a gate run (scripts/gate.mjs), in the order it runs them. A run passes only when exactly
// these steps ran, in this order, and every one passed (stepProblems); a reused gate stands for a commit
// only when it did (scripts/deploy.mjs). A build-only run (gate.mjs --build-only) runs BUILD_STEPS alone,
// so it is never a gate. A step gate.mjs runs that this list leaves out fails every run, rather than
// running unrequired.
export const BUILD_STEPS = ['npm-version', 'npm-ci', 'build']
export const GATE_STEPS = [...BUILD_STEPS, 'tests', 'languages', 'rum-types', 'lint', 'audit']

/** Why a run's steps do not pass, one phrase each; none when exactly the run's steps ran, in order, and passed. */
export function stepProblems(steps, { buildOnly = false } = {}) {
  const expected = buildOnly ? BUILD_STEPS : GATE_STEPS
  const ran = (steps ?? []).map((s) => s.name)
  const problems = []
  for (const name of expected) {
    const s = (steps ?? []).find((st) => st.name === name)
    if (!s) problems.push(`${name} did not run`)
    else if (s.ok !== true) problems.push(`${name} failed`)
  }
  for (const name of new Set(ran)) if (!expected.includes(name)) problems.push(`${name} ran, and is not a ${buildOnly ? 'build-only' : 'gate'} step`)
  if (!problems.length && ran.join('\n') !== expected.join('\n')) problems.push(`the steps ran in the order ${ran.join(', ')}, not ${expected.join(', ')}`)
  return problems
}
