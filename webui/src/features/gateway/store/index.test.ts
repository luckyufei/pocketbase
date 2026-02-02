/**
 * Gateway Store 测试
 * TDD: 红灯阶段
 */
import { describe, expect, it, beforeEach } from 'bun:test'
import { createStore } from 'jotai'
import {
  proxiesAtom,
  metricsAtom,
  isLoadingAtom,
  filterAtom,
  statsAtom,
  filteredProxiesAtom,
  setProxiesAtom,
  setMetricsAtom,
  setFilterAtom,
  setIsLoadingAtom,
} from './index'
import type { Proxy, ProxyMetrics, ProxyFilter } from '../types'

describe('Gateway Store', () => {
  let store: ReturnType<typeof createStore>

  beforeEach(() => {
    store = createStore()
  })

  // ============ 基础 Atoms 测试 ============

  describe('proxiesAtom', () => {
    it('应该默认为空数组', () => {
      expect(store.get(proxiesAtom)).toEqual([])
    })
  })

  describe('metricsAtom', () => {
    it('应该默认为空数组', () => {
      expect(store.get(metricsAtom)).toEqual([])
    })
  })

  describe('isLoadingAtom', () => {
    it('应该默认为 false', () => {
      expect(store.get(isLoadingAtom)).toBe(false)
    })

    it('应该可以设置为 true', () => {
      store.set(setIsLoadingAtom, true)
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

  // ============ 写入 Atoms 测试 ============

  describe('setProxiesAtom', () => {
    it('应该设置代理列表', () => {
      const proxies: Proxy[] = [
        {
          id: 'proxy1',
          name: 'OpenAI Proxy',
          path: '/-/openai',
          upstream: 'https://api.openai.com',
          stripPath: true,
          active: true,
          created: '2026-01-01T00:00:00Z',
          updated: '2026-01-01T00:00:00Z',
        },
      ]
      store.set(setProxiesAtom, proxies)
      expect(store.get(proxiesAtom)).toHaveLength(1)
      expect(store.get(proxiesAtom)[0].name).toBe('OpenAI Proxy')
    })

    it('应该替换现有列表', () => {
      const proxies1: Proxy[] = [
        {
          id: 'proxy1',
          name: 'Proxy 1',
          path: '/-/proxy1',
          upstream: 'http://localhost:8001',
          stripPath: true,
          active: true,
          created: '2026-01-01T00:00:00Z',
          updated: '2026-01-01T00:00:00Z',
        },
      ]
      const proxies2: Proxy[] = [
        {
          id: 'proxy2',
          name: 'Proxy 2',
          path: '/-/proxy2',
          upstream: 'http://localhost:8002',
          stripPath: true,
          active: false,
          created: '2026-01-02T00:00:00Z',
          updated: '2026-01-02T00:00:00Z',
        },
      ]
      store.set(setProxiesAtom, proxies1)
      store.set(setProxiesAtom, proxies2)
      expect(store.get(proxiesAtom)).toHaveLength(1)
      expect(store.get(proxiesAtom)[0].id).toBe('proxy2')
    })
  })

  describe('setMetricsAtom', () => {
    it('应该设置指标数据', () => {
      const metrics: ProxyMetrics[] = [
        {
          proxyName: 'openai',
          circuitState: 'closed',
          activeConnections: 10,
          requestsTotal: 1000,
          errorsTotal: 5,
        },
      ]
      store.set(setMetricsAtom, metrics)
      expect(store.get(metricsAtom)).toHaveLength(1)
      expect(store.get(metricsAtom)[0].circuitState).toBe('closed')
    })
  })

  describe('setFilterAtom', () => {
    it('应该更新筛选条件', () => {
      const newFilter: ProxyFilter = {
        status: 'normal',
        search: 'openai',
      }
      store.set(setFilterAtom, newFilter)
      expect(store.get(filterAtom)).toEqual(newFilter)
    })
  })

  // ============ 派生 Atoms 测试 ============

  describe('statsAtom', () => {
    const mockProxies: Proxy[] = [
      {
        id: 'proxy1',
        name: 'Proxy 1',
        path: '/-/proxy1',
        upstream: 'http://localhost:8001',
        stripPath: true,
        active: true,
        created: '2026-01-01T00:00:00Z',
        updated: '2026-01-01T00:00:00Z',
      },
      {
        id: 'proxy2',
        name: 'Proxy 2',
        path: '/-/proxy2',
        upstream: 'http://localhost:8002',
        stripPath: true,
        active: true,
        created: '2026-01-02T00:00:00Z',
        updated: '2026-01-02T00:00:00Z',
      },
      {
        id: 'proxy3',
        name: 'Proxy 3',
        path: '/-/proxy3',
        upstream: 'http://localhost:8003',
        stripPath: true,
        active: false,
        created: '2026-01-03T00:00:00Z',
        updated: '2026-01-03T00:00:00Z',
      },
    ]

    const mockMetrics: ProxyMetrics[] = [
      {
        proxyName: 'Proxy 1',
        circuitState: 'closed',
        activeConnections: 5,
        requestsTotal: 100,
        errorsTotal: 1,
      },
      {
        proxyName: 'Proxy 2',
        circuitState: 'open',
        activeConnections: 0,
        requestsTotal: 50,
        errorsTotal: 10,
      },
    ]

    it('应该计算正确的统计数据', () => {
      store.set(setProxiesAtom, mockProxies)
      store.set(setMetricsAtom, mockMetrics)

      const stats = store.get(statsAtom)
      expect(stats.total).toBe(3)
      expect(stats.normal).toBe(1) // proxy1: active + closed
      expect(stats.circuitOpen).toBe(1) // proxy2: active + open
      expect(stats.disabled).toBe(1) // proxy3: disabled
    })

    it('空列表时应该全为 0', () => {
      const stats = store.get(statsAtom)
      expect(stats.total).toBe(0)
      expect(stats.normal).toBe(0)
      expect(stats.circuitOpen).toBe(0)
      expect(stats.disabled).toBe(0)
    })
  })

  describe('filteredProxiesAtom', () => {
    const mockProxies: Proxy[] = [
      {
        id: 'proxy1',
        name: 'OpenAI Proxy',
        path: '/-/openai',
        upstream: 'https://api.openai.com',
        stripPath: true,
        active: true,
        created: '2026-01-01T00:00:00Z',
        updated: '2026-01-01T00:00:00Z',
      },
      {
        id: 'proxy2',
        name: 'Sidecar Proxy',
        path: '/-/sidecar',
        upstream: 'http://localhost:8001',
        stripPath: true,
        active: true,
        created: '2026-01-02T00:00:00Z',
        updated: '2026-01-02T00:00:00Z',
      },
      {
        id: 'proxy3',
        name: 'Disabled Proxy',
        path: '/-/disabled',
        upstream: 'http://localhost:8002',
        stripPath: true,
        active: false,
        created: '2026-01-03T00:00:00Z',
        updated: '2026-01-03T00:00:00Z',
      },
    ]

    const mockMetrics: ProxyMetrics[] = [
      {
        proxyName: 'OpenAI Proxy',
        circuitState: 'closed',
        activeConnections: 10,
        requestsTotal: 1000,
        errorsTotal: 5,
      },
      {
        proxyName: 'Sidecar Proxy',
        circuitState: 'open',
        activeConnections: 0,
        requestsTotal: 100,
        errorsTotal: 20,
      },
    ]

    beforeEach(() => {
      store.set(setProxiesAtom, mockProxies)
      store.set(setMetricsAtom, mockMetrics)
    })

    it('状态为 all 时应该返回所有代理', () => {
      store.set(setFilterAtom, { status: 'all', search: '' })
      const filtered = store.get(filteredProxiesAtom)
      expect(filtered).toHaveLength(3)
    })

    it('应该按状态筛选 - normal', () => {
      store.set(setFilterAtom, { status: 'normal', search: '' })
      const filtered = store.get(filteredProxiesAtom)
      expect(filtered).toHaveLength(1)
      expect(filtered[0].name).toBe('OpenAI Proxy')
    })

    it('应该按状态筛选 - circuit-open', () => {
      store.set(setFilterAtom, { status: 'circuit-open', search: '' })
      const filtered = store.get(filteredProxiesAtom)
      expect(filtered).toHaveLength(1)
      expect(filtered[0].name).toBe('Sidecar Proxy')
    })

    it('应该按状态筛选 - disabled', () => {
      store.set(setFilterAtom, { status: 'disabled', search: '' })
      const filtered = store.get(filteredProxiesAtom)
      expect(filtered).toHaveLength(1)
      expect(filtered[0].name).toBe('Disabled Proxy')
    })

    it('应该按搜索词筛选 (名称包含)', () => {
      store.set(setFilterAtom, { status: 'all', search: 'openai' })
      const filtered = store.get(filteredProxiesAtom)
      expect(filtered).toHaveLength(1)
      expect(filtered[0].name).toBe('OpenAI Proxy')
    })

    it('应该按搜索词筛选 (路径包含)', () => {
      store.set(setFilterAtom, { status: 'all', search: 'sidecar' })
      const filtered = store.get(filteredProxiesAtom)
      expect(filtered).toHaveLength(1)
      expect(filtered[0].name).toBe('Sidecar Proxy')
    })

    it('搜索应该不区分大小写', () => {
      store.set(setFilterAtom, { status: 'all', search: 'OPENAI' })
      const filtered = store.get(filteredProxiesAtom)
      expect(filtered).toHaveLength(1)
    })

    it('应该同时应用状态和搜索筛选', () => {
      store.set(setFilterAtom, { status: 'normal', search: 'proxy' })
      const filtered = store.get(filteredProxiesAtom)
      expect(filtered).toHaveLength(1)
      expect(filtered[0].name).toBe('OpenAI Proxy')
    })

    it('无匹配时应该返回空数组', () => {
      store.set(setFilterAtom, { status: 'all', search: 'notexist' })
      const filtered = store.get(filteredProxiesAtom)
      expect(filtered).toHaveLength(0)
    })
  })
})
