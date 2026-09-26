// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { Segmented } from './Segmented'

afterEach(cleanup)

function Row() {
  const [value, setValue] = useState<'idea' | 'bug' | 'language'>('idea')
  return (
    <Segmented
      label="Send Feedback"
      value={value}
      onChange={setValue}
      options={[
        { value: 'idea', label: 'Idea' },
        { value: 'bug', label: 'Bug' },
        { value: 'language', label: 'Language' },
      ]}
    />
  )
}

const radio = (name: string) => screen.getByRole('radio', { name })

describe('a pick-one row', () => {
  it('is a radio group whose chosen option is filled and the rest outlined', () => {
    render(<Row />)
    expect(screen.getByRole('radiogroup', { name: 'Send Feedback' })).toHaveClass('kl-segmented')
    expect(radio('Idea')).toHaveAttribute('aria-checked', 'true')
    expect(radio('Idea')).toHaveClass('btn-primary')
    expect(radio('Bug')).toHaveClass('btn-outline-primary')
    fireEvent.click(radio('Bug'))
    expect(radio('Bug')).toHaveAttribute('aria-checked', 'true')
    expect(radio('Idea')).toHaveClass('btn-outline-primary')
  })

  it('is reached by Tab at the chosen option only', () => {
    render(<Row />)
    expect(radio('Idea')).toHaveAttribute('tabindex', '0')
    expect(radio('Bug')).toHaveAttribute('tabindex', '-1')
    expect(radio('Language')).toHaveAttribute('tabindex', '-1')
  })

  it('moves the choice with the arrow keys, wrapping, and Home/End, taking focus along', () => {
    render(<Row />)
    radio('Idea').focus()
    fireEvent.keyDown(radio('Idea'), { key: 'ArrowRight' })
    expect(radio('Bug')).toHaveAttribute('aria-checked', 'true')
    expect(radio('Bug')).toHaveFocus()
    fireEvent.keyDown(radio('Bug'), { key: 'End' })
    expect(radio('Language')).toHaveAttribute('aria-checked', 'true')
    fireEvent.keyDown(radio('Language'), { key: 'ArrowRight' })
    expect(radio('Idea')).toHaveAttribute('aria-checked', 'true')
    fireEvent.keyDown(radio('Idea'), { key: 'ArrowLeft' })
    expect(radio('Language')).toHaveAttribute('aria-checked', 'true')
    fireEvent.keyDown(radio('Language'), { key: 'Home' })
    expect(radio('Idea')).toHaveAttribute('aria-checked', 'true')
  })
})
