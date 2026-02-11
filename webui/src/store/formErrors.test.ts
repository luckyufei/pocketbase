/**
 * FormErrors Store Unit Tests
 * T8100: 创建服务端字段错误显示测试
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { createStore } from 'jotai'
import {
  formErrorsAtom,
  setFormErrorsAtom,
  clearFormErrorsAtom,
  removeFormErrorAtom,
  getNestedError,
  hasErrorsInPaths,
} from './formErrors'

describe('formErrors store', () => {
  let store: ReturnType<typeof createStore>

  beforeEach(() => {
    store = createStore()
  })

  describe('formErrorsAtom', () => {
    it('should have empty initial state', () => {
      expect(store.get(formErrorsAtom)).toEqual({})
    })
  })

  describe('setFormErrorsAtom', () => {
    it('should set errors', () => {
      store.set(setFormErrorsAtom, { name: 'Name is required' })

      expect(store.get(formErrorsAtom)).toEqual({ name: 'Name is required' })
    })

    it('should replace existing errors', () => {
      store.set(setFormErrorsAtom, { name: 'Error 1' })
      store.set(setFormErrorsAtom, { email: 'Error 2' })

      expect(store.get(formErrorsAtom)).toEqual({ email: 'Error 2' })
    })

    it('should handle nested errors', () => {
      store.set(setFormErrorsAtom, {
        fields: {
          0: { name: { message: 'Field name required' } },
        },
      })

      expect(store.get(formErrorsAtom).fields[0].name.message).toBe('Field name required')
    })

    it('should handle null/undefined', () => {
      store.set(setFormErrorsAtom, { name: 'Error' })
      store.set(setFormErrorsAtom, null as any)

      expect(store.get(formErrorsAtom)).toEqual({})
    })
  })

  describe('clearFormErrorsAtom', () => {
    it('should clear all errors', () => {
      store.set(setFormErrorsAtom, { name: 'Error', email: 'Error 2' })
      store.set(clearFormErrorsAtom)

      expect(store.get(formErrorsAtom)).toEqual({})
    })
  })

  describe('removeFormErrorAtom', () => {
    it('should remove single level error', () => {
      store.set(setFormErrorsAtom, { name: 'Error', email: 'Error 2' })
      store.set(removeFormErrorAtom, 'name')

      expect(store.get(formErrorsAtom)).toEqual({ email: 'Error 2' })
    })

    it('should remove nested error', () => {
      store.set(setFormErrorsAtom, {
        fields: {
          0: { name: 'Error 1', type: 'Error 2' },
        },
      })
      store.set(removeFormErrorAtom, 'fields.0.name')

      expect(store.get(formErrorsAtom).fields[0].name).toBeUndefined()
      expect(store.get(formErrorsAtom).fields[0].type).toBe('Error 2')
    })

    it('should handle non-existent path gracefully', () => {
      store.set(setFormErrorsAtom, { name: 'Error' })
      store.set(removeFormErrorAtom, 'nonexistent.path.here')

      expect(store.get(formErrorsAtom)).toEqual({ name: 'Error' })
    })
  })

  describe('getNestedError', () => {
    it('should get top-level error', () => {
      const errors = { name: 'Error' }
      expect(getNestedError(errors, 'name')).toBe('Error')
    })

    it('should get nested error', () => {
      const errors = {
        fields: {
          0: { name: { message: 'Required' } },
        },
      }
      expect(getNestedError(errors, 'fields.0.name.message')).toBe('Required')
    })

    it('should return undefined for non-existent path', () => {
      const errors = { name: 'Error' }
      expect(getNestedError(errors, 'email')).toBeUndefined()
    })

    it('should return undefined for partial path', () => {
      const errors = { name: 'Error' }
      expect(getNestedError(errors, 'name.nested')).toBeUndefined()
    })

    it('should handle array indices in path', () => {
      const errors = {
        items: [{ name: 'Error 0' }, { name: 'Error 1' }],
      }
      expect(getNestedError(errors, 'items.1.name')).toBe('Error 1')
    })
  })

  describe('hasErrorsInPaths', () => {
    it('should return true when path has error', () => {
      const errors = { name: 'Error' }
      expect(hasErrorsInPaths(errors, ['name'])).toBe(true)
    })

    it('should return false when path has no error', () => {
      const errors = { name: 'Error' }
      expect(hasErrorsInPaths(errors, ['email'])).toBe(false)
    })

    it('should return true when any path has error', () => {
      const errors = { name: 'Error' }
      expect(hasErrorsInPaths(errors, ['email', 'name', 'phone'])).toBe(true)
    })

    it('should return false when all paths are empty', () => {
      const errors = {}
      expect(hasErrorsInPaths(errors, ['name', 'email'])).toBe(false)
    })

    it('should handle object errors', () => {
      const errors = {
        name: { message: 'Required', code: 'required' },
      }
      expect(hasErrorsInPaths(errors, ['name'])).toBe(true)
    })

    it('should return false for empty object error', () => {
      const errors = { name: {} }
      expect(hasErrorsInPaths(errors, ['name'])).toBe(false)
    })

    it('should handle array errors', () => {
      const errors = { items: ['Error 1', 'Error 2'] }
      expect(hasErrorsInPaths(errors, ['items'])).toBe(true)
    })

    it('should return false for empty array error', () => {
      const errors = { items: [] }
      expect(hasErrorsInPaths(errors, ['items'])).toBe(false)
    })
  })
})
