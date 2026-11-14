// The steps of a gate run (scripts/gate.mjs), in the order it runs them. A run passes when every one of
// them passed; a reused gate stands for a commit only when it did (scripts/deploy.mjs). A build-only run
// (gate.mjs --build-only) passes BUILD_STEPS alone, so it is never a gate.
export const BUILD_STEPS = ['npm-version', 'npm-ci', 'build']
export const GATE_STEPS = [...BUILD_STEPS, 'tests', 'languages', 'rum-types', 'lint', 'audit']
