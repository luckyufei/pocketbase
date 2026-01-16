/**
 * useJobs Hook 测试
 * TDD: 红灯阶段
 */
import { describe, expect, it } from 'bun:test'
import { useJobs } from './useJobs'

describe('useJobs', () => {
  it('应该导出 useJobs 函数', () => {
    expect(typeof useJobs).toBe('function')
  })

  // Hook 的完整测试需要 React 测试环境
  // 这里只验证导出
})
