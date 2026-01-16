/**
 * LogsFilter 组件测试
 */
import { describe, it, expect, vi } from 'bun:test'
import { render, screen, fireEvent } from '@testing-library/react'
import { LogsFilter } from './LogsFilter'

describe('LogsFilter', () => {
  const defaultFilters = {
    level: '',
    search: '',
  }

  it('should render filter inputs', () => {
    render(<LogsFilter filters={defaultFilters} onChange={() => {}} />)

    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument()
  })

  it('should render level selector', () => {
    render(<LogsFilter filters={defaultFilters} onChange={() => {}} />)

    // 使用 getAllByText 并检查至少有一个
    const levelElements = screen.getAllByText(/level/i)
    expect(levelElements.length).toBeGreaterThan(0)
  })

  it('should call onChange when search changes', () => {
    const handleChange = vi.fn()
    render(<LogsFilter filters={defaultFilters} onChange={handleChange} />)

    const input = screen.getByPlaceholderText(/search/i)
    fireEvent.change(input, { target: { value: 'error' } })

    expect(handleChange).toHaveBeenCalled()
  })

  it('should show clear button when filters active', () => {
    const activeFilters = { level: 'error', search: 'test' }
    render(<LogsFilter filters={activeFilters} onChange={() => {}} />)

    expect(screen.getByText(/clear/i)).toBeInTheDocument()
  })
})
