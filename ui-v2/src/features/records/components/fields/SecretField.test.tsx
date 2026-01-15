/**
 * SecretField.test.tsx - SecretField 记录编辑组件测试
 */
import { describe, expect, it, mock } from 'bun:test'
import { render, screen, fireEvent } from '@testing-library/react'
import { SecretField } from './SecretField'

describe('SecretField', () => {
  const defaultField = {
    name: 'api_key',
    type: 'secret',
    required: false,
  }

  it('should render component with label', () => {
    render(<SecretField field={defaultField} value="" onChange={() => {}} />)

    const container = screen.getByTestId('secret-field')
    expect(container).toBeDefined()

    const label = screen.getByText('api_key')
    expect(label).toBeDefined()
  })

  it('should show required indicator when field is required', () => {
    const field = { ...defaultField, required: true }
    render(<SecretField field={field} value="" onChange={() => {}} />)

    const indicator = screen.getByText('*')
    expect(indicator).toBeDefined()
  })

  it('should not show required indicator when field is not required', () => {
    render(<SecretField field={defaultField} value="" onChange={() => {}} />)

    const container = screen.getByTestId('secret-field')
    expect(container.textContent).not.toContain('*')
  })

  it('should pass value to SecretInput', () => {
    render(
      <SecretField field={defaultField} value="my-secret" onChange={() => {}} />
    )

    const input = screen.getByTestId('secret-input') as HTMLInputElement
    expect(input.value).toBe('my-secret')
  })

  it('should call onChange when value changes', () => {
    const handleChange = mock(() => {})
    render(
      <SecretField field={defaultField} value="" onChange={handleChange} />
    )

    const input = screen.getByTestId('secret-input')
    fireEvent.change(input, { target: { value: 'new-secret' } })

    expect(handleChange).toHaveBeenCalledWith('new-secret')
  })

  it('should pass disabled prop to SecretInput', () => {
    render(
      <SecretField
        field={defaultField}
        value=""
        onChange={() => {}}
        disabled
      />
    )

    const input = screen.getByTestId('secret-input')
    expect(input.hasAttribute('disabled')).toBe(true)
  })

  it('should pass required prop to SecretInput', () => {
    const field = { ...defaultField, required: true }
    render(<SecretField field={field} value="" onChange={() => {}} />)

    const input = screen.getByTestId('secret-input')
    expect(input.hasAttribute('required')).toBe(true)
  })

  it('should use field name as input id', () => {
    render(<SecretField field={defaultField} value="" onChange={() => {}} />)

    const input = screen.getByTestId('secret-input')
    expect(input.getAttribute('id')).toBe('api_key')
  })

  it('should render reveal button', () => {
    render(<SecretField field={defaultField} value="" onChange={() => {}} />)

    const revealButton = screen.getByTestId('reveal-button')
    expect(revealButton).toBeDefined()
  })

  it('should toggle input type when reveal button is clicked', () => {
    render(
      <SecretField
        field={defaultField}
        value="my-secret"
        onChange={() => {}}
      />
    )

    const input = screen.getByTestId('secret-input')
    const revealButton = screen.getByTestId('reveal-button')

    expect(input.getAttribute('type')).toBe('password')

    fireEvent.click(revealButton)
    expect(input.getAttribute('type')).toBe('text')
  })
})
