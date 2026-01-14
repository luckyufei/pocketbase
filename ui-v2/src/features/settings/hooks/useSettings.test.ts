/**
 * useSettings Hook 测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { Provider, createStore } from 'jotai'
import { createElement } from 'react'
import { useSettings } from './useSettings'

// Mock API client
vi.mock('@/lib/ApiClient', () => ({
  getApiClient: () => ({
    settings: {
      getAll: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
    },
    send: vi.fn().mockResolvedValue({}),
  }),
}))

function createWrapper(store: ReturnType<typeof createStore>) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return createElement(Provider, { store }, children)
  }
}

describe('useSettings', () => {
  let store: ReturnType<typeof createStore>

  beforeEach(() => {
    store = createStore()
    vi.clearAllMocks()
  })

  it('should return settings (may be null or object)', () => {
    const { result } = renderHook(() => useSettings(), {
      wrapper: createWrapper(store),
    })

    // settings 可能是 null 或对象
    expect(result.current.settings === null || typeof result.current.settings === 'object').toBe(
      true
    )
  })

  it('should return isLoading as false initially', () => {
    const { result } = renderHook(() => useSettings(), {
      wrapper: createWrapper(store),
    })

    expect(result.current.isLoading).toBe(false)
  })

  it('should return isSaving as false initially', () => {
    const { result } = renderHook(() => useSettings(), {
      wrapper: createWrapper(store),
    })

    expect(result.current.isSaving).toBe(false)
  })

  it('should return hasChanges as false initially', () => {
    const { result } = renderHook(() => useSettings(), {
      wrapper: createWrapper(store),
    })

    expect(result.current.hasChanges).toBe(false)
  })

  it('should have loadSettings function', () => {
    const { result } = renderHook(() => useSettings(), {
      wrapper: createWrapper(store),
    })

    expect(typeof result.current.loadSettings).toBe('function')
  })

  it('should have saveSettings function', () => {
    const { result } = renderHook(() => useSettings(), {
      wrapper: createWrapper(store),
    })

    expect(typeof result.current.saveSettings).toBe('function')
  })

  it('should have updateSettings function', () => {
    const { result } = renderHook(() => useSettings(), {
      wrapper: createWrapper(store),
    })

    expect(typeof result.current.updateSettings).toBe('function')
  })

  it('should have resetSettings function', () => {
    const { result } = renderHook(() => useSettings(), {
      wrapper: createWrapper(store),
    })

    expect(typeof result.current.resetSettings).toBe('function')
  })

  it('should return healthData', () => {
    const { result } = renderHook(() => useSettings(), {
      wrapper: createWrapper(store),
    })

    expect(result.current.healthData).toBeDefined()
  })
})
