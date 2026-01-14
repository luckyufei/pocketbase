/**
 * useMetrics Hook 测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { Provider, createStore } from 'jotai'
import { createElement } from 'react'
import { useMetrics } from './useMetrics'

// Mock API client
vi.mock('@/lib/ApiClient', () => ({
  getApiClient: () => ({
    send: vi.fn().mockResolvedValue({}),
  }),
}))

function createWrapper(store: ReturnType<typeof createStore>) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return createElement(Provider, { store }, children)
  }
}

describe('useMetrics', () => {
  let store: ReturnType<typeof createStore>

  beforeEach(() => {
    store = createStore()
    vi.clearAllMocks()
  })

  it('should return currentMetrics as null initially', () => {
    const { result } = renderHook(() => useMetrics(), {
      wrapper: createWrapper(store),
    })

    expect(result.current.currentMetrics).toBeNull()
  })

  it('should return isLoading as false initially', () => {
    const { result } = renderHook(() => useMetrics(), {
      wrapper: createWrapper(store),
    })

    expect(result.current.isLoading).toBe(false)
  })

  it('should return error as null initially', () => {
    const { result } = renderHook(() => useMetrics(), {
      wrapper: createWrapper(store),
    })

    expect(result.current.error).toBeNull()
  })

  it('should return selectedRange', () => {
    const { result } = renderHook(() => useMetrics(), {
      wrapper: createWrapper(store),
    })

    expect(result.current.selectedRange).toBeDefined()
  })

  it('should have loadData function', () => {
    const { result } = renderHook(() => useMetrics(), {
      wrapper: createWrapper(store),
    })

    expect(typeof result.current.loadData).toBe('function')
  })

  it('should have refresh function', () => {
    const { result } = renderHook(() => useMetrics(), {
      wrapper: createWrapper(store),
    })

    expect(typeof result.current.refresh).toBe('function')
  })

  it('should have changeRange function', () => {
    const { result } = renderHook(() => useMetrics(), {
      wrapper: createWrapper(store),
    })

    expect(typeof result.current.changeRange).toBe('function')
  })

  it('should have startAutoRefresh function', () => {
    const { result } = renderHook(() => useMetrics(), {
      wrapper: createWrapper(store),
    })

    expect(typeof result.current.startAutoRefresh).toBe('function')
  })

  it('should have stopAutoRefresh function', () => {
    const { result } = renderHook(() => useMetrics(), {
      wrapper: createWrapper(store),
    })

    expect(typeof result.current.stopAutoRefresh).toBe('function')
  })

  it('should update selectedRange when changeRange is called', () => {
    const { result } = renderHook(() => useMetrics(), {
      wrapper: createWrapper(store),
    })

    act(() => {
      result.current.changeRange('7d')
    })

    expect(result.current.selectedRange).toBe('7d')
  })
})
