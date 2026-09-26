// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { I18nProvider, LOCALES } from '../i18n'
import LanguageMenu from './LanguageMenu'

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})

function renderMenu() {
  return render(
    <I18nProvider>
      <LanguageMenu />
    </I18nProvider>,
  )
}

describe('LanguageMenu', () => {
  it('shows the current locale as a short code and lists every language by its endonym', () => {
    renderMenu()
    const toggle = screen.getByRole('button', { name: /choose language/i })
    expect(toggle).toHaveTextContent('EN')

    fireEvent.click(toggle)
    const items = screen.getAllByRole('menuitemradio')
    expect(items.map((item) => item.textContent?.replace('✓', '').trim())).toEqual(LOCALES.map((l) => l.label))
    // Endonyms are never translated — and the current one is the checked one.
    expect(screen.getByRole('menuitemradio', { name: /English/ })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('menuitemradio', { name: /日本語/ })).toHaveAttribute('aria-checked', 'false')
  })

  it('switches the locale immediately, persists it, and updates <html lang>', async () => {
    renderMenu()
    fireEvent.click(screen.getByRole('button', { name: /choose language/i }))
    fireEvent.click(screen.getByRole('menuitemradio', { name: /简体中文/ }))

    expect(document.documentElement.lang).toBe('zh-Hans')
    expect(window.localStorage.getItem('KivaLensLocale')).toBe('zh-Hans')
    // The closed state shows the new code at once; the aria-label follows once
    // the (lazily loaded) catalog resolves, so wait for it rather than read it.
    expect(screen.getByRole('button', { name: /choose language/i })).toHaveTextContent('ZH')
    expect(await screen.findByRole('button', { name: '选择语言' })).toHaveTextContent('ZH')
  })

  it('opening the menu focuses the current language', () => {
    renderMenu()
    fireEvent.click(screen.getByRole('button', { name: /choose language/i }))
    expect(document.activeElement).toBe(screen.getByRole('menuitemradio', { name: /English/ }))
  })

  it('ends with a divider and then Suggest Language, for every lender', () => {
    renderMenu()
    fireEvent.click(screen.getByRole('button', { name: /choose language/i }))
    const menu = screen.getByRole('menu')
    const suggest = screen.getByRole('menuitem', { name: 'Suggest Language' })
    expect(menu.lastElementChild).toBe(suggest)
    expect(suggest.previousElementSibling).toHaveAttribute('role', 'separator')
    // The languages are one labelled radio group, and Suggest Language is not in it.
    const group = screen.getByRole('group', { name: 'Languages' })
    expect(suggest.previousElementSibling!.previousElementSibling).toBe(group)
    expect(within(group).getAllByRole('menuitemradio')).toHaveLength(LOCALES.length)
    expect(group).not.toContainElement(suggest)
  })

  it('moves through the menu with the arrow keys, Suggest Language last', () => {
    renderMenu()
    fireEvent.click(screen.getByRole('button', { name: /choose language/i }))
    const menu = screen.getByRole('menu')
    const items = screen.getAllByRole('menuitemradio')
    const suggest = screen.getByRole('menuitem', { name: 'Suggest Language' })
    items[0].focus()
    fireEvent.keyDown(menu, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(items[1])
    fireEvent.keyDown(menu, { key: 'End' })
    expect(document.activeElement).toBe(suggest)
    fireEvent.keyDown(menu, { key: 'ArrowUp' })
    expect(document.activeElement).toBe(items[items.length - 1])
    fireEvent.keyDown(menu, { key: 'End' })
    fireEvent.keyDown(menu, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(items[0])
  })
})
