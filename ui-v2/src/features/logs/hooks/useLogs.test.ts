/**
 * useLogs Hook 测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { Provider, createStore } from 'jotai'
import { createElement } from 'react'
import { useLogs } from './useLogs'

// Mock API client
vi.mock('@/lib/ApiClient', () => ({
  getApiClient: () => ({
    collection: () => ({
      getList: vi.fn().mockResolvedValue({
        items: [],
        totalItems: 0,
        totalPages: 0,
      }),
    }),
    send: vi.fn().mockResolvedValue({ items: [] }),
  }),
}))

function createWrapper(store: ReturnType<typeof createStore>) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return createElement(Provider, { store }, children)
  }
}

describe('useLogs', () => {
  let store: ReturnType<typeof createStore>

  beforeEach(() => {
    store = createStore()
    vi.clearAllMocks()
  })

  it('should return logs array', () => {
    const { result } = renderHook(() => useLogs(), {
      wrapper: createWrapper(store),
    })

    expect(Array.isArray(result.current.logs)).toBe(true)
  })

  it('should return activeLog as null initially', () => {
    const { result } = renderHook(() => useLogs(), {
      wrapper: createWrapper(store),
    })

    expect(result.current.activeLog).toBeNull()
  })

  it('should return isLoading as false initially', () => {
    const { result } = renderHook(() => useLogs(), {
      wrapper: createWrapper(store),
    })

    expect(result.current.isLoading).toBe(false)
  })

  it('should return filter state', () => {
    const { result } = renderHook(() => useLogs(), {
      wrapper: createWrapper(store),
    })

    expect(result.current.filter).toBeDefined()
  })

  it('should return sort state', () => {
    const { result } = renderHook(() => useLogs(), {
      wrapper: createWrapper(store),
    })

    expect(result.current.sort).toBeDefined()
  })

  it('should have loadLogs function', () => {
    const { result } = renderHook(() => useLogs(), {
      wrapper: createWrapper(store),
    })

    expect(typeof result.current.loadLogs).toBe('function')
  })

  it('should have setActiveLog function', () => {
    const { result } = renderHook(() => useLogs(), {
      wrapper: createWrapper(store),
    })

    expect(typeof result.current.setActiveLog).toBe('function')
  })

  it('should have setFilter function', () => {
    const { result } = renderHook(() => useLogs(), {
      wrapper: createWrapper(store),
    })

    expect(typeof result.current.setFilter).toBe('function')
  })

  it('should have setSort function', () => {
    const { result } = renderHook(() => useLogs(), {
      wrapper: createWrapper(store),
    })

    expect(typeof result.current.setSort).toBe('function')
  })

  it('should have loadMore function', () => {
    const { result } = renderHook(() => useLogs(), {
      wrapper: createWrapper(store),
    })

    expect(typeof result.current.loadMore).toBe('function')
  })

  it('should have refresh function', () => {
    const { result } = renderHook(() => useLogs(), {
      wrapper: createWrapper(store),
    })

    expect(typeof result.current.refresh).toBe('function')
  })

  it('should have deleteLog function', () => {
    const { result } = renderHook(() => useLogs(), {
      wrapper: createWrapper(store),
    })

    expect(typeof result.current.deleteLog).toBe('function')
  })

  it('should have clearLogs function', () => {
    const { result } = renderHook(() => useLogs(), {
      wrapper: createWrapper(store),
    })

    expect(typeof result.current.clearLogs).toBe('function')
  })

  it('should have setZoom function', () => {
    const { result } = renderHook(() => useLogs(), {
      wrapper: createWrapper(store),
    })

    expect(typeof result.current.setZoom).toBe('function')
  })

  it('should update filter', () => {
    const { result } = renderHook(() => useLogs(), {
      wrapper: createWrapper(store),
    })

    act(() => {
      result.current.setFilter({ level: 'error' })
    })

    expect(result.current.filter.level).toBe('error')
  })

  it('should update sort', () => {
    const { result } = renderHook(() => useLogs(), {
      wrapper: createWrapper(store),
    })

    act(() => {
      result.current.setSort({ field: 'created', direction: 'asc' })
    })

    expect(result.current.sort.field).toBe('created')
    expect(result.current.sort.direction).toBe('asc')
  })
})
