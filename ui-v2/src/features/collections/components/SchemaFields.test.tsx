/**
 * SchemaFields 组件测试
 */
import { describe, it, expect, vi } from 'bun:test'
import { render, screen, fireEvent } from '@testing-library/react'
import { SchemaFields } from './SchemaFields'

describe('SchemaFields', () => {
  const mockFields = [
    { id: '1', name: 'title', type: 'text', required: true, options: {} },
    { id: '2', name: 'count', type: 'number', required: false, options: {} },
  ]

  it('should render list of fields', () => {
    render(<SchemaFields fields={mockFields} onChange={() => {}} />)

    expect(screen.getByDisplayValue('title')).toBeInTheDocument()
    expect(screen.getByDisplayValue('count')).toBeInTheDocument()
  })

  it('should show field type icons', () => {
    render(<SchemaFields fields={mockFields} onChange={() => {}} />)

    // 应该有字段类型标识
    expect(screen.getByText('text')).toBeInTheDocument()
    expect(screen.getByText('number')).toBeInTheDocument()
  })

  it('should call onChange when field is modified', () => {
    const handleChange = vi.fn()
    render(<SchemaFields fields={mockFields} onChange={handleChange} />)

    const input = screen.getByDisplayValue('title')
    fireEvent.change(input, { target: { value: 'newTitle' } })

    expect(handleChange).toHaveBeenCalled()
  })

  it('should show add field button', () => {
    render(<SchemaFields fields={[]} onChange={() => {}} />)

    expect(screen.getByText(/add field/i)).toBeInTheDocument()
  })

  it('should add new field when button clicked', () => {
    const handleChange = vi.fn()
    render(<SchemaFields fields={[]} onChange={handleChange} />)

    const addBtn = screen.getByText(/add field/i)
    fireEvent.click(addBtn)

    expect(handleChange).toHaveBeenCalled()
  })
})
