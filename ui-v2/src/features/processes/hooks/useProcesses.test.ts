/**
 * useProcesses Hook 测试
 * TDD: 红灯阶段
 */
import { describe, expect, it, mock, beforeEach, afterEach } from 'bun:test'
import { renderHook, act, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { Provider, createStore } from 'jotai'
import { useProcesses } from './useProcesses'
import {
  processesAtom,
  isLoadingAtom,
  filterAtom,
  actionLoadingAtom,
  lastRefreshAtom,
} from '../store'
import type { ProcessState, ProcessFilter } from '../store'

// Mock ApiClient
const mockSend = mock(() => Promise.resolve([]))

mock.module('@/lib/ApiClient', () => ({
  getApiClient: () => ({
    send: mockSend,
  }),
}))

// Mock sonner toast
const mockToastSuccess = mock(() => {})
const mockToastError = mock(() => {})
mock.module('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}))

describe('useProcesses', () => {
  let store: ReturnType<typeof createStore>

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    createElement(Provider, { store }, children)

  beforeEach(() => {
    store = createStore()
    mockSend.mockClear()
    mockToastSuccess.mockClear()
    mockToastError.mockClear()
  })

  // ============ 状态访问测试 ============

  describe('状态访问', () => {
    it('应该返回进程列表', () => {
      const mockProcesses: ProcessState[] = [
        { id: 'p1', pid: 123, status: 'running', startTime: '', uptime: '1h', restartCount: 0 },
      ]
      store.set(processesAtom, mockProcesses)

      const { result } = renderHook(() => useProcesses(), { wrapper })

      expect(result.current.processes).toHaveLength(1)
      expect(result.current.processes[0].id).toBe('p1')
    })

    it('应该返回筛选后的进程列表', () => {
      const mockProcesses: ProcessState[] = [
        { id: 'p1', pid: 123, status: 'running', startTime: '', uptime: '1h', restartCount: 0 },
        { id: 'p2', pid: 0, status: 'stopped', startTime: '', uptime: '', restartCount: 1 },
      ]
      store.set(processesAtom, mockProcesses)
      store.set(filterAtom, { status: 'running', search: '' })

      const { result } = renderHook(() => useProcesses(), { wrapper })

      expect(result.current.filteredProcesses).toHaveLength(1)
      expect(result.current.filteredProcesses[0].status).toBe('running')
    })

    it('应该返回统计数据', () => {
      const mockProcesses: ProcessState[] = [
        { id: 'p1', pid: 123, status: 'running', startTime: '', uptime: '1h', restartCount: 0 },
        { id: 'p2', pid: 0, status: 'stopped', startTime: '', uptime: '', restartCount: 1 },
        { id: 'p3', pid: 0, status: 'crashed', startTime: '', uptime: '', restartCount: 2 },
      ]
      store.set(processesAtom, mockProcesses)

      const { result } = renderHook(() => useProcesses(), { wrapper })

      expect(result.current.stats.total).toBe(3)
      expect(result.current.stats.running).toBe(1)
      expect(result.current.stats.stopped).toBe(1)
      expect(result.current.stats.crashed).toBe(1)
    })

    it('应该返回加载状态', () => {
      store.set(isLoadingAtom, true)

      const { result } = renderHook(() => useProcesses(), { wrapper })

      expect(result.current.isLoading).toBe(true)
    })

    it('应该返回筛选条件', () => {
      const filter: ProcessFilter = { status: 'running', search: 'test' }
      store.set(filterAtom, filter)

      const { result } = renderHook(() => useProcesses(), { wrapper })

      expect(result.current.filter).toEqual(filter)
    })

    it('应该返回操作加载状态', () => {
      store.set(actionLoadingAtom, { p1: 'restart' })

      const { result } = renderHook(() => useProcesses(), { wrapper })

      expect(result.current.actionLoading).toEqual({ p1: 'restart' })
    })

    it('应该返回最后刷新时间', () => {
      const now = new Date()
      store.set(lastRefreshAtom, now)

      const { result } = renderHook(() => useProcesses(), { wrapper })

      expect(result.current.lastRefresh).toEqual(now)
    })
  })

  // ============ API 操作测试 ============

  describe('loadProcesses', () => {
    it('应该调用 API 获取进程列表', async () => {
      const mockData: ProcessState[] = [
        { id: 'p1', pid: 123, status: 'running', startTime: '', uptime: '1h', restartCount: 0 },
      ]
      mockSend.mockResolvedValueOnce(mockData)

      const { result } = renderHook(() => useProcesses(), { wrapper })

      await act(async () => {
        await result.current.loadProcesses()
      })

      expect(mockSend).toHaveBeenCalledWith('/api/pm/list', { method: 'GET' })
    })

    it('加载成功后应该更新进程列表', async () => {
      const mockData: ProcessState[] = [
        { id: 'p1', pid: 123, status: 'running', startTime: '', uptime: '1h', restartCount: 0 },
      ]
      mockSend.mockResolvedValueOnce(mockData)

      const { result } = renderHook(() => useProcesses(), { wrapper })

      await act(async () => {
        await result.current.loadProcesses()
      })

      expect(result.current.processes).toHaveLength(1)
      expect(result.current.processes[0].id).toBe('p1')
    })

    it('加载成功后应该更新最后刷新时间', async () => {
      mockSend.mockResolvedValueOnce([])

      const { result } = renderHook(() => useProcesses(), { wrapper })

      expect(result.current.lastRefresh).toBeNull()

      await act(async () => {
        await result.current.loadProcesses()
      })

      expect(result.current.lastRefresh).not.toBeNull()
    })

    it('加载过程中应该设置 isLoading 为 true', async () => {
      let resolvePromise: (value: ProcessState[]) => void
      mockSend.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolvePromise = resolve
          })
      )

      const { result } = renderHook(() => useProcesses(), { wrapper })

      act(() => {
        result.current.loadProcesses()
      })

      expect(result.current.isLoading).toBe(true)

      await act(async () => {
        resolvePromise!([])
      })

      expect(result.current.isLoading).toBe(false)
    })

    it('加载失败应该显示错误 toast', async () => {
      mockSend.mockRejectedValueOnce(new Error('Network error'))

      const { result } = renderHook(() => useProcesses(), { wrapper })

      await act(async () => {
        await result.current.loadProcesses()
      })

      expect(mockToastError).toHaveBeenCalled()
    })
  })

  describe('restartProcess', () => {
    it('应该调用重启 API', async () => {
      mockSend.mockResolvedValueOnce({ message: 'ok', id: 'p1' })
      mockSend.mockResolvedValueOnce([]) // loadProcesses 调用

      const { result } = renderHook(() => useProcesses(), { wrapper })

      await act(async () => {
        await result.current.restartProcess('p1')
      })

      expect(mockSend).toHaveBeenCalledWith('/api/pm/p1/restart', { method: 'POST' })
    })

    it('重启成功应该显示成功 toast', async () => {
      mockSend.mockResolvedValueOnce({ message: 'ok', id: 'p1' })
      mockSend.mockResolvedValueOnce([])

      const { result } = renderHook(() => useProcesses(), { wrapper })

      await act(async () => {
        await result.current.restartProcess('p1')
      })

      expect(mockToastSuccess).toHaveBeenCalled()
    })

    it('重启过程中应该设置 actionLoading', async () => {
      let resolvePromise: (value: unknown) => void
      mockSend.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolvePromise = resolve
          })
      )

      const { result } = renderHook(() => useProcesses(), { wrapper })

      act(() => {
        result.current.restartProcess('p1')
      })

      expect(result.current.actionLoading['p1']).toBe('restart')

      await act(async () => {
        resolvePromise!({ message: 'ok', id: 'p1' })
      })
    })

    it('重启失败应该显示错误 toast', async () => {
      mockSend.mockRejectedValueOnce(new Error('Failed'))

      const { result } = renderHook(() => useProcesses(), { wrapper })

      await act(async () => {
        await result.current.restartProcess('p1')
      })

      expect(mockToastError).toHaveBeenCalled()
    })
  })

  describe('stopProcess', () => {
    it('应该调用停止 API', async () => {
      mockSend.mockResolvedValueOnce({ message: 'ok', id: 'p1' })
      mockSend.mockResolvedValueOnce([])

      const { result } = renderHook(() => useProcesses(), { wrapper })

      await act(async () => {
        await result.current.stopProcess('p1')
      })

      expect(mockSend).toHaveBeenCalledWith('/api/pm/p1/stop', { method: 'POST' })
    })

    it('停止成功应该显示成功 toast', async () => {
      mockSend.mockResolvedValueOnce({ message: 'ok', id: 'p1' })
      mockSend.mockResolvedValueOnce([])

      const { result } = renderHook(() => useProcesses(), { wrapper })

      await act(async () => {
        await result.current.stopProcess('p1')
      })

      expect(mockToastSuccess).toHaveBeenCalled()
    })
  })

  describe('startProcess', () => {
    it('应该调用启动 API', async () => {
      mockSend.mockResolvedValueOnce({ message: 'ok', id: 'p1' })
      mockSend.mockResolvedValueOnce([])

      const { result } = renderHook(() => useProcesses(), { wrapper })

      await act(async () => {
        await result.current.startProcess('p1')
      })

      expect(mockSend).toHaveBeenCalledWith('/api/pm/p1/start', { method: 'POST' })
    })
  })

  describe('updateFilter', () => {
    it('应该更新筛选条件', async () => {
      const { result } = renderHook(() => useProcesses(), { wrapper })

      act(() => {
        result.current.updateFilter({ status: 'running', search: 'test' })
      })

      expect(result.current.filter).toEqual({ status: 'running', search: 'test' })
    })
  })

  describe('clearFilter', () => {
    it('应该重置筛选条件', async () => {
      store.set(filterAtom, { status: 'running', search: 'test' })

      const { result } = renderHook(() => useProcesses(), { wrapper })

      act(() => {
        result.current.clearFilter()
      })

      expect(result.current.filter).toEqual({ status: 'all', search: '' })
    })
  })

  describe('isActionLoading', () => {
    it('应该返回指定进程的操作加载状态', () => {
      store.set(actionLoadingAtom, { p1: 'restart', p2: 'stop' })

      const { result } = renderHook(() => useProcesses(), { wrapper })

      expect(result.current.isActionLoading('p1')).toBe(true)
      expect(result.current.isActionLoading('p2')).toBe(true)
      expect(result.current.isActionLoading('p3')).toBe(false)
    })

    it('应该支持检查特定操作', () => {
      store.set(actionLoadingAtom, { p1: 'restart' })

      const { result } = renderHook(() => useProcesses(), { wrapper })

      expect(result.current.isActionLoading('p1', 'restart')).toBe(true)
      expect(result.current.isActionLoading('p1', 'stop')).toBe(false)
    })
  })
})
