/**
 * Settings Store
 * 系统设置状态管理
 */
import { atom } from 'jotai'

// ============ 类型定义 ============

/**
 * 应用元数据设置
 */
export interface MetaSettings {
  appName: string
  appURL: string
  hideControls: boolean
}

/**
 * 批量请求设置
 */
export interface BatchSettings {
  enabled: boolean
  maxRequests: number
  timeout: number
  maxBodySize: number
}

/**
 * 可信代理设置
 */
export interface TrustedProxySettings {
  headers: string[]
  useLeftmostIP: boolean
}

/**
 * 速率限制规则
 */
export interface RateLimitRule {
  label: string
  maxRequests: number
  duration: number
}

/**
 * 速率限制设置
 */
export interface RateLimitsSettings {
  enabled: boolean
  rules: RateLimitRule[]
}

/**
 * 完整应用设置
 */
export interface AppSettings {
  meta: MetaSettings
  batch: BatchSettings
  trustedProxy: TrustedProxySettings
  rateLimits: RateLimitsSettings
}

/**
 * 健康检查数据
 */
export interface HealthData {
  databaseType: string
  version: string
}

// ============ 默认值 ============

const defaultSettings: AppSettings = {
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
}

const defaultHealthData: HealthData = {
  databaseType: '',
  version: '',
}

// ============ Atoms ============

/**
 * 当前设置
 */
export const settingsAtom = atom<AppSettings>(defaultSettings)

/**
 * 原始设置（用于比较变更）
 */
export const originalSettingsAtom = atom<AppSettings>(defaultSettings)

/**
 * 加载状态
 */
export const isLoadingAtom = atom<boolean>(false)

/**
 * 保存状态
 */
export const isSavingAtom = atom<boolean>(false)

/**
 * 健康检查数据
 */
export const healthDataAtom = atom<HealthData>(defaultHealthData)

/**
 * 是否有未保存的变更（派生 atom）
 */
export const hasChangesAtom = atom((get) => {
  const current = get(settingsAtom)
  const original = get(originalSettingsAtom)
  return JSON.stringify(current) !== JSON.stringify(original)
})

// ============ 写入 Atoms ============

/**
 * 深度合并对象
 */
function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const result = { ...target }
  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const sourceValue = source[key]
      const targetValue = target[key]
      if (
        sourceValue !== null &&
        typeof sourceValue === 'object' &&
        !Array.isArray(sourceValue) &&
        targetValue !== null &&
        typeof targetValue === 'object' &&
        !Array.isArray(targetValue)
      ) {
        result[key] = deepMerge(targetValue, sourceValue as any)
      } else if (sourceValue !== undefined) {
        result[key] = sourceValue as T[Extract<keyof T, string>]
      }
    }
  }
  return result
}

/**
 * 部分更新设置
 */
export const updateSettingsAtom = atom(null, (get, set, update: Partial<AppSettings>) => {
  const current = get(settingsAtom)
  const merged = deepMerge(current, update)
  set(settingsAtom, merged)
})

/**
 * 重置设置到原始值
 */
export const resetSettingsAtom = atom(null, (get, set) => {
  const original = get(originalSettingsAtom)
  set(settingsAtom, JSON.parse(JSON.stringify(original)))
})

/**
 * 初始化设置（加载后调用）
 */
export const initSettingsAtom = atom(null, (_get, set, settings: AppSettings) => {
  const cloned = JSON.parse(JSON.stringify(settings))
  set(settingsAtom, cloned)
  set(originalSettingsAtom, JSON.parse(JSON.stringify(settings)))
})
