/**
 * TracesFilter 组件测试
 */
import { describe, it, expect, vi } from 'bun:test'
import { render, screen, fireEvent } from '@testing-library/react'
import { TracesFilter } from './TracesFilter'

describe('TracesFilter', () => {
  const defaultFilters = {
    method: '',
    status: '',
    search: '',
  }

  it('should render filter inputs', () => {
    render(<TracesFilter filters={defaultFilters} onChange={() => {}} />)

    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument()
  })

  it('should render method selector', () => {
    render(<TracesFilter filters={defaultFilters} onChange={() => {}} />)

    // 使用 getAllByText 并检查至少有一个
    const methodElements = screen.getAllByText(/method/i)
    expect(methodElements.length).toBeGreaterThan(0)
  })

  it('should call onChange when filter changes', () => {
    const handleChange = vi.fn()
    render(<TracesFilter filters={defaultFilters} onChange={handleChange} />)

    const input = screen.getByPlaceholderText(/search/i)
    fireEvent.change(input, { target: { value: '/api/users' } })

    expect(handleChange).toHaveBeenCalled()
  })
})
