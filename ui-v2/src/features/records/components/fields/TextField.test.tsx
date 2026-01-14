/**
 * TextField 组件测试
 */
import { describe, it, expect, vi } from 'bun:test'
import { render, screen, fireEvent } from '@testing-library/react'
import { TextField } from './TextField'

describe('TextField', () => {
  const mockField = {
    name: 'title',
    type: 'text',
    required: false,
    options: {},
  }

  it('should render input with label', () => {
    render(<TextField field={mockField} value="" onChange={() => {}} />)

    expect(screen.getByLabelText('title')).toBeInTheDocument()
  })

  it('should display value', () => {
    render(<TextField field={mockField} value="Hello" onChange={() => {}} />)

    const input = screen.getByLabelText('title') as HTMLInputElement
    expect(input.value).toBe('Hello')
  })

  it('should call onChange when value changes', () => {
    const handleChange = vi.fn()
    render(<TextField field={mockField} value="" onChange={handleChange} />)

    const input = screen.getByLabelText('title')
    fireEvent.change(input, { target: { value: 'New value' } })

    expect(handleChange).toHaveBeenCalledWith('New value')
  })

  it('should show required indicator when field is required', () => {
    const requiredField = { ...mockField, required: true }
    render(<TextField field={requiredField} value="" onChange={() => {}} />)

    const input = screen.getByLabelText('title')
    expect(input).toHaveAttribute('required')
  })

  it('should show placeholder for autogenerate', () => {
    const autoField = {
      ...mockField,
      options: { autogeneratePattern: '[a-z]{8}' },
    }
    render(<TextField field={autoField} value="" onChange={() => {}} isNew={true} />)

    const input = screen.getByPlaceholderText(/autogenerate/i)
    expect(input).toBeInTheDocument()
  })
})
