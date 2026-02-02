/**
 * ApiClient 单元测试
 * TDD: 红灯阶段 - 先定义期望行为
 */
import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test'
import { ApiClient, getApiClient, resetApiClient } from './ApiClient'
import PocketBase from 'pocketbase'

describe('ApiClient', () => {
  beforeEach(() => {
    // 每个测试前重置单例
    resetApiClient()
  })

  afterEach(() => {
    resetApiClient()
  })

  describe('getApiClient', () => {
    it('应该返回 PocketBase 实例', () => {
      const client = getApiClient()
      expect(client).toBeInstanceOf(PocketBase)
    })

    it('应该返回单例实例', () => {
      const client1 = getApiClient()
      const client2 = getApiClient()
      expect(client1).toBe(client2)
    })

    it('应该使用默认 baseUrl', () => {
      const client = getApiClient()
      // 默认应该是当前 origin 或 localhost:8090
      expect(client.baseURL).toBeDefined()
    })

    it('应该支持自定义 baseUrl', () => {
      const customUrl = 'http://custom.example.com'
      const client = getApiClient(customUrl)
      expect(client.baseURL).toBe(customUrl)
    })
  })

  describe('ApiClient 类', () => {
    it('应该能创建实例', () => {
      const client = new ApiClient()
      expect(client).toBeDefined()
      expect(client.pb).toBeInstanceOf(PocketBase)
    })

    it('应该暴露 PocketBase 实例', () => {
      const client = new ApiClient()
      expect(client.pb).toBeDefined()
    })

    it('应该能获取认证状态', () => {
      const client = new ApiClient()
      expect(client.isAuthenticated).toBe(false)
    })

    it('应该能获取当前用户', () => {
      const client = new ApiClient()
      expect(client.authStore).toBeDefined()
    })
  })

  describe('认证相关', () => {
    it('authStore 应该有 token 属性', () => {
      const client = getApiClient()
      expect(client.authStore.token).toBeDefined()
    })

    it('authStore 应该有 record 属性', () => {
      const client = getApiClient()
      expect(client.authStore.record).toBeDefined()
    })

    it('authStore 应该有 isValid 属性', () => {
      const client = getApiClient()
      expect(typeof client.authStore.isValid).toBe('boolean')
    })

    it('应该能清除认证状态', () => {
      const client = getApiClient()
      client.authStore.clear()
      expect(client.authStore.token).toBe('')
    })
  })
})
