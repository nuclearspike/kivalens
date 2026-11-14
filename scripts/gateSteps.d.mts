export const BUILD_STEPS: string[]
export const GATE_STEPS: string[]
export function stepProblems(steps: Array<{ name: string; ok?: boolean }> | undefined, opts?: { buildOnly?: boolean }): string[]
