export interface RuntimeCache {
  get(key: string, maxAgeMs?: number): Promise<string | null>
  set(key: string, value: string): Promise<boolean>
  cleanup(options?: { prefix?: string; maxAgeMs?: number; maxFiles?: number; maxBytes?: number }): Promise<string[]>
}
export interface RuntimeSnapshots {
  save(snapshot: unknown, log?: (msg: string) => void): Promise<void>
  load(log?: (msg: string) => void): Promise<unknown | null>
}
export interface RuntimeUsage {
  getSpend(month: string): Promise<number>
  addSpend(month: string, usd: number): Promise<void>
  pushLog(entry: Record<string, unknown>): Promise<void>
  dayLogs(day: string): Promise<Array<Record<string, unknown>>>
  claimDigest(day: string): Promise<boolean>
  clearThrough(day: string): Promise<void>
  recent(n: number): Promise<Array<Record<string, unknown>>>
}
export declare function memoryCache(): RuntimeCache
export declare const noSnapshots: RuntimeSnapshots
export declare function memoryUsage(): RuntimeUsage
export declare function configureRuntime(parts: Partial<{ cache: RuntimeCache; snapshots: RuntimeSnapshots; usage: RuntimeUsage }>): void
export declare function resetRuntime(): void
export declare const cache: RuntimeCache
export declare const snapshots: RuntimeSnapshots
export declare const usage: RuntimeUsage
