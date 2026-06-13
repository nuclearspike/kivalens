export class lsj {
  static get<T = Record<string, unknown>>(key: string, defaultResult: T = {} as T): T {
    const stored = localStorage.getItem(key)
    return { ...defaultResult, ...(stored ? JSON.parse(stored) as T : {}) }
  }

  static getA<T>(key: string, defaultResult: T[] = []): T[] {
    const stored = localStorage.getItem(key)
    return stored ? JSON.parse(stored) as T[] : defaultResult
  }

  static set(key: string, value: unknown): void {
    localStorage.setItem(key, JSON.stringify(value))
  }

  static setMerge(key: string, newStuff: Record<string, unknown>): void {
    const existing = lsj.get<Record<string, unknown>>(key)
    lsj.set(key, { ...existing, ...newStuff })
  }
}
