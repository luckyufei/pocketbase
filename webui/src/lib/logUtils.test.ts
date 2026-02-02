/**
 * Log Utils 测试
 * TDD: 红灯阶段
 */
import { describe, expect, it } from 'bun:test'
import {
  LOG_LEVELS,
  getLogLevelLabel,
  getLogLevelColor,
  formatLogDate,
  formatLogDateLocal,
  extractLogPreviewKeys,
  downloadLogAsJson,
  stringifyValue,
} from './logUtils'

describe('logUtils', () => {
  describe('LOG_LEVELS', () => {
    it('应该包含所有日志级别', () => {
      expect(LOG_LEVELS).toHaveLength(5)
      expect(LOG_LEVELS.map((l) => l.level)).toEqual([-8, -4, 0, 4, 8])
    })

    it('每个级别应该有 label 和 color', () => {
      for (const level of LOG_LEVELS) {
        expect(level.label).toBeDefined()
        expect(level.color).toBeDefined()
      }
    })
  })

  describe('getLogLevelLabel', () => {
    it('应该返回正确的级别标签', () => {
      expect(getLogLevelLabel(-8)).toBe('TRAC')
      expect(getLogLevelLabel(-4)).toBe('DEBU')
      expect(getLogLevelLabel(0)).toBe('INFO')
      expect(getLogLevelLabel(4)).toBe('WARN')
      expect(getLogLevelLabel(8)).toBe('ERRO')
    })

    it('未知级别应该返回 UNKN', () => {
      expect(getLogLevelLabel(100)).toBe('UNKN')
      expect(getLogLevelLabel(-100)).toBe('UNKN')
    })
  })

  describe('getLogLevelColor', () => {
    it('应该返回正确的颜色类名', () => {
      expect(getLogLevelColor(-8)).toBe('text-purple-500')
      expect(getLogLevelColor(-4)).toBe('text-blue-500')
      expect(getLogLevelColor(0)).toBe('text-green-500')
      expect(getLogLevelColor(4)).toBe('text-yellow-500')
      expect(getLogLevelColor(8)).toBe('text-red-500')
    })

    it('未知级别应该返回默认颜色', () => {
      expect(getLogLevelColor(100)).toBe('text-gray-500')
    })
  })

  describe('formatLogDate', () => {
    it('应该格式化 UTC 日期', () => {
      const date = '2026-01-13T10:30:45.123Z'
      const result = formatLogDate(date)
      expect(result).toBe('2026-01-13 10:30:45.123 UTC')
    })

    it('空日期应该返回空字符串', () => {
      expect(formatLogDate('')).toBe('')
      expect(formatLogDate(undefined as any)).toBe('')
    })
  })

  describe('formatLogDateLocal', () => {
    it('应该格式化为本地时间', () => {
      const date = '2026-01-13T10:30:45.123Z'
      const result = formatLogDateLocal(date)
      // 本地时间会因时区不同而变化，只检查格式
      expect(result).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3} Local/)
    })
  })

  describe('extractLogPreviewKeys', () => {
    it('请求类型日志应该提取特定字段', () => {
      const log = {
        id: '1',
        created: '2026-01-13T10:30:45.123Z',
        level: 0,
        message: 'test',
        data: {
          type: 'request',
          status: 200,
          execTime: 15,
          auth: 'users',
          authId: 'abc123',
          userIP: '127.0.0.1',
        },
      }
      const keys = extractLogPreviewKeys(log)
      expect(keys).toContainEqual({ key: 'status' })
      expect(keys).toContainEqual({ key: 'execTime' })
      expect(keys).toContainEqual({ key: 'auth' })
    })

    it('非请求类型应该提取前6个字段', () => {
      const log = {
        id: '1',
        created: '2026-01-13T10:30:45.123Z',
        level: 0,
        message: 'test',
        data: {
          key1: 'value1',
          key2: 'value2',
          key3: 'value3',
          key4: 'value4',
          key5: 'value5',
          key6: 'value6',
          key7: 'value7',
        },
      }
      const keys = extractLogPreviewKeys(log)
      expect(keys).toHaveLength(6)
    })

    it('error 和 details 应该放在最后', () => {
      const log = {
        id: '1',
        created: '2026-01-13T10:30:45.123Z',
        level: 8,
        message: 'error',
        data: {
          key1: 'value1',
          error: 'something went wrong',
          details: '<html>...</html>',
        },
      }
      const keys = extractLogPreviewKeys(log)
      const lastTwo = keys.slice(-2)
      expect(lastTwo).toContainEqual({ key: 'error', label: 'label-danger' })
      expect(lastTwo).toContainEqual({ key: 'details', label: 'label-warning' })
    })

    it('空 data 应该返回空数组', () => {
      const log = {
        id: '1',
        created: '2026-01-13T10:30:45.123Z',
        level: 0,
        message: 'test',
        data: {},
      }
      expect(extractLogPreviewKeys(log)).toEqual([])
    })
  })

  describe('stringifyValue', () => {
    it('应该正确字符串化各种类型', () => {
      expect(stringifyValue('hello')).toBe('hello')
      expect(stringifyValue(123)).toBe('123')
      expect(stringifyValue(true)).toBe('true')
      expect(stringifyValue(null)).toBe('N/A')
      expect(stringifyValue(undefined)).toBe('N/A')
    })

    it('对象应该 JSON 字符串化', () => {
      expect(stringifyValue({ a: 1 })).toBe('{"a":1}')
    })

    it('应该截断超长字符串', () => {
      const longStr = 'a'.repeat(100)
      const result = stringifyValue(longStr, 'N/A', 50)
      expect(result).toHaveLength(53) // 50 + '...'
      expect(result.endsWith('...')).toBe(true)
    })

    it('应该使用自定义默认值', () => {
      expect(stringifyValue(null, 'empty')).toBe('empty')
    })
  })

  describe('downloadLogAsJson', () => {
    it('应该生成正确的文件名', () => {
      const log = {
        id: '1',
        created: '2026-01-13T10:30:45.123Z',
        level: 0,
        message: 'test',
        data: {},
      }
      // 这个函数会触发下载，我们只测试它不会抛出错误
      // 实际下载行为需要在浏览器环境测试
      expect(() => downloadLogAsJson(log)).not.toThrow()
    })
  })
})
