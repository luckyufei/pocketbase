/**
 * Toasts Store 单元测试
 * TDD: 红灯阶段
 */
import { describe, it, expect } from 'bun:test'
import { createStore } from 'jotai'
import {
  toastsAtom,
  addToast,
  removeToast,
  clearToasts,
  type Toast,
  type ToastType,
} from './toasts'

describe('Toasts Store', () => {
  describe('toastsAtom', () => {
    it('应该默认为空数组', () => {
      const store = createStore()
      expect(store.get(toastsAtom)).toEqual([])
    })
  })

  describe('addToast', () => {
    it('应该添加 success toast', () => {
      const store = createStore()
      store.set(addToast, { type: 'success', message: '操作成功' })

      const toasts = store.get(toastsAtom)
      expect(toasts).toHaveLength(1)
      expect(toasts[0].type).toBe('success')
      expect(toasts[0].message).toBe('操作成功')
      expect(toasts[0].id).toBeDefined()
    })

    it('应该添加 error toast', () => {
      const store = createStore()
      store.set(addToast, { type: 'error', message: '操作失败' })

      const toasts = store.get(toastsAtom)
      expect(toasts[0].type).toBe('error')
    })

    it('应该添加 warning toast', () => {
      const store = createStore()
      store.set(addToast, { type: 'warning', message: '警告' })

      const toasts = store.get(toastsAtom)
      expect(toasts[0].type).toBe('warning')
    })

    it('应该添加 info toast', () => {
      const store = createStore()
      store.set(addToast, { type: 'info', message: '提示' })

      const toasts = store.get(toastsAtom)
      expect(toasts[0].type).toBe('info')
    })

    it('应该能添加多个 toast', () => {
      const store = createStore()
      store.set(addToast, { type: 'success', message: '成功1' })
      store.set(addToast, { type: 'error', message: '错误1' })
      store.set(addToast, { type: 'info', message: '信息1' })

      const toasts = store.get(toastsAtom)
      expect(toasts).toHaveLength(3)
    })

    it('应该支持自定义 duration', () => {
      const store = createStore()
      store.set(addToast, { type: 'success', message: '测试', duration: 5000 })

      const toasts = store.get(toastsAtom)
      expect(toasts[0].duration).toBe(5000)
    })
  })

  describe('removeToast', () => {
    it('应该移除指定 toast', () => {
      const store = createStore()
      store.set(addToast, { type: 'success', message: '测试1' })
      store.set(addToast, { type: 'error', message: '测试2' })

      const toasts = store.get(toastsAtom)
      const idToRemove = toasts[0].id

      store.set(removeToast, idToRemove)

      const remainingToasts = store.get(toastsAtom)
      expect(remainingToasts).toHaveLength(1)
      expect(remainingToasts[0].message).toBe('测试2')
    })

    it('移除不存在的 id 不应该报错', () => {
      const store = createStore()
      store.set(addToast, { type: 'success', message: '测试' })

      expect(() => {
        store.set(removeToast, 'non-existent-id')
      }).not.toThrow()

      expect(store.get(toastsAtom)).toHaveLength(1)
    })
  })

  describe('clearToasts', () => {
    it('应该清除所有 toast', () => {
      const store = createStore()
      store.set(addToast, { type: 'success', message: '测试1' })
      store.set(addToast, { type: 'error', message: '测试2' })
      store.set(addToast, { type: 'info', message: '测试3' })

      store.set(clearToasts)

      expect(store.get(toastsAtom)).toEqual([])
    })
  })
})
