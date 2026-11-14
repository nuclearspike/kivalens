export const BUILD_STEPS: readonly string[]
export const GATE_STEPS: readonly string[]
export function stepProblems(steps: Array<{ name: string; ok?: boolean }> | undefined, opts?: { buildOnly?: boolean }): string[]
