/**
 * useProxies Hook 测试
 * TDD: 红灯阶段
 */
import { describe, expect, it, mock, beforeEach, spyOn } from 'bun:test'
import { renderHook, act, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { Provider, createStore } from 'jotai'
import { useProxies } from './useProxies'
import { proxiesAtom, metricsAtom, isLoadingAtom, filterAtom } from '../store'
import type { Proxy, ProxyMetrics, ProxyFilter } from '../store'

// Mock ApiClient
const mockSend = mock(() => Promise.resolve([]))

mock.module('@/lib/ApiClient', () => ({
  getApiClient: () => ({
    send: mockSend,
    collection: () => ({
      getFullList: mock(() => Promise.resolve([])),
      getOne: mock(() => Promise.resolve({})),
      create: mock(() => Promise.resolve({})),
      update: mock(() => Promise.resolve({})),
      delete: mock(() => Promise.resolve()),
    }),
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

describe('useProxies', () => {
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
    it('应该返回代理列表', () => {
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
      ]
      store.set(proxiesAtom, mockProxies)

      const { result } = renderHook(() => useProxies(), { wrapper })

      expect(result.current.proxies).toHaveLength(1)
      expect(result.current.proxies[0].name).toBe('OpenAI Proxy')
    })

    it('应该返回筛选后的代理列表', () => {
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
          name: 'Disabled Proxy',
          path: '/-/disabled',
          upstream: 'http://localhost:8001',
          stripPath: true,
          active: false,
          created: '2026-01-02T00:00:00Z',
          updated: '2026-01-02T00:00:00Z',
        },
      ]
      store.set(proxiesAtom, mockProxies)
      store.set(filterAtom, { status: 'disabled', search: '' })

      const { result } = renderHook(() => useProxies(), { wrapper })

      expect(result.current.filteredProxies).toHaveLength(1)
      expect(result.current.filteredProxies[0].name).toBe('Disabled Proxy')
    })

    it('应该返回统计数据', () => {
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
          active: false,
          created: '2026-01-02T00:00:00Z',
          updated: '2026-01-02T00:00:00Z',
        },
      ]
      store.set(proxiesAtom, mockProxies)

      const { result } = renderHook(() => useProxies(), { wrapper })

      expect(result.current.stats.total).toBe(2)
      expect(result.current.stats.normal).toBe(1)
      expect(result.current.stats.disabled).toBe(1)
    })

    it('应该返回加载状态', () => {
      store.set(isLoadingAtom, true)

      const { result } = renderHook(() => useProxies(), { wrapper })

      expect(result.current.isLoading).toBe(true)
    })

    it('应该返回筛选条件', () => {
      const filter: ProxyFilter = { status: 'normal', search: 'openai' }
      store.set(filterAtom, filter)

      const { result } = renderHook(() => useProxies(), { wrapper })

      expect(result.current.filter.status).toBe('normal')
      expect(result.current.filter.search).toBe('openai')
    })

    it('应该返回指标数据', () => {
      const mockMetrics: ProxyMetrics[] = [
        {
          proxyName: 'OpenAI Proxy',
          circuitState: 'closed',
          activeConnections: 10,
          requestsTotal: 1000,
          errorsTotal: 5,
        },
      ]
      store.set(metricsAtom, mockMetrics)

      const { result } = renderHook(() => useProxies(), { wrapper })

      expect(result.current.metrics).toHaveLength(1)
      expect(result.current.metrics[0].circuitState).toBe('closed')
    })
  })

  // ============ 操作测试 ============

  describe('loadProxies', () => {
    it('应该从 API 加载代理列表', async () => {
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
      ]
      mockSend.mockResolvedValueOnce(mockProxies)

      const { result } = renderHook(() => useProxies(), { wrapper })

      await act(async () => {
        await result.current.loadProxies()
      })

      expect(mockSend).toHaveBeenCalledWith('/api/collections/_proxies/records', {
        method: 'GET',
      })
      expect(result.current.proxies).toHaveLength(1)
    })

    it('加载失败时应该显示错误提示', async () => {
      mockSend.mockRejectedValueOnce(new Error('Network error'))

      const { result } = renderHook(() => useProxies(), { wrapper })

      await act(async () => {
        await result.current.loadProxies()
      })

      expect(mockToastError).toHaveBeenCalled()
    })
  })

  describe('loadMetrics', () => {
    it('应该从 API 加载指标数据', async () => {
      const mockMetricsResponse = `
# HELP gateway_circuit_breaker_state Circuit breaker state
# TYPE gateway_circuit_breaker_state gauge
gateway_circuit_breaker_state{proxy="openai"} 0
gateway_active_connections{proxy="openai"} 10
gateway_requests_total{proxy="openai",status="2xx"} 1000
gateway_errors_total{proxy="openai"} 5
      `
      mockSend.mockResolvedValueOnce(mockMetricsResponse)

      const { result } = renderHook(() => useProxies(), { wrapper })

      await act(async () => {
        await result.current.loadMetrics()
      })

      expect(mockSend).toHaveBeenCalledWith('/api/gateway/metrics', {
        method: 'GET',
      })
    })
  })

  describe('setFilter', () => {
    it('应该更新筛选条件', () => {
      const { result } = renderHook(() => useProxies(), { wrapper })

      act(() => {
        result.current.setFilter({ status: 'circuit-open', search: 'test' })
      })

      expect(result.current.filter.status).toBe('circuit-open')
      expect(result.current.filter.search).toBe('test')
    })
  })

  describe('getProxyStatus', () => {
    it('应该返回正确的代理状态', () => {
      const proxy: Proxy = {
        id: 'proxy1',
        name: 'OpenAI Proxy',
        path: '/-/openai',
        upstream: 'https://api.openai.com',
        stripPath: true,
        active: true,
        created: '2026-01-01T00:00:00Z',
        updated: '2026-01-01T00:00:00Z',
      }
      const metrics: ProxyMetrics[] = [
        {
          proxyName: 'OpenAI Proxy',
          circuitState: 'open',
          activeConnections: 0,
          requestsTotal: 100,
          errorsTotal: 10,
        },
      ]
      store.set(metricsAtom, metrics)

      const { result } = renderHook(() => useProxies(), { wrapper })

      expect(result.current.getProxyStatus(proxy)).toBe('circuit-open')
    })

    it('禁用的代理应该返回 disabled', () => {
      const proxy: Proxy = {
        id: 'proxy1',
        name: 'Disabled Proxy',
        path: '/-/disabled',
        upstream: 'http://localhost:8001',
        stripPath: true,
        active: false,
        created: '2026-01-01T00:00:00Z',
        updated: '2026-01-01T00:00:00Z',
      }

      const { result } = renderHook(() => useProxies(), { wrapper })

      expect(result.current.getProxyStatus(proxy)).toBe('disabled')
    })
  })
})
