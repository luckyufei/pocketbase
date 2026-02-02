/**
 * Confirmation Store 单元测试
 * TDD: 红灯阶段
 */
import { describe, it, expect } from 'bun:test'
import { createStore } from 'jotai'
import {
  confirmationAtom,
  isConfirmationOpenAtom,
  showConfirmation,
  hideConfirmation,
  type ConfirmationState,
} from './confirmation'

describe('Confirmation Store', () => {
  describe('confirmationAtom', () => {
    it('应该默认为 null', () => {
      const store = createStore()
      expect(store.get(confirmationAtom)).toBeNull()
    })
  })

  describe('isConfirmationOpenAtom', () => {
    it('未显示确认框时应该为 false', () => {
      const store = createStore()
      expect(store.get(isConfirmationOpenAtom)).toBe(false)
    })

    it('显示确认框后应该为 true', () => {
      const store = createStore()
      store.set(showConfirmation, {
        title: '确认删除',
        message: '确定要删除吗？',
        onConfirm: () => {},
      })
      expect(store.get(isConfirmationOpenAtom)).toBe(true)
    })
  })

  describe('showConfirmation', () => {
    it('应该设置确认框状态', () => {
      const store = createStore()
      const onConfirm = () => {}
      const onCancel = () => {}

      store.set(showConfirmation, {
        title: '确认操作',
        message: '确定要执行此操作吗？',
        confirmText: '确定',
        cancelText: '取消',
        onConfirm,
        onCancel,
      })

      const state = store.get(confirmationAtom)
      expect(state).not.toBeNull()
      expect(state?.title).toBe('确认操作')
      expect(state?.message).toBe('确定要执行此操作吗？')
      expect(state?.confirmText).toBe('确定')
      expect(state?.cancelText).toBe('取消')
      expect(state?.onConfirm).toBe(onConfirm)
      expect(state?.onCancel).toBe(onCancel)
    })

    it('应该使用默认的按钮文本', () => {
      const store = createStore()
      store.set(showConfirmation, {
        title: '确认',
        message: '确定吗？',
        onConfirm: () => {},
      })

      const state = store.get(confirmationAtom)
      expect(state?.confirmText).toBe('确定')
      expect(state?.cancelText).toBe('取消')
    })

    it('应该支持危险类型', () => {
      const store = createStore()
      store.set(showConfirmation, {
        title: '删除',
        message: '确定删除？',
        onConfirm: () => {},
        isDanger: true,
      })

      const state = store.get(confirmationAtom)
      expect(state?.isDanger).toBe(true)
    })
  })

  describe('hideConfirmation', () => {
    it('应该清除确认框状态', () => {
      const store = createStore()

      // 先显示确认框
      store.set(showConfirmation, {
        title: '确认',
        message: '测试',
        onConfirm: () => {},
      })
      expect(store.get(isConfirmationOpenAtom)).toBe(true)

      // 隐藏确认框
      store.set(hideConfirmation)

      expect(store.get(confirmationAtom)).toBeNull()
      expect(store.get(isConfirmationOpenAtom)).toBe(false)
    })
  })
})
