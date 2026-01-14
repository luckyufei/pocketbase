// T012: src/store/errors.ts 测试
import { describe, it, expect, beforeEach } from 'bun:test'
import { createStore } from 'jotai'
import {
  errorsAtom,
  addErrorAtom,
  removeErrorAtom,
  clearErrorsAtom,
  hasErrorsAtom,
  type AppError,
} from './errors'

describe('errorsAtom', () => {
  let store: ReturnType<typeof createStore>

  beforeEach(() => {
    store = createStore()
  })

  describe('初始状态', () => {
    it('应该初始化为空数组', () => {
      const errors = store.get(errorsAtom)
      expect(errors).toEqual([])
    })

    it('hasErrorsAtom 应该返回 false', () => {
      const hasErrors = store.get(hasErrorsAtom)
      expect(hasErrors).toBe(false)
    })
  })

  describe('addErrorAtom', () => {
    it('应该添加错误到列表', () => {
      const error: Omit<AppError, 'id' | 'timestamp'> = {
        message: '测试错误',
        code: 'TEST_ERROR',
      }

      store.set(addErrorAtom, error)
      const errors = store.get(errorsAtom)

      expect(errors).toHaveLength(1)
      expect(errors[0].message).toBe('测试错误')
      expect(errors[0].code).toBe('TEST_ERROR')
      expect(errors[0].id).toBeDefined()
      expect(errors[0].timestamp).toBeDefined()
    })

    it('应该支持添加多个错误', () => {
      store.set(addErrorAtom, { message: '错误1' })
      store.set(addErrorAtom, { message: '错误2' })
      store.set(addErrorAtom, { message: '错误3' })

      const errors = store.get(errorsAtom)
      expect(errors).toHaveLength(3)
    })

    it('hasErrorsAtom 应该返回 true', () => {
      store.set(addErrorAtom, { message: '错误' })
      const hasErrors = store.get(hasErrorsAtom)
      expect(hasErrors).toBe(true)
    })
  })

  describe('removeErrorAtom', () => {
    it('应该根据 ID 移除错误', () => {
      store.set(addErrorAtom, { message: '错误1' })
      store.set(addErrorAtom, { message: '错误2' })

      const errors = store.get(errorsAtom)
      const errorId = errors[0].id

      store.set(removeErrorAtom, errorId)
      const updatedErrors = store.get(errorsAtom)

      expect(updatedErrors).toHaveLength(1)
      expect(updatedErrors[0].message).toBe('错误2')
    })

    it('移除不存在的 ID 不应该报错', () => {
      store.set(addErrorAtom, { message: '错误' })
      store.set(removeErrorAtom, 'non-existent-id')

      const errors = store.get(errorsAtom)
      expect(errors).toHaveLength(1)
    })
  })

  describe('clearErrorsAtom', () => {
    it('应该清空所有错误', () => {
      store.set(addErrorAtom, { message: '错误1' })
      store.set(addErrorAtom, { message: '错误2' })
      store.set(addErrorAtom, { message: '错误3' })

      store.set(clearErrorsAtom)
      const errors = store.get(errorsAtom)

      expect(errors).toEqual([])
    })

    it('清空后 hasErrorsAtom 应该返回 false', () => {
      store.set(addErrorAtom, { message: '错误' })
      store.set(clearErrorsAtom)

      const hasErrors = store.get(hasErrorsAtom)
      expect(hasErrors).toBe(false)
    })
  })
})
