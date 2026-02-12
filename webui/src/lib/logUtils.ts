/**
 * Log Utils
 * 日志相关工具函数
 */
import dayjs from 'dayjs'
import type { LogEntry } from '@/features/logs/store'

/**
 * 日志级别定义
 */
export interface LogLevelDef {
  level: number
  label: string
  color: string
}

/**
 * 日志级别列表
 * 与 UI 版本对齐：使用完整标签名
 */
export const LOG_LEVELS: LogLevelDef[] = [
  { level: -4, label: 'DEBUG', color: 'text-slate-500' },
  { level: 0, label: 'INFO', color: 'text-blue-500' },
  { level: 4, label: 'WARN', color: 'text-amber-500' },
  { level: 8, label: 'ERROR', color: 'text-red-500' },
]

/**
 * 获取日志级别标签
 */
export function getLogLevelLabel(level: number): string {
  const found = LOG_LEVELS.find((l) => l.level === level)
  return found?.label ?? 'UNKN'
}

/**
 * 获取日志级别颜色类名
 */
export function getLogLevelColor(level: number): string {
  const found = LOG_LEVELS.find((l) => l.level === level)
  return found?.color ?? 'text-gray-500'
}

/**
 * 格式化日志日期 (UTC)
 */
export function formatLogDate(date: string): string {
  if (!date) return ''
  return date.replace('Z', ' UTC').replace('T', ' ')
}

/**
 * 格式化日志日期 (本地时间)
 */
export function formatLogDateLocal(date: string): string {
  if (!date) return ''
  return dayjs(date).format('YYYY-MM-DD HH:mm:ss.SSS') + ' Local'
}

/**
 * 预览键项
 */
export interface PreviewKeyItem {
  key: string
  label?: string
}

/**
 * 提取日志预览键
 */
export function extractLogPreviewKeys(log: LogEntry): PreviewKeyItem[] {
  const keys: PreviewKeyItem[] = []

  if (!log.data || Object.keys(log.data).length === 0) {
    return keys
  }

  const isRequest = log.data.type === 'request'

  if (isRequest) {
    // 请求类型日志提取特定字段
    const requestKeys = ['status', 'execTime', 'auth', 'authId', 'userIP']
    for (const key of requestKeys) {
      if (typeof log.data[key] !== 'undefined') {
        keys.push({ key })
      }
    }

    // 添加 referer（如果来自不同源）
    if (
      log.data.referer &&
      typeof window !== 'undefined' &&
      !log.data.referer.includes(window.location.host)
    ) {
      keys.push({ key: 'referer' })
    }
  } else {
    // 非请求类型提取前6个字段（排除 error 和 details）
    const allKeys = Object.keys(log.data)
    for (const key of allKeys) {
      if (key !== 'error' && key !== 'details' && keys.length < 6) {
        keys.push({ key })
      }
    }
  }

  // error 和 details 放在最后
  if (log.data.error) {
    keys.push({ key: 'error', label: 'label-danger' })
  }
  if (log.data.details) {
    keys.push({ key: 'details', label: 'label-warning' })
  }

  return keys
}

/**
 * 字符串化值
 */
export function stringifyValue(value: unknown, defaultValue = 'N/A', maxLength = 80): string {
  if (value === null || value === undefined) {
    return defaultValue
  }

  let str: string
  if (typeof value === 'object') {
    str = JSON.stringify(value)
  } else {
    str = String(value)
  }

  if (maxLength > 0 && str.length > maxLength) {
    return str.slice(0, maxLength) + '...'
  }

  return str
}

/**
 * 下载日志为 JSON 文件
 */
export function downloadLogAsJson(log: LogEntry | LogEntry[]): void {
  const logs = Array.isArray(log) ? log : [log]

  if (logs.length === 0) return

  const dateFilenameRegex = /[-:. ]/gi

  let filename: string
  let content: string

  if (logs.length === 1) {
    const singleLog = logs[0]
    filename = `log_${singleLog.created.replace(dateFilenameRegex, '')}.json`
    content = JSON.stringify(singleLog, null, 2)
  } else {
    // 按时间排序
    const sorted = [...logs].sort((a, b) => {
      if (a.created < b.created) return 1
      if (a.created > b.created) return -1
      return 0
    })
    const to = sorted[0].created.replace(dateFilenameRegex, '')
    const from = sorted[sorted.length - 1].created.replace(dateFilenameRegex, '')
    filename = `${sorted.length}_logs_${from}_to_${to}.json`
    content = JSON.stringify(sorted, null, 2)
  }

  // 创建下载
  if (typeof document !== 'undefined') {
    const blob = new Blob([content], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }
}

/**
 * 优先显示的数据键（用于详情面板）
 */
export const PRIORITIZED_DATA_KEYS = [
  'execTime',
  'type',
  'auth',
  'authId',
  'status',
  'method',
  'url',
  'referer',
  'remoteIP',
  'userIP',
  'userAgent',
  'error',
  'details',
]

/**
 * 提取排序后的数据键
 */
export function extractSortedDataKeys(data: Record<string, unknown>): string[] {
  if (!data) return []

  const keys: string[] = []

  // 先添加优先键
  for (const key of PRIORITIZED_DATA_KEYS) {
    if (typeof data[key] !== 'undefined') {
      keys.push(key)
    }
  }

  // 再添加其他键
  for (const key of Object.keys(data)) {
    if (!keys.includes(key)) {
      keys.push(key)
    }
  }

  return keys
}

/**
 * 检查值是否为空
 */
export function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === 'string' && value.trim() === '') return true
  if (Array.isArray(value) && value.length === 0) return true
  if (typeof value === 'object' && Object.keys(value).length === 0) return true
  return false
}
