/**
 * Processes Store 测试
 * TDD: 红灯阶段
 */
import { describe, expect, it, beforeEach } from 'bun:test'
import { createStore } from 'jotai'
import {
  processesAtom,
  isLoadingAtom,
  filterAtom,
  actionLoadingAtom,
  statsAtom,
  lastRefreshAtom,
  setProcessesAtom,
  updateProcessAtom,
  setFilterAtom,
  setActionLoadingAtom,
  clearActionLoadingAtom,
  setLastRefreshAtom,
  filteredProcessesAtom,
  type ProcessState,
  type ProcessFilter,
} from './index'

describe('Processes Store', () => {
  let store: ReturnType<typeof createStore>

  beforeEach(() => {
    store = createStore()
  })

  // ============ 基础 Atoms 测试 ============

  describe('processesAtom', () => {
    it('应该默认为空数组', () => {
      expect(store.get(processesAtom)).toEqual([])
    })
  })

  describe('isLoadingAtom', () => {
    it('应该默认为 false', () => {
      expect(store.get(isLoadingAtom)).toBe(false)
    })

    it('应该可以设置为 true', () => {
      store.set(isLoadingAtom, true)
      expect(store.get(isLoadingAtom)).toBe(true)
    })
  })

  describe('filterAtom', () => {
    it('应该有正确的默认值', () => {
      const filter = store.get(filterAtom)
      expect(filter.status).toBe('all')
      expect(filter.search).toBe('')
    })
  })

  describe('actionLoadingAtom', () => {
    it('应该默认为空对象', () => {
      expect(store.get(actionLoadingAtom)).toEqual({})
    })
  })

  describe('statsAtom', () => {
    it('应该能够计算正确的统计数据', () => {
      const processes: ProcessState[] = [
        { id: 'p1', pid: 123, status: 'running', startTime: '', uptime: '1h', restartCount: 0 },
        { id: 'p2', pid: 0, status: 'stopped', startTime: '', uptime: '', restartCount: 1 },
        { id: 'p3', pid: 0, status: 'crashed', startTime: '', uptime: '', restartCount: 2 },
        { id: 'p4', pid: 456, status: 'running', startTime: '', uptime: '30m', restartCount: 0 },
      ]
      store.set(setProcessesAtom, processes)

      const stats = store.get(statsAtom)
      expect(stats.total).toBe(4)
      expect(stats.running).toBe(2)
      expect(stats.stopped).toBe(1)
      expect(stats.crashed).toBe(1)
    })

    it('空列表时应该全为 0', () => {
      const stats = store.get(statsAtom)
      expect(stats.total).toBe(0)
      expect(stats.running).toBe(0)
      expect(stats.stopped).toBe(0)
      expect(stats.crashed).toBe(0)
    })
  })

  describe('lastRefreshAtom', () => {
    it('应该默认为 null', () => {
      expect(store.get(lastRefreshAtom)).toBeNull()
    })
  })

  // ============ 写入 Atoms 测试 ============

  describe('setProcessesAtom', () => {
    it('应该设置进程列表', () => {
      const processes: ProcessState[] = [
        { id: 'p1', pid: 123, status: 'running', startTime: '', uptime: '1h', restartCount: 0 },
      ]
      store.set(setProcessesAtom, processes)
      expect(store.get(processesAtom)).toHaveLength(1)
      expect(store.get(processesAtom)[0].id).toBe('p1')
    })

    it('应该替换现有列表', () => {
      const processes1: ProcessState[] = [
        { id: 'p1', pid: 123, status: 'running', startTime: '', uptime: '1h', restartCount: 0 },
      ]
      const processes2: ProcessState[] = [
        { id: 'p2', pid: 456, status: 'stopped', startTime: '', uptime: '', restartCount: 1 },
      ]
      store.set(setProcessesAtom, processes1)
      store.set(setProcessesAtom, processes2)
      expect(store.get(processesAtom)).toHaveLength(1)
      expect(store.get(processesAtom)[0].id).toBe('p2')
    })
  })

  describe('updateProcessAtom', () => {
    it('应该更新指定进程', () => {
      const processes: ProcessState[] = [
        { id: 'p1', pid: 123, status: 'running', startTime: '', uptime: '1h', restartCount: 0 },
        { id: 'p2', pid: 456, status: 'running', startTime: '', uptime: '30m', restartCount: 0 },
      ]
      store.set(setProcessesAtom, processes)

      store.set(updateProcessAtom, { id: 'p1', status: 'stopped', pid: 0 })

      const updated = store.get(processesAtom)
      expect(updated.find((p) => p.id === 'p1')?.status).toBe('stopped')
      expect(updated.find((p) => p.id === 'p1')?.pid).toBe(0)
      expect(updated.find((p) => p.id === 'p2')?.status).toBe('running')
    })

    it('更新不存在的进程应该无效果', () => {
      const processes: ProcessState[] = [
        { id: 'p1', pid: 123, status: 'running', startTime: '', uptime: '1h', restartCount: 0 },
      ]
      store.set(setProcessesAtom, processes)

      store.set(updateProcessAtom, { id: 'p999', status: 'stopped' })

      expect(store.get(processesAtom)).toHaveLength(1)
      expect(store.get(processesAtom)[0].status).toBe('running')
    })
  })

  describe('setFilterAtom', () => {
    it('应该更新筛选条件', () => {
      const newFilter: ProcessFilter = {
        status: 'running',
        search: 'python',
      }
      store.set(setFilterAtom, newFilter)
      expect(store.get(filterAtom)).toEqual(newFilter)
    })
  })

  describe('setActionLoadingAtom', () => {
    it('应该设置操作加载状态', () => {
      store.set(setActionLoadingAtom, { id: 'p1', action: 'restart' })
      expect(store.get(actionLoadingAtom)).toEqual({ p1: 'restart' })
    })

    it('应该支持多个进程同时加载', () => {
      store.set(setActionLoadingAtom, { id: 'p1', action: 'restart' })
      store.set(setActionLoadingAtom, { id: 'p2', action: 'stop' })
      expect(store.get(actionLoadingAtom)).toEqual({ p1: 'restart', p2: 'stop' })
    })
  })

  describe('clearActionLoadingAtom', () => {
    it('应该清除指定进程的加载状态', () => {
      store.set(setActionLoadingAtom, { id: 'p1', action: 'restart' })
      store.set(setActionLoadingAtom, { id: 'p2', action: 'stop' })

      store.set(clearActionLoadingAtom, 'p1')

      expect(store.get(actionLoadingAtom)).toEqual({ p2: 'stop' })
    })

    it('清除不存在的进程应该无效果', () => {
      store.set(setActionLoadingAtom, { id: 'p1', action: 'restart' })
      store.set(clearActionLoadingAtom, 'p999')
      expect(store.get(actionLoadingAtom)).toEqual({ p1: 'restart' })
    })
  })

  describe('setLastRefreshAtom', () => {
    it('应该设置最后刷新时间', () => {
      const now = new Date()
      store.set(setLastRefreshAtom, now)
      expect(store.get(lastRefreshAtom)).toEqual(now)
    })
  })

  // ============ 派生 Atoms 测试 ============

  describe('filteredProcessesAtom', () => {
    const mockProcesses: ProcessState[] = [
      { id: 'python-agent', pid: 123, status: 'running', startTime: '', uptime: '1h', restartCount: 0 },
      { id: 'node-server', pid: 456, status: 'running', startTime: '', uptime: '30m', restartCount: 0 },
      { id: 'api-gateway', pid: 0, status: 'stopped', startTime: '', uptime: '', restartCount: 1 },
      { id: 'worker', pid: 0, status: 'crashed', startTime: '', uptime: '', restartCount: 5 },
    ]

    beforeEach(() => {
      store.set(setProcessesAtom, mockProcesses)
    })

    it('状态为 all 时应该返回所有进程', () => {
      store.set(setFilterAtom, { status: 'all', search: '' })
      const filtered = store.get(filteredProcessesAtom)
      expect(filtered).toHaveLength(4)
    })

    it('应该按状态筛选', () => {
      store.set(setFilterAtom, { status: 'running', search: '' })
      const filtered = store.get(filteredProcessesAtom)
      expect(filtered).toHaveLength(2)
      expect(filtered.every((p) => p.status === 'running')).toBe(true)
    })

    it('应该按搜索词筛选 (ID 包含)', () => {
      store.set(setFilterAtom, { status: 'all', search: 'python' })
      const filtered = store.get(filteredProcessesAtom)
      expect(filtered).toHaveLength(1)
      expect(filtered[0].id).toBe('python-agent')
    })

    it('搜索应该不区分大小写', () => {
      store.set(setFilterAtom, { status: 'all', search: 'PYTHON' })
      const filtered = store.get(filteredProcessesAtom)
      expect(filtered).toHaveLength(1)
    })

    it('应该同时应用状态和搜索筛选', () => {
      store.set(setFilterAtom, { status: 'running', search: 'node' })
      const filtered = store.get(filteredProcessesAtom)
      expect(filtered).toHaveLength(1)
      expect(filtered[0].id).toBe('node-server')
    })

    it('无匹配时应该返回空数组', () => {
      store.set(setFilterAtom, { status: 'running', search: 'notexist' })
      const filtered = store.get(filteredProcessesAtom)
      expect(filtered).toHaveLength(0)
    })
  })
})
