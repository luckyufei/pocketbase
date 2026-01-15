/**
 * SecretFieldOptions.test.tsx - Secret 字段 Schema 配置测试
 */
import { describe, expect, it, mock } from 'bun:test'
import { render, screen, fireEvent } from '@testing-library/react'
import { SecretFieldOptions, type SecretField } from './SecretFieldOptions'

describe('SecretFieldOptions', () => {
  const defaultField: SecretField = {
    name: 'api_key',
    type: 'secret',
  }

  it('should render component', () => {
    render(<SecretFieldOptions field={defaultField} onChange={() => {}} />)
    const container = screen.getByTestId('secret-field-options')
    expect(container).toBeDefined()
  })

  it('should render maxSize input', () => {
    render(<SecretFieldOptions field={defaultField} onChange={() => {}} />)
    const input = screen.getByTestId('secret-maxSize-input')
    expect(input).toBeDefined()
    expect(input.getAttribute('placeholder')).toBe('Default: 4096')
  })

  it('should display current maxSize value', () => {
    const field: SecretField = { ...defaultField, maxSize: 2048 }
    render(<SecretFieldOptions field={field} onChange={() => {}} />)
    const input = screen.getByTestId('secret-maxSize-input') as HTMLInputElement
    expect(input.value).toBe('2048')
  })

  it('should call onChange when maxSize is changed', () => {
    const handleChange = mock(() => {})
    render(<SecretFieldOptions field={defaultField} onChange={handleChange} />)

    const input = screen.getByTestId('secret-maxSize-input')
    fireEvent.change(input, { target: { value: '2048' } })

    expect(handleChange).toHaveBeenCalledWith({
      ...defaultField,
      maxSize: 2048,
    })
  })

  it('should set hidden to true by default when undefined', () => {
    const handleChange = mock(() => {})
    render(<SecretFieldOptions field={defaultField} onChange={handleChange} />)

    expect(handleChange).toHaveBeenCalledWith({
      ...defaultField,
      hidden: true,
    })
  })

  it('should not override hidden if already set', () => {
    const handleChange = mock(() => {})
    const field: SecretField = { ...defaultField, hidden: false }
    render(<SecretFieldOptions field={field} onChange={handleChange} />)

    // onChange should not be called to set hidden since it's already defined
    expect(handleChange).not.toHaveBeenCalled()
  })

  it('should render encryption warning alert', () => {
    render(<SecretFieldOptions field={defaultField} onChange={() => {}} />)

    // Check for AES-256-GCM text
    expect(screen.getByText('AES-256-GCM')).toBeDefined()
    // Check for PB_MASTER_KEY text
    expect(screen.getByText('PB_MASTER_KEY')).toBeDefined()
  })

  it('should render warning about filters/searches', () => {
    render(<SecretFieldOptions field={defaultField} onChange={() => {}} />)

    expect(
      screen.getByText('Secret fields cannot be used in filters or searches.')
    ).toBeDefined()
  })

  it('should render "Secret fields are encrypted" title', () => {
    render(<SecretFieldOptions field={defaultField} onChange={() => {}} />)
    expect(screen.getByText('Secret fields are encrypted')).toBeDefined()
  })

  it('should handle empty maxSize input', () => {
    const handleChange = mock(() => {})
    const field: SecretField = { ...defaultField, maxSize: 2048 }
    render(<SecretFieldOptions field={field} onChange={handleChange} />)

    const input = screen.getByTestId('secret-maxSize-input')
    fireEvent.change(input, { target: { value: '' } })

    expect(handleChange).toHaveBeenCalledWith({
      ...field,
      maxSize: undefined,
    })
  })

  it('should have number input attributes', () => {
    render(<SecretFieldOptions field={defaultField} onChange={() => {}} />)
    const input = screen.getByTestId('secret-maxSize-input')

    expect(input.getAttribute('type')).toBe('number')
    expect(input.getAttribute('min')).toBe('1')
    expect(input.getAttribute('max')).toBe('4096')
    expect(input.getAttribute('step')).toBe('1')
  })
})
