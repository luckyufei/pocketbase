/**
 * DateField 组件测试
 */
import { describe, it, expect, vi } from 'bun:test'
import { render, screen, fireEvent } from '@testing-library/react'
import { DateField } from './DateField'

describe('DateField', () => {
  const mockField = {
    name: 'created',
    type: 'date',
    required: false,
    options: {},
  }

  it('should render date input with label', () => {
    render(<DateField field={mockField} value="" onChange={() => {}} />)

    expect(screen.getByLabelText('created')).toBeInTheDocument()
  })

  it('should display date value', () => {
    render(<DateField field={mockField} value="2024-01-15" onChange={() => {}} />)

    const input = screen.getByLabelText('created') as HTMLInputElement
    expect(input.value).toBe('2024-01-15')
  })

  it('should call onChange when date changes', () => {
    const handleChange = vi.fn()
    render(<DateField field={mockField} value="" onChange={handleChange} />)

    const input = screen.getByLabelText('created')
    fireEvent.change(input, { target: { value: '2024-06-20' } })

    expect(handleChange).toHaveBeenCalledWith('2024-06-20')
  })

  it('should show required indicator when field is required', () => {
    const requiredField = { ...mockField, required: true }
    render(<DateField field={requiredField} value="" onChange={() => {}} />)

    const input = screen.getByLabelText('created')
    expect(input).toHaveAttribute('required')
  })
})
