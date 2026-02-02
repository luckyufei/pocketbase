/**
 * Trace Utils 测试
 * TDD: 红灯阶段
 */
import { describe, expect, it } from 'bun:test'
import {
  formatDuration,
  getStatusClass,
  getStatusColor,
  getStatusIcon,
  buildSpanHierarchy,
  type SpanNode,
} from './traceUtils'

describe('traceUtils', () => {
  describe('formatDuration', () => {
    it('应该格式化微秒', () => {
      expect(formatDuration(500)).toBe('500μs')
      expect(formatDuration(999)).toBe('999μs')
    })

    it('应该格式化毫秒', () => {
      expect(formatDuration(1000)).toBe('1.0ms')
      expect(formatDuration(1500)).toBe('1.5ms')
      expect(formatDuration(999000)).toBe('999.0ms')
    })

    it('应该格式化秒', () => {
      expect(formatDuration(1000000)).toBe('1.00s')
      expect(formatDuration(2500000)).toBe('2.50s')
    })

    it('null/undefined 应该返回 -', () => {
      expect(formatDuration(null as any)).toBe('-')
      expect(formatDuration(undefined as any)).toBe('-')
    })
  })

  describe('getStatusClass', () => {
    it('应该返回正确的状态类名', () => {
      expect(getStatusClass('OK')).toBe('status-success')
      expect(getStatusClass('ERROR')).toBe('status-error')
      expect(getStatusClass('CANCELLED')).toBe('status-cancelled')
      expect(getStatusClass('UNKNOWN')).toBe('status-unknown')
    })
  })

  describe('getStatusColor', () => {
    it('应该返回正确的 Tailwind 颜色类', () => {
      expect(getStatusColor('OK')).toContain('green')
      expect(getStatusColor('ERROR')).toContain('red')
      expect(getStatusColor('CANCELLED')).toContain('gray')
    })
  })

  describe('getStatusIcon', () => {
    it('应该返回正确的图标名称', () => {
      expect(getStatusIcon('OK')).toBe('check')
      expect(getStatusIcon('ERROR')).toBe('alert-triangle')
      expect(getStatusIcon('CANCELLED')).toBe('x')
      expect(getStatusIcon('UNKNOWN')).toBe('help-circle')
    })
  })

  describe('buildSpanHierarchy', () => {
    it('应该正确构建层级结构', () => {
      const spans = [
        {
          span_id: 'span1',
          parent_id: null,
          name: 'root',
          start_time: '2026-01-13T10:00:00Z',
          duration: 1000000,
          status: 'OK',
          attributes: {},
        },
        {
          span_id: 'span2',
          parent_id: 'span1',
          name: 'child1',
          start_time: '2026-01-13T10:00:00.100Z',
          duration: 500000,
          status: 'OK',
          attributes: {},
        },
        {
          span_id: 'span3',
          parent_id: 'span1',
          name: 'child2',
          start_time: '2026-01-13T10:00:00.200Z',
          duration: 300000,
          status: 'OK',
          attributes: {},
        },
      ]

      const result = buildSpanHierarchy(spans)

      expect(result.rootSpans).toHaveLength(1)
      expect(result.rootSpans[0].span_id).toBe('span1')
      expect(result.rootSpans[0].children).toHaveLength(2)
      expect(result.totalDuration).toBeGreaterThan(0)
      expect(result.minStartTime).toBeGreaterThan(0)
    })

    it('空数组应该返回空结果', () => {
      const result = buildSpanHierarchy([])
      expect(result.rootSpans).toHaveLength(0)
      expect(result.totalDuration).toBe(0)
    })

    it('应该处理没有父节点的孤儿 span', () => {
      const spans = [
        {
          span_id: 'span1',
          parent_id: 'non-existent',
          name: 'orphan',
          start_time: '2026-01-13T10:00:00Z',
          duration: 1000000,
          status: 'OK',
          attributes: {},
        },
      ]

      const result = buildSpanHierarchy(spans)
      expect(result.rootSpans).toHaveLength(1)
    })
  })
})
