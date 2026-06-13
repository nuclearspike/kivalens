import { lsj } from './localStorage'

/**
 * Conditional debug logger. Only logs when Options.debugging is enabled in localStorage.
 */
export function cl(...args: unknown[]): void {
  const options = lsj.get<{ debugging?: boolean }>('Options')
  if (options.debugging) {
    console.log(...args)
  }
}

/**
 * Converts an underscore_separated string to Title Case.
 * e.g. "user_favorite" => "User Favorite"
 */
export function humanize(str: string): string {
  return str
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

/**
 * Promise-based setTimeout.
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Polls until the test function returns true.
 */
export function waitFor(test: () => boolean, interval = 500): Promise<void> {
  return new Promise((resolve) => {
    if (test()) {
      resolve()
      return
    }
    const id = setInterval(() => {
      if (test()) {
        clearInterval(id)
        resolve()
      }
    }, interval)
  })
}

/**
 * Returns true if the user agent indicates a mobile phone.
 */
export function mobileCheck(): boolean {
  const agent = navigator.userAgent || navigator.vendor
  return /android|webos|iphone|ipod|blackberry|iemobile|opera mini/i.test(agent)
}

/**
 * Returns true if the user agent indicates a mobile phone or tablet.
 */
export function mobileAndTabletCheck(): boolean {
  const agent = navigator.userAgent || navigator.vendor
  return /android|ipad|playbook|silk|webos|iphone|ipod|blackberry|iemobile|opera mini/i.test(agent)
}

/**
 * Detects the current Bootstrap breakpoint based on viewport width.
 */
export function findBootstrapEnv(): string {
  const width = window.innerWidth
  if (width >= 1200) return 'xl'
  if (width >= 992) return 'lg'
  if (width >= 768) return 'md'
  if (width >= 576) return 'sm'
  return 'xs'
}

/**
 * Times the execution of a synchronous function and logs the duration.
 */
export function perf(func: () => void): void {
  const start = performance.now()
  func()
  const end = performance.now()
  cl(`perf: ${(end - start).toFixed(2)}ms`)
}
