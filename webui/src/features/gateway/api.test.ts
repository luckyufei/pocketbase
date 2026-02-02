/**
 * Gateway API 服务测试
 * TDD: 红灯阶段
 */
import { describe, expect, it, mock, beforeEach } from 'bun:test'
import {
  getProxies,
  getProxy,
  createProxy,
  updateProxy,
  deleteProxy,
  getMetrics,
} from './api'
import type { Proxy, ProxyInput } from './types'

// Mock ApiClient
const mockSend = mock(() => Promise.resolve({}))
const mockCollection = mock(() => ({
  getFullList: mock(() => Promise.resolve([])),
  getOne: mock(() => Promise.resolve({})),
  create: mock(() => Promise.resolve({})),
  update: mock(() => Promise.resolve({})),
  delete: mock(() => Promise.resolve()),
}))

mock.module('@/lib/ApiClient', () => ({
  getApiClient: () => ({
    send: mockSend,
    collection: mockCollection,
  }),
}))

describe('Gateway API', () => {
  beforeEach(() => {
    mockSend.mockClear()
    mockCollection.mockClear()
  })

  describe('getProxies', () => {
    it('应该调用正确的 API 获取代理列表', async () => {
      const mockProxies: Proxy[] = [
        {
          id: 'proxy1',
          name: 'OpenAI Proxy',
          pathPrefix: '/api/proxy/openai',
          targetUrl: 'https://api.openai.com',
          enabled: true,
          maxConcurrent: 50,
          created: '2026-01-01T00:00:00Z',
          updated: '2026-01-01T00:00:00Z',
        },
      ]
      mockSend.mockResolvedValueOnce({ items: mockProxies })

      const result = await getProxies()

      expect(mockSend).toHaveBeenCalledWith('/api/collections/_proxies/records', {
        method: 'GET',
      })
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('OpenAI Proxy')
    })

    it('返回数组格式时应该正确处理', async () => {
      const mockProxies: Proxy[] = [
        {
          id: 'proxy1',
          name: 'Proxy 1',
          pathPrefix: '/api/proxy/1',
          targetUrl: 'http://localhost:8001',
          enabled: true,
          maxConcurrent: 10,
          created: '2026-01-01T00:00:00Z',
          updated: '2026-01-01T00:00:00Z',
        },
      ]
      mockSend.mockResolvedValueOnce(mockProxies)

      const result = await getProxies()

      expect(result).toHaveLength(1)
    })
  })

  describe('getProxy', () => {
    it('应该调用正确的 API 获取单个代理', async () => {
      const mockProxy: Proxy = {
        id: 'proxy1',
        name: 'OpenAI Proxy',
        pathPrefix: '/api/proxy/openai',
        targetUrl: 'https://api.openai.com',
        enabled: true,
        maxConcurrent: 50,
        created: '2026-01-01T00:00:00Z',
        updated: '2026-01-01T00:00:00Z',
      }
      mockSend.mockResolvedValueOnce(mockProxy)

      const result = await getProxy('proxy1')

      expect(mockSend).toHaveBeenCalledWith('/api/collections/_proxies/records/proxy1', {
        method: 'GET',
      })
      expect(result.name).toBe('OpenAI Proxy')
    })
  })

  describe('createProxy', () => {
    it('应该调用正确的 API 创建代理', async () => {
      const input: ProxyInput = {
        name: 'New Proxy',
        pathPrefix: '/api/proxy/new',
        targetUrl: 'http://localhost:9000',
        enabled: true,
        maxConcurrent: 20,
      }
      const mockResult: Proxy = {
        id: 'newproxy',
        ...input,
        created: '2026-01-01T00:00:00Z',
        updated: '2026-01-01T00:00:00Z',
      }
      mockSend.mockResolvedValueOnce(mockResult)

      const result = await createProxy(input)

      expect(mockSend).toHaveBeenCalledWith('/api/collections/_proxies/records', {
        method: 'POST',
        body: input,
      })
      expect(result.id).toBe('newproxy')
    })
  })

  describe('updateProxy', () => {
    it('应该调用正确的 API 更新代理', async () => {
      const input: ProxyInput = {
        name: 'Updated Proxy',
        pathPrefix: '/api/proxy/updated',
        targetUrl: 'http://localhost:9001',
        enabled: false,
        maxConcurrent: 30,
      }
      const mockResult: Proxy = {
        id: 'proxy1',
        ...input,
        created: '2026-01-01T00:00:00Z',
        updated: '2026-01-02T00:00:00Z',
      }
      mockSend.mockResolvedValueOnce(mockResult)

      const result = await updateProxy('proxy1', input)

      expect(mockSend).toHaveBeenCalledWith('/api/collections/_proxies/records/proxy1', {
        method: 'PATCH',
        body: input,
      })
      expect(result.name).toBe('Updated Proxy')
    })
  })

  describe('deleteProxy', () => {
    it('应该调用正确的 API 删除代理', async () => {
      mockSend.mockResolvedValueOnce(undefined)

      await deleteProxy('proxy1')

      expect(mockSend).toHaveBeenCalledWith('/api/collections/_proxies/records/proxy1', {
        method: 'DELETE',
      })
    })
  })

  describe('getMetrics', () => {
    it('应该调用正确的 API 获取指标', async () => {
      const mockMetricsText = `
# HELP gateway_circuit_breaker_state Circuit breaker state
gateway_circuit_breaker_state{proxy="openai"} 0
gateway_active_connections{proxy="openai"} 10
      `
      mockSend.mockResolvedValueOnce(mockMetricsText)

      const result = await getMetrics()

      expect(mockSend).toHaveBeenCalledWith('/api/gateway/metrics', {
        method: 'GET',
      })
      expect(result).toBe(mockMetricsText)
    })
  })
})
