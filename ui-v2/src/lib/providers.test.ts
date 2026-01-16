/**
 * OAuth2 Providers 工具函数测试
 */
import { describe, it, expect } from 'bun:test'
import {
  OAUTH2_PROVIDERS,
  getProviderByName,
  getProviderDisplayName,
  getProviderIcon,
  getProviderAuthUrl,
  isProviderConfigured,
} from './providers'

describe('providers', () => {
  describe('OAUTH2_PROVIDERS', () => {
    it('应该包含常见的 OAuth2 提供商', () => {
      const providerNames = OAUTH2_PROVIDERS.map((p) => p.name)
      expect(providerNames).toContain('google')
      expect(providerNames).toContain('github')
      expect(providerNames).toContain('facebook')
      expect(providerNames).toContain('apple')
      expect(providerNames).toContain('microsoft')
    })

    it('每个提供商应该有必要的属性', () => {
      OAUTH2_PROVIDERS.forEach((provider) => {
        expect(provider.name).toBeDefined()
        expect(provider.displayName).toBeDefined()
        expect(typeof provider.name).toBe('string')
        expect(typeof provider.displayName).toBe('string')
      })
    })
  })

  describe('getProviderByName', () => {
    it('应该返回正确的提供商', () => {
      const google = getProviderByName('google')
      expect(google).toBeDefined()
      expect(google?.name).toBe('google')
      expect(google?.displayName).toBe('Google')
    })

    it('不存在的提供商应该返回 undefined', () => {
      const unknown = getProviderByName('unknown_provider')
      expect(unknown).toBeUndefined()
    })
  })

  describe('getProviderDisplayName', () => {
    it('应该返回显示名称', () => {
      expect(getProviderDisplayName('google')).toBe('Google')
      expect(getProviderDisplayName('github')).toBe('GitHub')
    })

    it('未知提供商应该返回原名称', () => {
      expect(getProviderDisplayName('unknown')).toBe('unknown')
    })
  })

  describe('getProviderIcon', () => {
    it('应该返回图标名称', () => {
      const icon = getProviderIcon('google')
      expect(icon).toBeDefined()
    })

    it('未知提供商应该返回默认图标', () => {
      const icon = getProviderIcon('unknown')
      expect(icon).toBe('key')
    })
  })

  describe('getProviderAuthUrl', () => {
    it('应该生成正确的授权 URL', () => {
      const url = getProviderAuthUrl('google', {
        clientId: 'test-client-id',
        redirectUri: 'http://localhost:8090/api/oauth2-redirect',
      })
      expect(url).toContain('accounts.google.com')
      expect(url).toContain('client_id=test-client-id')
    })
  })

  describe('isProviderConfigured', () => {
    it('有 clientId 的提供商应该返回 true', () => {
      expect(isProviderConfigured({ clientId: 'test', clientSecret: 'test' })).toBe(true)
    })

    it('没有 clientId 的提供商应该返回 false', () => {
      expect(isProviderConfigured({ clientId: '', clientSecret: '' })).toBe(false)
      expect(isProviderConfigured({})).toBe(false)
    })
  })
})
