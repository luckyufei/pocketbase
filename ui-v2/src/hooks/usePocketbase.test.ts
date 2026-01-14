/**
 * usePocketbase Hook 单元测试
 * TDD: 红灯阶段
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { renderHook, act } from '@testing-library/react'
import { usePocketbase } from './usePocketbase'
import { resetApiClient } from '@/lib/ApiClient'
import PocketBase from 'pocketbase'

describe('usePocketbase', () => {
  beforeEach(() => {
    resetApiClient()
  })

  afterEach(() => {
    resetApiClient()
  })

  it('应该返回 PocketBase 实例', () => {
    const { result } = renderHook(() => usePocketbase())
    expect(result.current.pb).toBeInstanceOf(PocketBase)
  })

  it('应该返回 isAuthenticated 状态', () => {
    const { result } = renderHook(() => usePocketbase())
    expect(typeof result.current.isAuthenticated).toBe('boolean')
  })

  it('应该返回 user 属性', () => {
    const { result } = renderHook(() => usePocketbase())
    expect(result.current.user).toBeDefined()
  })

  it('应该返回 token 属性', () => {
    const { result } = renderHook(() => usePocketbase())
    expect(typeof result.current.token).toBe('string')
  })

  it('应该返回 logout 方法', () => {
    const { result } = renderHook(() => usePocketbase())
    expect(typeof result.current.logout).toBe('function')
  })

  it('logout 应该清除认证状态', () => {
    const { result } = renderHook(() => usePocketbase())
    act(() => {
      result.current.logout()
    })
    expect(result.current.token).toBe('')
  })
})
