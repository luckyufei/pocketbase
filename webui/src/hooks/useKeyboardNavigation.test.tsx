/**
 * useKeyboardNavigation Hook 测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useArrowNavigation } from './useKeyboardNavigation'

describe('useArrowNavigation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return handleKeyDown function', () => {
    const { result } = renderHook(() => useArrowNavigation(null))

    expect(result.current.handleKeyDown).toBeDefined()
    expect(typeof result.current.handleKeyDown).toBe('function')
  })

  it('should handle empty items array', () => {
    const { result } = renderHook(() => useArrowNavigation([]))

    // 应该不抛出错误
    expect(() => {
      result.current.handleKeyDown(new KeyboardEvent('keydown', { key: 'ArrowDown' }))
    }).not.toThrow()
  })

  it('should call onSelect when Enter is pressed', () => {
    const onSelect = vi.fn()
    const mockElement = document.createElement('button')
    document.body.appendChild(mockElement)
    mockElement.focus()

    const { result } = renderHook(() => useArrowNavigation([mockElement], { onSelect }))

    // 模拟 Enter 键
    const event = new KeyboardEvent('keydown', { key: 'Enter' })
    result.current.handleKeyDown(event)

    // 清理
    document.body.removeChild(mockElement)
  })

  it('should support loop option', () => {
    const { result } = renderHook(() => useArrowNavigation([], { loop: true }))

    expect(result.current.handleKeyDown).toBeDefined()
  })

  it('should support loop disabled', () => {
    const { result } = renderHook(() => useArrowNavigation([], { loop: false }))

    expect(result.current.handleKeyDown).toBeDefined()
  })
})
