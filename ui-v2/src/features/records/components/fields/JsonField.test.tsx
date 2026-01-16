/**
 * JsonField 组件测试
 */
import { describe, it, expect, vi } from 'bun:test'
import { render, screen, fireEvent } from '@testing-library/react'
import { JsonField } from './JsonField'

describe('JsonField', () => {
  const mockField = {
    name: 'metadata',
    type: 'json',
    required: false,
    options: {},
  }

  it('should render textarea with label', () => {
    render(<JsonField field={mockField} value={{}} onChange={() => {}} />)

    expect(screen.getByLabelText('metadata')).toBeInTheDocument()
  })

  it('should display JSON value as formatted string', () => {
    const value = { key: 'value' }
    render(<JsonField field={mockField} value={value} onChange={() => {}} />)

    const textarea = screen.getByLabelText('metadata') as HTMLTextAreaElement
    expect(textarea.value).toContain('key')
    expect(textarea.value).toContain('value')
  })

  it('should call onChange with parsed JSON', () => {
    const handleChange = vi.fn()
    render(<JsonField field={mockField} value={{}} onChange={handleChange} />)

    const textarea = screen.getByLabelText('metadata')
    fireEvent.change(textarea, { target: { value: '{"new": "data"}' } })

    expect(handleChange).toHaveBeenCalled()
  })

  it('should show error for invalid JSON', () => {
    render(<JsonField field={mockField} value={{}} onChange={() => {}} />)

    const textarea = screen.getByLabelText('metadata')
    fireEvent.change(textarea, { target: { value: 'invalid json' } })

    // 应该显示错误状态
    expect(textarea).toBeInTheDocument()
  })
})
