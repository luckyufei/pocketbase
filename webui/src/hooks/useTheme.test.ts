/**
 * useTheme Hook 测试
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTheme } from './useTheme'

describe('useTheme Hook', () => {
  beforeEach(() => {
    // 清理 localStorage
    localStorage.clear()
    // 清理 DOM
    document.documentElement.classList.remove('dark')
    vi.clearAllMocks()
  })

  it('should default to system theme', () => {
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('system')
  })

  it('should toggle theme', () => {
    const { result } = renderHook(() => useTheme())

    act(() => {
      result.current.setTheme('light')
    })

    expect(result.current.appliedTheme).toBe('light')
    expect(result.current.isDark).toBe(false)

    act(() => {
      result.current.toggleTheme()
    })

    expect(result.current.appliedTheme).toBe('dark')
    expect(result.current.isDark).toBe(true)
  })

  it('should persist theme to localStorage', () => {
    const { result } = renderHook(() => useTheme())

    act(() => {
      result.current.setTheme('dark')
    })

    expect(localStorage.getItem('pocketbase-theme')).toBe('dark')
  })

  it('should apply dark class to document', () => {
    const { result } = renderHook(() => useTheme())

    act(() => {
      result.current.setTheme('dark')
    })

    expect(document.documentElement.classList.contains('dark')).toBe(true)

    act(() => {
      result.current.setTheme('light')
    })

    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('should load theme from localStorage', () => {
    localStorage.setItem('pocketbase-theme', 'dark')
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('dark')
  })
})
