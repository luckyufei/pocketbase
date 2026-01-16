/**
 * SelectField 组件测试
 */
import { describe, it, expect, vi } from 'bun:test'
import { render, screen, fireEvent } from '@testing-library/react'
import { SelectField } from './SelectField'

describe('SelectField', () => {
  const mockField = {
    name: 'status',
    type: 'select',
    required: false,
    options: {
      values: ['draft', 'published', 'archived'],
    },
  }

  it('should render select with label', () => {
    render(<SelectField field={mockField} value="" onChange={() => {}} />)

    expect(screen.getByText('status')).toBeInTheDocument()
  })

  it('should display options', () => {
    render(<SelectField field={mockField} value="" onChange={() => {}} />)

    // 点击触发器打开下拉
    const trigger = screen.getByRole('combobox')
    fireEvent.click(trigger)

    // 检查选项存在
    expect(screen.getByText('draft')).toBeInTheDocument()
  })

  it('should display selected value', () => {
    render(<SelectField field={mockField} value="published" onChange={() => {}} />)

    expect(screen.getByText('published')).toBeInTheDocument()
  })

  it('should call onChange when selection changes', () => {
    const handleChange = vi.fn()
    render(<SelectField field={mockField} value="" onChange={handleChange} />)

    const trigger = screen.getByRole('combobox')
    fireEvent.click(trigger)

    const option = screen.getByText('draft')
    fireEvent.click(option)

    expect(handleChange).toHaveBeenCalledWith('draft')
  })
})
