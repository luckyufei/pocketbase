/**
 * useLogs Hook 测试
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { Provider } from 'jotai'
import { createStore } from 'jotai/vanilla'
import type { ReactNode } from 'react'

// 使用 vi.hoisted 确保 mock 函数在模块加载前创建
const { mockLogsGetList, mockLogsDelete } = vi.hoisted(() => ({
  mockLogsGetList: vi.fn(),
  mockLogsDelete: vi.fn(),
}))

// Mock before importing the hook
vi.mock('@/lib/ApiClient', () => ({
  getApiClient: () => ({
    logs: {
      getList: mockLogsGetList,
      delete: mockLogsDelete,
    },
  }),
}))

// Import after mock
import { useLogs } from './useLogs'

describe('useLogs Hook', () => {
  let store: ReturnType<typeof createStore>

  const createWrapper = () => {
    return ({ children }: { children: ReactNode }) => <Provider store={store}>{children}</Provider>
  }

  beforeEach(() => {
    store = createStore()
    vi.clearAllMocks()
    mockLogsGetList.mockResolvedValue({
      items: [
        { id: '1', level: 4, message: 'Info log', created: '2024-01-01T00:00:00Z', data: {} },
        { id: '2', level: 16, message: 'Error log', created: '2024-01-01T00:01:00Z', data: {} },
      ],
      page: 1,
      perPage: 50,
      totalItems: 2,
      totalPages: 1,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should initialize with empty logs', () => {
    const { result } = renderHook(() => useLogs(), { wrapper: createWrapper() })
    expect(result.current.logs).toEqual([])
    expect(result.current.isLoading).toBe(false)
  })

  it('should load logs', async () => {
    const { result } = renderHook(() => useLogs(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.loadLogs()
    })

    expect(mockLogsGetList).toHaveBeenCalled()
    expect(result.current.logs).toHaveLength(2)
  })

  it('should set filter', async () => {
    const { result } = renderHook(() => useLogs(), { wrapper: createWrapper() })

    act(() => {
      result.current.setFilter('level:error')
    })

    expect(result.current.filter).toBe('level:error')
  })

  it('should set sort', async () => {
    const { result } = renderHook(() => useLogs(), { wrapper: createWrapper() })

    act(() => {
      result.current.setSort('level')
    })

    expect(result.current.sort).toBe('level')
  })

  it('should set active log', async () => {
    const { result } = renderHook(() => useLogs(), { wrapper: createWrapper() })
    const log = { id: '1', level: 4, message: 'Test', created: '2024-01-01T00:00:00Z', data: {} }

    act(() => {
      result.current.setActiveLog(log)
    })

    expect(result.current.activeLog).toEqual(log)
  })

  it('should clear logs', async () => {
    const { result } = renderHook(() => useLogs(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.loadLogs()
    })

    expect(result.current.logs).toHaveLength(2)

    act(() => {
      result.current.clearLogs()
    })

    expect(result.current.logs).toHaveLength(0)
  })

  it('should load more logs', async () => {
    // 第一批 50 条，每条有唯一 id
    const firstBatch = Array.from({ length: 50 }, (_, i) => ({
      id: `log-${i}`,
      level: 4,
      message: `Log ${i}`,
      created: '2024-01-01T00:00:00Z',
      data: {},
    }))

    mockLogsGetList.mockResolvedValueOnce({
      items: firstBatch,
      page: 1,
      perPage: 50,
      totalItems: 100,
      totalPages: 2,
    })

    const { result } = renderHook(() => useLogs(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.loadLogs()
    })

    expect(result.current.hasMore).toBe(true)
    expect(result.current.logs).toHaveLength(50)

    // 第二批 10 条，每条有唯一 id
    const secondBatch = Array.from({ length: 10 }, (_, i) => ({
      id: `log-${50 + i}`,
      level: 4,
      message: `Log ${50 + i}`,
      created: '2024-01-01T00:00:00Z',
      data: {},
    }))

    mockLogsGetList.mockResolvedValueOnce({
      items: secondBatch,
      page: 2,
      perPage: 50,
      totalItems: 100,
      totalPages: 2,
    })

    await act(async () => {
      await result.current.loadMore()
    })

    expect(result.current.logs).toHaveLength(60)
  })

  it('should refresh logs', async () => {
    const { result } = renderHook(() => useLogs(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.loadLogs()
    })

    await act(async () => {
      await result.current.refresh()
    })

    expect(mockLogsGetList).toHaveBeenCalledTimes(2)
  })

  it('should delete log', async () => {
    mockLogsDelete.mockResolvedValue({})
    const { result } = renderHook(() => useLogs(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.loadLogs()
    })

    await act(async () => {
      await result.current.deleteLog('1')
    })

    expect(mockLogsDelete).toHaveBeenCalledWith('1')
  })
})
