/**
 * useAutocomplete Hook 测试
 * TDD: 绿灯阶段
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAutocomplete } from './useAutocomplete'

const mockOptions = [
  { value: 'name', label: 'Name', description: '记录名称' },
  { value: 'email', label: 'Email', description: '邮箱地址' },
  { value: 'created', label: 'Created', description: '创建时间' },
]

describe('useAutocomplete', () => {
  it('should initialize with empty input value', () => {
    const { result } = renderHook(() => useAutocomplete({ options: mockOptions }))

    expect(result.current.inputValue).toBe('')
    expect(result.current.isOpen).toBe(false)
    expect(result.current.highlightedIndex).toBe(0)
  })

  it('should initialize with controlled value', () => {
    const { result } = renderHook(() => useAutocomplete({ options: mockOptions, value: 'test' }))

    expect(result.current.inputValue).toBe('test')
  })

  it('should filter options based on input', () => {
    const { result } = renderHook(() => useAutocomplete({ options: mockOptions }))

    act(() => {
      result.current.setInputValue('email')
    })

    expect(result.current.filteredOptions).toHaveLength(1)
    expect(result.current.filteredOptions[0].value).toBe('email')
  })

  it('should filter options case-insensitively', () => {
    const { result } = renderHook(() => useAutocomplete({ options: mockOptions }))

    act(() => {
      result.current.setInputValue('EMAIL')
    })

    expect(result.current.filteredOptions).toHaveLength(1)
    expect(result.current.filteredOptions[0].value).toBe('email')
  })

  it('should call onChange when input changes', () => {
    const onChange = vi.fn()
    const { result } = renderHook(() => useAutocomplete({ options: mockOptions, onChange }))

    act(() => {
      result.current.setInputValue('test')
    })

    expect(onChange).toHaveBeenCalledWith('test')
  })

  it('should handle select option', () => {
    const onSelect = vi.fn()
    const { result } = renderHook(() => useAutocomplete({ options: mockOptions, onSelect }))

    act(() => {
      result.current.setInputValue('n')
      result.current.handleSelect(mockOptions[0])
    })

    expect(onSelect).toHaveBeenCalledWith(mockOptions[0])
    expect(result.current.isOpen).toBe(false)
  })

  it('should open dropdown on focus when input has content', () => {
    const { result } = renderHook(() => useAutocomplete({ options: mockOptions, value: 'n' }))

    act(() => {
      result.current.handleFocus()
    })

    expect(result.current.isOpen).toBe(true)
  })

  it('should navigate options with arrow keys', () => {
    const { result } = renderHook(() => useAutocomplete({ options: mockOptions, value: 'e' }))

    act(() => {
      result.current.setIsOpen(true)
    })

    // Arrow down
    act(() => {
      result.current.handleKeyDown({
        key: 'ArrowDown',
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent)
    })

    expect(result.current.highlightedIndex).toBe(1)

    // Arrow up
    act(() => {
      result.current.handleKeyDown({
        key: 'ArrowUp',
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent)
    })

    expect(result.current.highlightedIndex).toBe(0)
  })

  it('should close dropdown on Escape', () => {
    const { result } = renderHook(() => useAutocomplete({ options: mockOptions, value: 'e' }))

    act(() => {
      result.current.setIsOpen(true)
    })

    expect(result.current.isOpen).toBe(true)

    act(() => {
      result.current.handleKeyDown({
        key: 'Escape',
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent)
    })

    expect(result.current.isOpen).toBe(false)
  })

  it('should respect maxResults option', () => {
    const manyOptions = Array.from({ length: 20 }, (_, i) => ({
      value: `option${i}`,
      label: `Option ${i}`,
    }))

    const { result } = renderHook(() =>
      useAutocomplete({ options: manyOptions, maxResults: 5, value: 'option' })
    )

    expect(result.current.filteredOptions.length).toBeLessThanOrEqual(5)
  })

  it('should respect minSearchLength option', () => {
    const { result } = renderHook(() =>
      useAutocomplete({ options: mockOptions, minSearchLength: 2, value: 'n' })
    )

    expect(result.current.filteredOptions).toHaveLength(0)

    act(() => {
      result.current.setInputValue('na')
    })

    expect(result.current.filteredOptions.length).toBeGreaterThan(0)
  })

  it('should reset state', () => {
    const { result } = renderHook(() => useAutocomplete({ options: mockOptions }))

    act(() => {
      result.current.setInputValue('test')
      result.current.setIsOpen(true)
      result.current.setHighlightedIndex(2)
    })

    act(() => {
      result.current.reset()
    })

    expect(result.current.inputValue).toBe('')
    expect(result.current.isOpen).toBe(false)
    expect(result.current.highlightedIndex).toBe(0)
  })

  it('should use custom search function', () => {
    const customSearchFunc = vi.fn((option, search) => {
      return option.description?.includes(search) ?? false
    })

    const { result } = renderHook(() =>
      useAutocomplete({
        options: mockOptions,
        searchFunc: customSearchFunc,
        value: '邮箱',
      })
    )

    expect(customSearchFunc).toHaveBeenCalled()
    expect(result.current.filteredOptions).toHaveLength(1)
    expect(result.current.filteredOptions[0].value).toBe('email')
  })
})
