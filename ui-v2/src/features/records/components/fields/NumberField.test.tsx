/**
 * NumberField 组件测试
 */
import { describe, it, expect, vi } from 'bun:test'
import { render, screen, fireEvent } from '@testing-library/react'
import { NumberField } from './NumberField'

describe('NumberField', () => {
  const mockField = {
    name: 'age',
    type: 'number',
    required: false,
    options: {},
  }

  it('should render number input with label', () => {
    render(<NumberField field={mockField} value={0} onChange={() => {}} />)

    expect(screen.getByLabelText('age')).toBeInTheDocument()
  })

  it('should display numeric value', () => {
    render(<NumberField field={mockField} value={25} onChange={() => {}} />)

    const input = screen.getByLabelText('age') as HTMLInputElement
    expect(input.value).toBe('25')
  })

  it('should call onChange with number when value changes', () => {
    const handleChange = vi.fn()
    render(<NumberField field={mockField} value={0} onChange={handleChange} />)

    const input = screen.getByLabelText('age')
    fireEvent.change(input, { target: { value: '42' } })

    expect(handleChange).toHaveBeenCalledWith(42)
  })

  it('should respect min/max constraints', () => {
    const constrainedField = {
      ...mockField,
      options: { min: 0, max: 100 },
    }
    render(<NumberField field={constrainedField} value={50} onChange={() => {}} />)

    const input = screen.getByLabelText('age')
    expect(input).toHaveAttribute('min', '0')
    expect(input).toHaveAttribute('max', '100')
  })

  it('should show required indicator when field is required', () => {
    const requiredField = { ...mockField, required: true }
    render(<NumberField field={requiredField} value={0} onChange={() => {}} />)

    const input = screen.getByLabelText('age')
    expect(input).toHaveAttribute('required')
  })
})
