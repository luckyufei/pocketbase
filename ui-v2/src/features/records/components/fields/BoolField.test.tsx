/**
 * BoolField 组件测试
 */
import { describe, it, expect, vi } from 'bun:test'
import { render, screen, fireEvent } from '@testing-library/react'
import { BoolField } from './BoolField'

describe('BoolField', () => {
  const mockField = {
    name: 'active',
    type: 'bool',
    required: false,
    options: {},
  }

  it('should render checkbox with label', () => {
    render(<BoolField field={mockField} value={false} onChange={() => {}} />)

    expect(screen.getByLabelText('active')).toBeInTheDocument()
  })

  it('should be checked when value is true', () => {
    render(<BoolField field={mockField} value={true} onChange={() => {}} />)

    const checkbox = screen.getByLabelText('active') as HTMLInputElement
    expect(checkbox.checked).toBe(true)
  })

  it('should be unchecked when value is false', () => {
    render(<BoolField field={mockField} value={false} onChange={() => {}} />)

    const checkbox = screen.getByLabelText('active') as HTMLInputElement
    expect(checkbox.checked).toBe(false)
  })

  it('should call onChange when toggled', () => {
    const handleChange = vi.fn()
    render(<BoolField field={mockField} value={false} onChange={handleChange} />)

    const checkbox = screen.getByLabelText('active')
    fireEvent.click(checkbox)

    expect(handleChange).toHaveBeenCalledWith(true)
  })
})
