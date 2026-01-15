/**
 * SecretInput.test.tsx - SecretInput 组件测试
 */
import { describe, expect, it, mock, beforeEach, afterEach } from 'bun:test'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SecretInput } from './SecretInput'

describe('SecretInput', () => {
  beforeEach(() => {
    // Reset timers
  })

  afterEach(() => {
    // Cleanup
  })

  it('should render input with password type by default', () => {
    render(<SecretInput value="" onChange={() => {}} />)
    const input = screen.getByTestId('secret-input')
    expect(input).toBeDefined()
    expect(input.getAttribute('type')).toBe('password')
  })

  it('should call onChange when input value changes', () => {
    const handleChange = mock(() => {})
    render(<SecretInput value="" onChange={handleChange} />)

    const input = screen.getByTestId('secret-input')
    fireEvent.change(input, { target: { value: 'new-secret' } })

    expect(handleChange).toHaveBeenCalledWith('new-secret')
  })

  it('should toggle input type when reveal button is clicked', () => {
    render(<SecretInput value="my-secret" onChange={() => {}} />)

    const input = screen.getByTestId('secret-input')
    const revealButton = screen.getByTestId('reveal-button')

    expect(input.getAttribute('type')).toBe('password')

    fireEvent.click(revealButton)
    expect(input.getAttribute('type')).toBe('text')

    fireEvent.click(revealButton)
    expect(input.getAttribute('type')).toBe('password')
  })

  it('should render with required attribute', () => {
    render(<SecretInput value="" onChange={() => {}} required />)
    const input = screen.getByTestId('secret-input')
    expect(input.hasAttribute('required')).toBe(true)
  })

  it('should render with disabled attribute', () => {
    render(<SecretInput value="" onChange={() => {}} disabled />)
    const input = screen.getByTestId('secret-input')
    expect(input.hasAttribute('disabled')).toBe(true)
  })

  it('should render with readOnly attribute', () => {
    render(<SecretInput value="" onChange={() => {}} readOnly />)
    const input = screen.getByTestId('secret-input')
    expect(input.hasAttribute('readonly')).toBe(true)
  })

  it('should render with custom placeholder', () => {
    render(
      <SecretInput
        value=""
        onChange={() => {}}
        placeholder="Enter your API key"
      />
    )
    const input = screen.getByTestId('secret-input')
    expect(input.getAttribute('placeholder')).toBe('Enter your API key')
  })

  it('should render with custom id', () => {
    render(<SecretInput id="my-secret-input" value="" onChange={() => {}} />)
    const input = screen.getByTestId('secret-input')
    expect(input.getAttribute('id')).toBe('my-secret-input')
  })

  it('should auto-hide after revealDuration', async () => {
    render(
      <SecretInput
        value="my-secret"
        onChange={() => {}}
        revealDuration={100} // 100ms for faster test
      />
    )

    const input = screen.getByTestId('secret-input')
    const revealButton = screen.getByTestId('reveal-button')

    // Initially password type
    expect(input.getAttribute('type')).toBe('password')

    // Click to reveal
    fireEvent.click(revealButton)
    expect(input.getAttribute('type')).toBe('text')

    // Wait for auto-hide
    await waitFor(
      () => {
        expect(input.getAttribute('type')).toBe('password')
      },
      { timeout: 200 }
    )
  })

  it('should not auto-hide when revealDuration is 0', async () => {
    render(
      <SecretInput value="my-secret" onChange={() => {}} revealDuration={0} />
    )

    const input = screen.getByTestId('secret-input')
    const revealButton = screen.getByTestId('reveal-button')

    fireEvent.click(revealButton)
    expect(input.getAttribute('type')).toBe('text')

    // Wait a bit and verify it's still revealed
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(input.getAttribute('type')).toBe('text')
  })

  it('should disable reveal button when input is disabled', () => {
    render(<SecretInput value="" onChange={() => {}} disabled />)
    const revealButton = screen.getByTestId('reveal-button')
    expect(revealButton.hasAttribute('disabled')).toBe(true)
  })
})
