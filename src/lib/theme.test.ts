// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { THEME_STORAGE_KEY, applyThemeChoice, parseThemeChoice, readThemeChoice, saveThemeChoice } from './theme'

function metas() {
  document.head.innerHTML =
    '<meta name="theme-color" data-kl-scheme="light" content="#ffffff">' +
    '<meta name="theme-color" data-kl-scheme="dark" content="#121715">'
  return [...document.head.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')].map((m) => () => m.content)
}

describe('theme choice', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
  })

  it('treats anything but light or dark as following the browser', () => {
    expect(parseThemeChoice('dark')).toBe('dark')
    expect(parseThemeChoice('light')).toBe('light')
    for (const raw of ['system', '', 'DARK', null, undefined, 1, {}]) expect(parseThemeChoice(raw)).toBe('system')
  })

  it('round-trips a forced theme and stores "system" as no entry', () => {
    saveThemeChoice('dark')
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    expect(readThemeChoice()).toBe('dark')
    saveThemeChoice('system')
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull()
    expect(readThemeChoice()).toBe('system')
  })

  it('forces the theme on <html> and hands control back to the browser for "system"', () => {
    applyThemeChoice('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    applyThemeChoice('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    applyThemeChoice('system')
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
  })

  it('paints both theme-color metas with a forced theme and restores each for "system"', () => {
    const [light, dark] = metas()
    applyThemeChoice('dark')
    expect([light(), dark()]).toEqual(['#121715', '#121715'])
    applyThemeChoice('light')
    expect([light(), dark()]).toEqual(['#ffffff', '#ffffff'])
    applyThemeChoice('system')
    expect([light(), dark()]).toEqual(['#ffffff', '#121715'])
  })

  it('survives blocked storage: reads as "system" and saving does not throw', () => {
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    expect(readThemeChoice()).toBe('system')
    expect(() => saveThemeChoice('dark')).not.toThrow()
    get.mockRestore()
    set.mockRestore()
  })
})
