/**
 * FieldEditor 组件测试
 */
import { describe, it, expect, vi } from 'bun:test'
import { render, screen, fireEvent } from '@testing-library/react'
import { FieldEditor } from './FieldEditor'

describe('FieldEditor', () => {
  const mockField = {
    id: '1',
    name: 'title',
    type: 'text',
    required: false,
    options: {},
  }

  it('should render field name input', () => {
    render(<FieldEditor field={mockField} onChange={() => {}} />)

    expect(screen.getByDisplayValue('title')).toBeInTheDocument()
  })

  it('should render field type selector', () => {
    render(<FieldEditor field={mockField} onChange={() => {}} />)

    expect(screen.getByText('text')).toBeInTheDocument()
  })

  it('should call onChange when name changes', () => {
    const handleChange = vi.fn()
    render(<FieldEditor field={mockField} onChange={handleChange} />)

    const input = screen.getByDisplayValue('title')
    fireEvent.change(input, { target: { value: 'newName' } })

    expect(handleChange).toHaveBeenCalled()
  })

  it('should show required toggle', () => {
    render(<FieldEditor field={mockField} onChange={() => {}} />)

    expect(screen.getByText(/required/i)).toBeInTheDocument()
  })

  it('should disable name input for system fields', () => {
    const systemField = { ...mockField, system: true }
    render(<FieldEditor field={systemField} onChange={() => {}} />)

    const input = screen.getByDisplayValue('title')
    expect(input).toBeDisabled()
  })
})
