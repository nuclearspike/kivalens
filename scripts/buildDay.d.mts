export function utcDay(ms: number): string
export function buildDay(env: Record<string, string | undefined>, now?: number): string
export function klVersion(day: string): string
export function daysSpanned(from: number, to: number): string[]
export function herokuBuildDays(pushStartedAt: number, releasedAt: number): string[]
export function gateBuildDays(gate: { buildDay?: string; at: string; steps?: Array<{ seconds?: number }> }): string[]
export function buildsToCompare(gateDays: string[], herokuDays: string[]): { gateCounts: boolean; rebuild: string[] }
