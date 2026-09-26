import type { ClientFacts } from './protocol'
import lock from './shared-support.lock.json'

/**
 * The facts this page sends with every report, and shows under "Show details"
 * before it does (definition rules.sentDataVisible: what is shown equals what is
 * sent). Coarse on purpose: a browser family and major version with its
 * operating system, never the full user-agent string.
 */

export const APP_ID = 'kivalens-web'
export const APP_NAME = 'KivaLens'

/** The browser realization's version is the shared definition it realizes. */
export const WEB_SUPPORT_VERSION = lock.version

export function browserSummary(userAgent: string): string {
  const ua = userAgent
  const version = (re: RegExp) => ua.match(re)?.[1]?.split('.')[0]
  const browser =
    (version(/Edg\/([\d.]+)/) && `Edge ${version(/Edg\/([\d.]+)/)}`) ||
    (version(/OPR\/([\d.]+)/) && `Opera ${version(/OPR\/([\d.]+)/)}`) ||
    (version(/Firefox\/([\d.]+)/) && `Firefox ${version(/Firefox\/([\d.]+)/)}`) ||
    (version(/Chrome\/([\d.]+)/) && `Chrome ${version(/Chrome\/([\d.]+)/)}`) ||
    (/Safari\//.test(ua) && version(/Version\/([\d.]+)/) && `Safari ${version(/Version\/([\d.]+)/)}`) ||
    'Browser'
  const os =
    (/iPhone|iPad|iPod/.test(ua) && 'iOS') ||
    (/Android/.test(ua) && 'Android') ||
    (/CrOS/.test(ua) && 'ChromeOS') ||
    (/Mac OS X|Macintosh/.test(ua) && 'macOS') ||
    (/Windows/.test(ua) && 'Windows') ||
    (/Linux/.test(ua) && 'Linux') ||
    ''
  return (os ? `${browser} · ${os}` : browser).slice(0, 64)
}

export function clientFacts(locale: string, env: { dev: boolean; userAgent: string }): ClientFacts {
  return {
    schemaVersion: '1.0',
    sdk: { family: 'web', version: WEB_SUPPORT_VERSION },
    appId: APP_ID,
    appVersion: typeof __KL_VERSION__ === 'string' ? __KL_VERSION__ : '0.0.0',
    appBuild: typeof __KL_BUILD__ === 'string' ? __KL_BUILD__ : 'dev',
    distribution: env.dev ? 'development' : 'web',
    platform: 'web',
    osVersion: browserSummary(env.userAgent),
    architecture: 'unknown',
    locale,
    capabilities: {},
  }
}
