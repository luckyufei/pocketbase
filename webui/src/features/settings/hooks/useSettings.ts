/**
 * useSettings Hook
 * 系统设置操作 Hook
 */
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useCallback } from 'react'
import { getApiClient } from '@/lib/ApiClient'
import {
  settingsAtom,
  originalSettingsAtom,
  isLoadingAtom,
  isSavingAtom,
  hasChangesAtom,
  healthDataAtom,
  updateSettingsAtom,
  resetSettingsAtom,
  initSettingsAtom,
  type AppSettings,
} from '../store'

/**
 * 过滤掉已编辑的敏感字段（如密码）
 */
function filterRedactedProps(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {}
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key]
      // 跳过以 ****** 开头的值（已编辑的敏感字段）
      if (typeof value === 'string' && value.startsWith('******')) {
        continue
      }
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        result[key] = filterRedactedProps(value)
      } else {
        result[key] = value
      }
    }
  }
  return result
}

/**
 * 排序速率限制规则
 */
function sortRules(rules: any[]): any[] {
  if (!rules || !Array.isArray(rules)) {
    return rules
  }

  return [...rules].sort((a, b) => {
    const compare = [{}, {}] as any[]

    compare[0].length = a.label?.length || 0
    compare[0].isTag = a.label?.includes(':') || !a.label?.includes('/')
    compare[0].isWildcardTag = compare[0].isTag && a.label?.startsWith('*')
    compare[0].isExactTag = compare[0].isTag && !compare[0].isWildcardTag
    compare[0].isPrefix = !compare[0].isTag && a.label?.endsWith('/')
    compare[0].hasMethod = !compare[0].isTag && a.label?.includes(' /')

    compare[1].length = b.label?.length || 0
    compare[1].isTag = b.label?.includes(':') || !b.label?.includes('/')
    compare[1].isWildcardTag = compare[1].isTag && b.label?.startsWith('*')
    compare[1].isExactTag = compare[1].isTag && !compare[1].isWildcardTag
    compare[1].isPrefix = !compare[1].isTag && b.label?.endsWith('/')
    compare[1].hasMethod = !compare[1].isTag && b.label?.includes(' /')

    for (const item of compare) {
      item.priority = 0

      if (item.isTag) {
        item.priority += 1000
        if (item.isExactTag) {
          item.priority += 10
        } else {
          item.priority += 5
        }
      } else {
        if (item.hasMethod) {
          item.priority += 10
        }
        if (!item.isPrefix) {
          item.priority += 5
        }
      }
    }

    if (
      compare[0].isPrefix &&
      compare[1].isPrefix &&
      ((compare[0].hasMethod && compare[1].hasMethod) ||
        (!compare[0].hasMethod && !compare[1].hasMethod))
    ) {
      if (compare[0].length > compare[1].length) {
        compare[0].priority += 1
      } else if (compare[0].length < compare[1].length) {
        compare[1].priority += 1
      }
    }

    if (compare[0].priority > compare[1].priority) {
      return -1
    }
    if (compare[0].priority < compare[1].priority) {
      return 1
    }
    return 0
  })
}

/**
 * 系统设置 Hook
 */
export function useSettings() {
  const [settings] = useAtom(settingsAtom)
  const originalSettings = useAtomValue(originalSettingsAtom)
  const [isLoading, setIsLoading] = useAtom(isLoadingAtom)
  const [isSaving, setIsSaving] = useAtom(isSavingAtom)
  const hasChanges = useAtomValue(hasChangesAtom)
  const [healthData, setHealthData] = useAtom(healthDataAtom)
  const updateSettings = useSetAtom(updateSettingsAtom)
  const resetSettings = useSetAtom(resetSettingsAtom)
  const initSettings = useSetAtom(initSettingsAtom)

  // 在 hook 内部获取 API client（便于测试 mock）
  const pb = getApiClient()

  /**
   * 加载健康检查数据
   */
  const loadHealthData = useCallback(async () => {
    try {
      const response = await pb.health.check()
      const data = response?.data || {}
      setHealthData({
        databaseType: data.databaseType || '',
        version: data.version || '',
      })
    } catch (err) {
      console.warn('Health check failed:', err)
    }
  }, [setHealthData])

  /**
   * 加载设置
   */
  const loadSettings = useCallback(async () => {
    setIsLoading(true)

    try {
const response = await pb.settings.getAll()
      const settingsData: AppSettings = {
        meta: {
          appName: response?.meta?.appName || '',
          appURL: response?.meta?.appURL || '',
          hideControls: response?.meta?.hideControls || false,
          senderName: response?.meta?.senderName || 'Support',
          senderAddress: response?.meta?.senderAddress || 'support@example.com',
        },
        batch: response?.batch || { enabled: true, maxRequests: 50, timeout: 3, maxBodySize: 0 },
        trustedProxy: response?.trustedProxy || { headers: [], useLeftmostIP: false },
        rateLimits: response?.rateLimits || { enabled: false, rules: [] },
        smtp: response?.smtp || {
          enabled: false,
          host: '',
          port: 587,
          username: '',
          password: '',
          tls: false,
          authMethod: 'PLAIN',
          localName: '',
        },
        s3: response?.s3 || {
          enabled: false,
          bucket: '',
          region: '',
          endpoint: '',
          accessKey: '',
          secret: '',
          forcePathStyle: false,
        },
      }

      // 排序规则
      if (settingsData.rateLimits.rules) {
        settingsData.rateLimits.rules = sortRules(settingsData.rateLimits.rules)
      }

      initSettings(settingsData)
      await loadHealthData()
    } catch (err) {
      console.error('Failed to load settings:', err)
    } finally {
      setIsLoading(false)
    }
  }, [setIsLoading, initSettings, loadHealthData])

  /**
   * 保存设置
   */
  const saveSettings = useCallback(async () => {
    if (isSaving || !hasChanges) {
      return
    }

    setIsSaving(true)

    try {
      // 排序规则
      const settingsToSave = {
        ...settings,
        rateLimits: {
          ...settings.rateLimits,
          rules: sortRules(settings.rateLimits.rules),
        },
      }

const response = await pb.settings.update(filterRedactedProps(settingsToSave))
      const updatedSettings: AppSettings = {
        meta: {
          appName: response?.meta?.appName || settings.meta.appName,
          appURL: response?.meta?.appURL || settings.meta.appURL,
          hideControls: response?.meta?.hideControls || settings.meta.hideControls,
          senderName: response?.meta?.senderName || settings.meta.senderName,
          senderAddress: response?.meta?.senderAddress || settings.meta.senderAddress,
        },
        batch: response?.batch || settings.batch,
        trustedProxy: response?.trustedProxy || settings.trustedProxy,
        rateLimits: response?.rateLimits || settings.rateLimits,
        smtp: response?.smtp || settings.smtp,
        s3: response?.s3 || (settings as any).s3,
      }

      initSettings(updatedSettings)
      await loadHealthData()
    } catch (err) {
      console.error('Failed to save settings:', err)
      throw err
    } finally {
      setIsSaving(false)
    }
  }, [isSaving, hasChanges, settings, setIsSaving, initSettings, loadHealthData])

  return {
    settings,
    originalSettings,
    isLoading,
    isSaving,
    hasChanges,
    healthData,
    loadSettings,
    saveSettings,
    updateSettings,
    resetSettings,
  }
}
