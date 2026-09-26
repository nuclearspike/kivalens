// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Dropdown } from './Dropdown'

afterEach(cleanup)

function renderDropdown(menuProps: { role?: string } = {}) {
  render(
    <div>
      <Dropdown>
        <Dropdown.Toggle>Open</Dropdown.Toggle>
        <Dropdown.Menu {...menuProps}>
          <Dropdown.Item>One</Dropdown.Item>
          <Dropdown.Item>Two</Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>
      <button type="button">Elsewhere</button>
    </div>,
  )
  const toggle = screen.getByRole('button', { name: 'Open' })
  fireEvent.click(toggle)
  const one = screen.getByRole('button', { name: 'One' })
  one.focus()
  return { toggle, one, elsewhere: screen.getByRole('button', { name: 'Elsewhere' }) }
}

const isOpen = () => screen.queryByRole('button', { name: 'One' }) !== null

describe('Dropdown focus management', () => {
  it('Escape closes the menu and returns focus to the toggle', () => {
    const { toggle, one } = renderDropdown()
    expect(isOpen()).toBe(true)
    fireEvent.keyDown(one, { key: 'Escape' })
    expect(isOpen()).toBe(false)
    expect(document.activeElement).toBe(toggle)
  })

  it('choosing an item closes the menu and returns focus to the toggle', () => {
    const { toggle, one } = renderDropdown()
    fireEvent.click(one)
    expect(isOpen()).toBe(false)
    expect(document.activeElement).toBe(toggle)
  })

  it('an item marked keepOpen leaves the menu open and focus where it was', () => {
    let clicked = 0
    render(
      <Dropdown>
        <Dropdown.Toggle>Open</Dropdown.Toggle>
        <Dropdown.Menu>
          <Dropdown.Item keepOpen onClick={() => clicked++}>
            Stay
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    const stay = screen.getByRole('button', { name: 'Stay' })
    stay.focus()
    fireEvent.click(stay)
    expect(clicked).toBe(1)
    expect(screen.getByRole('button', { name: 'Stay' })).toBe(stay)
    expect(document.activeElement).toBe(stay)
  })

  it('clicking elsewhere closes the menu and leaves focus where the click went', () => {
    const { toggle, elsewhere } = renderDropdown()
    elsewhere.focus()
    fireEvent.mouseDown(elsewhere)
    expect(isOpen()).toBe(false)
    expect(document.activeElement).toBe(elsewhere)
    expect(document.activeElement).not.toBe(toggle)
  })

  it('Tab out of a role="menu" closes it and hands focus back to the toggle', () => {
    // The browser's default Tab action then continues from the toggle, so the
    // next tab stop is the element after the menu button, as WAI-ARIA specifies.
    const { toggle, one } = renderDropdown({ role: 'menu' })
    fireEvent.keyDown(one, { key: 'Tab' })
    expect(isOpen()).toBe(false)
    expect(document.activeElement).toBe(toggle)
  })

  it('Tab from the toggle while a menu is open closes it', () => {
    const { toggle } = renderDropdown({ role: 'menu' })
    toggle.focus()
    fireEvent.keyDown(toggle, { key: 'Tab' })
    expect(isOpen()).toBe(false)
    expect(document.activeElement).toBe(toggle)
  })

  it('Tab inside a dropdown that is not a menu keeps it open', () => {
    const { one } = renderDropdown()
    fireEvent.keyDown(one, { key: 'Tab' })
    expect(isOpen()).toBe(true)
    expect(document.activeElement).toBe(one)
  })
})
