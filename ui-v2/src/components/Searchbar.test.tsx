/**
 * Searchbar 组件测试
 * TDD: 绿灯阶段
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Searchbar } from './Searchbar'

describe('Searchbar', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should render with placeholder', () => {
    render(<Searchbar placeholder="Search..." />)
    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument()
  })

  it('should render with default placeholder', () => {
    render(<Searchbar />)
    expect(screen.getByPlaceholderText('搜索...')).toBeInTheDocument()
  })

  it('should call onChange when typing', async () => {
    const onChange = vi.fn()
    render(<Searchbar onChange={onChange} />)

    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'test' } })

    expect(onChange).toHaveBeenCalledWith('test')
  })

  it('should debounce onSearch calls', async () => {
    const onSearch = vi.fn()
    render(<Searchbar onSearch={onSearch} debounceMs={300} />)

    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'test' } })

    // 搜索还没被调用
    expect(onSearch).not.toHaveBeenCalled()

    // 等待防抖时间
    vi.advanceTimersByTime(300)

    expect(onSearch).toHaveBeenCalledWith('test')
  })

  it('should call onSearch immediately on Enter', async () => {
    const onSearch = vi.fn()
    render(<Searchbar onSearch={onSearch} />)

    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'test' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onSearch).toHaveBeenCalledWith('test')
  })

  it('should show clear button when has value', () => {
    render(<Searchbar value="test" />)
    expect(screen.getByRole('button', { name: /清空/i })).toBeInTheDocument()
  })

  it('should not show clear button when empty', () => {
    render(<Searchbar value="" />)
    expect(screen.queryByRole('button', { name: /清空/i })).not.toBeInTheDocument()
  })

  it('should clear value when clear button clicked', () => {
    const onChange = vi.fn()
    const onSearch = vi.fn()
    render(<Searchbar value="test" onChange={onChange} onSearch={onSearch} />)

    fireEvent.click(screen.getByRole('button', { name: /清空/i }))

    expect(onChange).toHaveBeenCalledWith('')
    expect(onSearch).toHaveBeenCalledWith('')
  })

  it('should apply custom className', () => {
    const { container } = render(<Searchbar className="custom-class" />)
    expect(container.firstChild).toHaveClass('custom-class')
  })
})
