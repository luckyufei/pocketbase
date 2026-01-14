/**
 * FilterAutocompleteInput 组件测试
 * TDD: 绿灯阶段
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FilterAutocompleteInput } from './FilterAutocompleteInput'

const mockOptions = [
  { value: 'name', label: 'Name', description: '记录名称' },
  { value: 'email', label: 'Email', description: '邮箱地址' },
  { value: 'created', label: 'Created', description: '创建时间' },
]

describe('FilterAutocompleteInput', () => {
  it('should render with placeholder', () => {
    render(<FilterAutocompleteInput options={mockOptions} placeholder="Filter..." />)
    expect(screen.getByPlaceholderText('Filter...')).toBeInTheDocument()
  })

  it('should render with default placeholder', () => {
    render(<FilterAutocompleteInput options={mockOptions} />)
    expect(
      screen.getByPlaceholderText('Leave empty to grant everyone access...')
    ).toBeInTheDocument()
  })

  it('should show options when typing', () => {
    render(<FilterAutocompleteInput options={mockOptions} />)

    const input = screen.getByRole('textbox')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'n' } })

    expect(screen.getByRole('listbox')).toBeInTheDocument()
    expect(screen.getByText('Name')).toBeInTheDocument()
  })

  it('should filter options based on input', () => {
    render(<FilterAutocompleteInput options={mockOptions} />)

    const input = screen.getByRole('textbox')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'email' } })

    expect(screen.getByText('Email')).toBeInTheDocument()
    expect(screen.queryByText('Name')).not.toBeInTheDocument()
  })

  it('should call onChange when typing', () => {
    const onChange = vi.fn()
    render(<FilterAutocompleteInput options={mockOptions} onChange={onChange} />)

    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'test' } })

    expect(onChange).toHaveBeenCalledWith('test')
  })

  it('should select option on click', () => {
    const onChange = vi.fn()
    render(<FilterAutocompleteInput options={mockOptions} onChange={onChange} />)

    const input = screen.getByRole('textbox')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'n' } })
    fireEvent.click(screen.getByText('Name'))

    expect(onChange).toHaveBeenCalledWith('name')
  })

  it('should append option to existing filter value', () => {
    const onChange = vi.fn()
    render(<FilterAutocompleteInput options={mockOptions} onChange={onChange} />)

    const input = screen.getByRole('textbox')
    fireEvent.focus(input)
    // 先输入 "status "，然后输入 "n" 触发下拉
    fireEvent.change(input, { target: { value: 'status n' } })
    fireEvent.click(screen.getByText('Name'))

    expect(onChange).toHaveBeenCalledWith('status name')
  })

  it('should navigate options with keyboard', () => {
    render(<FilterAutocompleteInput options={mockOptions} />)

    const input = screen.getByRole('textbox')
    fireEvent.focus(input)
    // 输入 'e' 匹配多个选项: Name, Email, Created
    fireEvent.change(input, { target: { value: 'e' } })

    // 按下箭头选中第二个
    fireEvent.keyDown(input, { key: 'ArrowDown' })

    const options = screen.getAllByRole('option')
    expect(options.length).toBeGreaterThan(1)
    expect(options[1]).toHaveAttribute('aria-selected', 'true')
  })

  it('should select option on Enter', () => {
    const onChange = vi.fn()
    render(<FilterAutocompleteInput options={mockOptions} onChange={onChange} />)

    const input = screen.getByRole('textbox')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'n' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onChange).toHaveBeenCalledWith('name')
  })

  it('should close dropdown on Escape', () => {
    render(<FilterAutocompleteInput options={mockOptions} />)

    const input = screen.getByRole('textbox')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'n' } })
    expect(screen.getByRole('listbox')).toBeInTheDocument()

    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('should show option descriptions', () => {
    render(<FilterAutocompleteInput options={mockOptions} />)

    const input = screen.getByRole('textbox')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'n' } })

    expect(screen.getByText('记录名称')).toBeInTheDocument()
  })
})
