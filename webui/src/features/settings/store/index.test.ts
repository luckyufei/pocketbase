/**
 * Settings Store 测试
 * TDD: 红灯阶段 - 先写测试
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { createStore } from 'jotai'
import {
  settingsAtom,
  isLoadingAtom,
  isSavingAtom,
  hasChangesAtom,
  healthDataAtom,
  originalSettingsAtom,
  updateSettingsAtom,
  resetSettingsAtom,
  type AppSettings,
  type HealthData,
} from './index'

describe('Settings Store', () => {
  let store: ReturnType<typeof createStore>

  beforeEach(() => {
    store = createStore()
  })

  describe('settingsAtom', () => {
    it('should have default empty settings', () => {
      const settings = store.get(settingsAtom)
      expect(settings).toEqual({
        meta: {
          appName: '',
          appURL: '',
          hideControls: false,
        },
        batch: {
          enabled: true,
          maxRequests: 50,
          timeout: 3,
          maxBodySize: 0,
        },
        trustedProxy: {
          headers: [],
          useLeftmostIP: false,
        },
        rateLimits: {
          enabled: false,
          rules: [],
        },
      })
    })

    it('should update settings', () => {
      const newSettings: AppSettings = {
        meta: {
          appName: 'Test App',
          appURL: 'https://test.com',
          hideControls: true,
        },
        batch: {
          enabled: false,
          maxRequests: 100,
          timeout: 5,
          maxBodySize: 1024,
        },
        trustedProxy: {
          headers: ['X-Forwarded-For'],
          useLeftmostIP: true,
        },
        rateLimits: {
          enabled: true,
          rules: [{ label: 'test', maxRequests: 10, duration: 60 }],
        },
      }
      store.set(settingsAtom, newSettings)
      expect(store.get(settingsAtom)).toEqual(newSettings)
    })
  })

  describe('isLoadingAtom', () => {
    it('should default to false', () => {
      expect(store.get(isLoadingAtom)).toBe(false)
    })

    it('should update loading state', () => {
      store.set(isLoadingAtom, true)
      expect(store.get(isLoadingAtom)).toBe(true)
    })
  })

  describe('isSavingAtom', () => {
    it('should default to false', () => {
      expect(store.get(isSavingAtom)).toBe(false)
    })

    it('should update saving state', () => {
      store.set(isSavingAtom, true)
      expect(store.get(isSavingAtom)).toBe(true)
    })
  })

  describe('healthDataAtom', () => {
    it('should have default empty health data', () => {
      const health = store.get(healthDataAtom)
      expect(health).toEqual({
        databaseType: '',
        version: '',
      })
    })

    it('should update health data', () => {
      const newHealth: HealthData = {
        databaseType: 'PostgreSQL',
        version: '0.23.0',
      }
      store.set(healthDataAtom, newHealth)
      expect(store.get(healthDataAtom)).toEqual(newHealth)
    })
  })

  describe('hasChangesAtom', () => {
    it('should return false when settings match original', () => {
      expect(store.get(hasChangesAtom)).toBe(false)
    })

    it('should return true when settings differ from original', () => {
      const settings = store.get(settingsAtom)
      store.set(settingsAtom, {
        ...settings,
        meta: { ...settings.meta, appName: 'Changed' },
      })
      expect(store.get(hasChangesAtom)).toBe(true)
    })
  })

  describe('updateSettingsAtom', () => {
    it('should partially update settings', () => {
      store.set(updateSettingsAtom, { meta: { appName: 'Updated App' } })
      const settings = store.get(settingsAtom)
      expect(settings.meta.appName).toBe('Updated App')
      expect(settings.meta.appURL).toBe('') // 保持原值
    })

    it('should deep merge nested objects', () => {
      store.set(updateSettingsAtom, {
        rateLimits: { enabled: true },
      })
      const settings = store.get(settingsAtom)
      expect(settings.rateLimits.enabled).toBe(true)
      expect(settings.rateLimits.rules).toEqual([]) // 保持原值
    })
  })

  describe('resetSettingsAtom', () => {
    it('should reset settings to original', () => {
      // 先修改设置
      store.set(settingsAtom, {
        ...store.get(settingsAtom),
        meta: { appName: 'Changed', appURL: 'https://changed.com', hideControls: true },
      })
      expect(store.get(hasChangesAtom)).toBe(true)

      // 重置
      store.set(resetSettingsAtom)
      expect(store.get(hasChangesAtom)).toBe(false)
    })
  })
})
