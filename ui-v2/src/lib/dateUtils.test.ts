/**
 * dateUtils.test.ts - 日期工具函数测试
 */
import { describe, expect, it } from 'bun:test'
import { formatDate, formatShortDate, formatRelativeTime } from './dateUtils'

describe('dateUtils', () => {
  describe('formatDate', () => {
    it('should return "-" for null input', () => {
      expect(formatDate(null)).toBe('-')
    })

    it('should return "-" for undefined input', () => {
      expect(formatDate(undefined)).toBe('-')
    })

    it('should return "-" for empty string', () => {
      expect(formatDate('')).toBe('-')
    })

    it('should format a valid ISO date string', () => {
      const result = formatDate('2024-01-15T10:30:00Z')
      // 由于 toLocaleString 依赖于本地设置，我们只验证结果不是默认值
      expect(result).not.toBe('-')
      expect(result.length).toBeGreaterThan(0)
    })
  })

  describe('formatShortDate', () => {
    it('should format date as MM-DD', () => {
      const date = new Date(2024, 0, 15) // January 15, 2024
      expect(formatShortDate(date)).toBe('01-15')
    })

    it('should pad single digit month', () => {
      const date = new Date(2024, 4, 5) // May 5, 2024
      expect(formatShortDate(date)).toBe('05-05')
    })

    it('should format double digit month correctly', () => {
      const date = new Date(2024, 11, 25) // December 25, 2024
      expect(formatShortDate(date)).toBe('12-25')
    })
  })

  describe('formatRelativeTime', () => {
    it('should return "-" for null input', () => {
      expect(formatRelativeTime(null)).toBe('-')
    })

    it('should return "-" for undefined input', () => {
      expect(formatRelativeTime(undefined)).toBe('-')
    })

    it('should return "-" for empty string', () => {
      expect(formatRelativeTime('')).toBe('-')
    })

    it('should return "刚刚" for time less than 60 seconds ago', () => {
      const now = new Date()
      const recent = new Date(now.getTime() - 30 * 1000) // 30 seconds ago
      expect(formatRelativeTime(recent.toISOString())).toBe('刚刚')
    })

    it('should return minutes for time less than 60 minutes ago', () => {
      const now = new Date()
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000)
      expect(formatRelativeTime(fiveMinutesAgo.toISOString())).toBe('5 分钟前')
    })

    it('should return hours for time less than 24 hours ago', () => {
      const now = new Date()
      const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000)
      expect(formatRelativeTime(threeHoursAgo.toISOString())).toBe('3 小时前')
    })

    it('should return days for time less than 7 days ago', () => {
      const now = new Date()
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)
      expect(formatRelativeTime(twoDaysAgo.toISOString())).toBe('2 天前')
    })

    it('should return formatted date for time more than 7 days ago', () => {
      const now = new Date()
      const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000)
      const result = formatRelativeTime(tenDaysAgo.toISOString())
      // Should fall back to formatDate, which returns a non-"-" value
      expect(result).not.toBe('-')
      expect(result).not.toContain('天前')
    })
  })
})
