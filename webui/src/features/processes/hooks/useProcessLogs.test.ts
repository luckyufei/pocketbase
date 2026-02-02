/**
 * useProcessLogs Hook 测试
 * TDD: 红灯阶段
 */
import { describe, expect, it, mock, beforeEach, afterEach } from 'bun:test'
import { renderHook, act, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { Provider, createStore } from 'jotai'
import { useProcessLogs } from './useProcessLogs'
import {
  processLogsAtom,
  logsLoadingAtom,
  logsAutoScrollAtom,
  selectedLogProcessAtom,
  logsPollingAtom,
} from '../store'

// Mock ApiClient
const mockSend = mock(() => Promise.resolve([]))

mock.module('@/lib/ApiClient', () => ({
  getApiClient: () => ({
    send: mockSend,
  }),
}))

// Mock sonner toast
const mockToastError = mock(() => {})
mock.module('sonner', () => ({
  toast: {
    error: mockToastError,
  },
}))

describe('useProcessLogs', () => {
  let store: ReturnType<typeof createStore>

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    createElement(Provider, { store }, children)

  beforeEach(() => {
    store = createStore()
    mockSend.mockClear()
    mockToastError.mockClear()
  })

  // ============ 状态访问测试 ============

  describe('状态访问', () => {
    it('应该返回日志列表', () => {
      const mockLogs = [
        { timestamp: '2026-01-30T10:00:00Z', processId: 'p1', stream: 'stdout', content: 'Hello' },
      ]
      store.set(processLogsAtom, mockLogs)

      const { result } = renderHook(() => useProcessLogs(), { wrapper })

      expect(result.current.logs).toHaveLength(1)
      expect(result.current.logs[0].content).toBe('Hello')
    })

    it('应该返回加载状态', () => {
      store.set(logsLoadingAtom, true)

      const { result } = renderHook(() => useProcessLogs(), { wrapper })

      expect(result.current.isLoading).toBe(true)
    })

    it('应该返回自动滚动状态', () => {
      store.set(logsAutoScrollAtom, false)

      const { result } = renderHook(() => useProcessLogs(), { wrapper })

      expect(result.current.autoScroll).toBe(false)
    })

    it('应该返回选中的进程 ID', () => {
      store.set(selectedLogProcessAtom, 'p1')

      const { result } = renderHook(() => useProcessLogs(), { wrapper })

      expect(result.current.selectedProcessId).toBe('p1')
    })

    it('应该返回轮询状态', () => {
      store.set(logsPollingAtom, true)

      const { result } = renderHook(() => useProcessLogs(), { wrapper })

      expect(result.current.isPolling).toBe(true)
    })
  })

  // ============ API 操作测试 ============

  describe('loadLogs', () => {
    it('应该调用 API 获取日志', async () => {
      const mockData = [
        { timestamp: '2026-01-30T10:00:00Z', processId: 'p1', stream: 'stdout', content: 'Log 1' },
      ]
      mockSend.mockResolvedValueOnce(mockData)

      const { result } = renderHook(() => useProcessLogs(), { wrapper })

      await act(async () => {
        await result.current.loadLogs('p1')
      })

      expect(mockSend).toHaveBeenCalledWith('/api/pm/p1/logs?lines=100', { method: 'GET' })
    })

    it('应该支持自定义行数参数', async () => {
      mockSend.mockResolvedValueOnce([])

      const { result } = renderHook(() => useProcessLogs(), { wrapper })

      await act(async () => {
        await result.current.loadLogs('p1', 200)
      })

      expect(mockSend).toHaveBeenCalledWith('/api/pm/p1/logs?lines=200', { method: 'GET' })
    })

    it('加载成功后应该更新日志列表', async () => {
      const mockData = [
        { timestamp: '2026-01-30T10:00:00Z', processId: 'p1', stream: 'stdout', content: 'Log 1' },
        { timestamp: '2026-01-30T10:00:01Z', processId: 'p1', stream: 'stderr', content: 'Error 1' },
      ]
      mockSend.mockResolvedValueOnce(mockData)

      const { result } = renderHook(() => useProcessLogs(), { wrapper })

      await act(async () => {
        await result.current.loadLogs('p1')
      })

      expect(result.current.logs).toHaveLength(2)
      expect(result.current.logs[0].stream).toBe('stdout')
      expect(result.current.logs[1].stream).toBe('stderr')
    })

    it('加载成功后应该更新选中的进程 ID', async () => {
      mockSend.mockResolvedValueOnce([])

      const { result } = renderHook(() => useProcessLogs(), { wrapper })

      await act(async () => {
        await result.current.loadLogs('p1')
      })

      expect(result.current.selectedProcessId).toBe('p1')
    })

    it('加载过程中应该设置 isLoading 为 true', async () => {
      let resolvePromise: (value: unknown) => void
      mockSend.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolvePromise = resolve
          })
      )

      const { result } = renderHook(() => useProcessLogs(), { wrapper })

      act(() => {
        result.current.loadLogs('p1')
      })

      expect(result.current.isLoading).toBe(true)

      await act(async () => {
        resolvePromise!([])
      })

      expect(result.current.isLoading).toBe(false)
    })

    it('加载失败应该显示错误 toast', async () => {
      mockSend.mockRejectedValueOnce(new Error('Network error'))

      const { result } = renderHook(() => useProcessLogs(), { wrapper })

      await act(async () => {
        await result.current.loadLogs('p1')
      })

      expect(mockToastError).toHaveBeenCalled()
    })

    it('API 返回 null 时应该设置空数组', async () => {
      mockSend.mockResolvedValueOnce(null)

      const { result } = renderHook(() => useProcessLogs(), { wrapper })

      await act(async () => {
        await result.current.loadLogs('p1')
      })

      expect(result.current.logs).toEqual([])
    })
  })

  // ============ 自动滚动控制测试 ============

  describe('toggleAutoScroll', () => {
    it('应该切换自动滚动状态（开 -> 关）', () => {
      store.set(logsAutoScrollAtom, true)

      const { result } = renderHook(() => useProcessLogs(), { wrapper })

      act(() => {
        result.current.toggleAutoScroll()
      })

      expect(result.current.autoScroll).toBe(false)
    })

    it('应该切换自动滚动状态（关 -> 开）', () => {
      store.set(logsAutoScrollAtom, false)

      const { result } = renderHook(() => useProcessLogs(), { wrapper })

      act(() => {
        result.current.toggleAutoScroll()
      })

      expect(result.current.autoScroll).toBe(true)
    })
  })

  describe('setAutoScroll', () => {
    it('应该设置自动滚动状态', () => {
      const { result } = renderHook(() => useProcessLogs(), { wrapper })

      act(() => {
        result.current.setAutoScroll(false)
      })

      expect(result.current.autoScroll).toBe(false)

      act(() => {
        result.current.setAutoScroll(true)
      })

      expect(result.current.autoScroll).toBe(true)
    })
  })

  // ============ 轮询控制测试 ============

  describe('startPolling', () => {
    it('应该启动轮询', async () => {
      mockSend.mockResolvedValue([])

      const { result } = renderHook(() => useProcessLogs(), { wrapper })

      await act(async () => {
        result.current.startPolling('p1')
      })

      expect(result.current.isPolling).toBe(true)
    })

    it('启动轮询应该设置选中的进程 ID', async () => {
      mockSend.mockResolvedValue([])

      const { result } = renderHook(() => useProcessLogs(), { wrapper })

      await act(async () => {
        result.current.startPolling('p1')
      })

      expect(result.current.selectedProcessId).toBe('p1')
    })
  })

  describe('stopPolling', () => {
    it('应该停止轮询', async () => {
      mockSend.mockResolvedValue([])
      store.set(logsPollingAtom, true)

      const { result } = renderHook(() => useProcessLogs(), { wrapper })

      act(() => {
        result.current.stopPolling()
      })

      expect(result.current.isPolling).toBe(false)
    })
  })

  // ============ 清理测试 ============

  describe('clearLogs', () => {
    it('应该清空日志列表', () => {
      store.set(processLogsAtom, [
        { timestamp: '2026-01-30T10:00:00Z', processId: 'p1', stream: 'stdout', content: 'Log 1' },
      ])

      const { result } = renderHook(() => useProcessLogs(), { wrapper })

      act(() => {
        result.current.clearLogs()
      })

      expect(result.current.logs).toEqual([])
    })

    it('应该清空选中的进程 ID', () => {
      store.set(selectedLogProcessAtom, 'p1')

      const { result } = renderHook(() => useProcessLogs(), { wrapper })

      act(() => {
        result.current.clearLogs()
      })

      expect(result.current.selectedProcessId).toBeNull()
    })

    it('应该停止轮询', () => {
      store.set(logsPollingAtom, true)

      const { result } = renderHook(() => useProcessLogs(), { wrapper })

      act(() => {
        result.current.clearLogs()
      })

      expect(result.current.isPolling).toBe(false)
    })
  })

  // ============ 打开/关闭日志面板测试 ============

  describe('openLogs', () => {
    it('应该打开日志面板并加载日志', async () => {
      mockSend.mockResolvedValueOnce([])

      const { result } = renderHook(() => useProcessLogs(), { wrapper })

      await act(async () => {
        await result.current.openLogs('p1')
      })

      expect(mockSend).toHaveBeenCalledWith('/api/pm/p1/logs?lines=100', { method: 'GET' })
      expect(result.current.selectedProcessId).toBe('p1')
    })
  })

  describe('closeLogs', () => {
    it('应该关闭日志面板并清理状态', async () => {
      store.set(selectedLogProcessAtom, 'p1')
      store.set(logsPollingAtom, true)
      store.set(processLogsAtom, [
        { timestamp: '2026-01-30T10:00:00Z', processId: 'p1', stream: 'stdout', content: 'Log' },
      ])

      const { result } = renderHook(() => useProcessLogs(), { wrapper })

      act(() => {
        result.current.closeLogs()
      })

      expect(result.current.selectedProcessId).toBeNull()
      expect(result.current.isPolling).toBe(false)
      expect(result.current.logs).toEqual([])
    })
  })
})
