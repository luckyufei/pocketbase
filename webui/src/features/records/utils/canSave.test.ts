/**
 * canSave Logic Unit Tests
 * T9800: 创建 canSave 逻辑测试
 */
import { describe, it, expect } from 'vitest'
import { canSave } from './canSave'

describe('canSave', () => {
  describe('when saving is true', () => {
    it('should return false for new record', () => {
      expect(canSave({ saving: true, isNew: true, hasChanges: true })).toBe(false)
    })

    it('should return false for existing record with changes', () => {
      expect(canSave({ saving: true, isNew: false, hasChanges: true })).toBe(false)
    })

    it('should return false for existing record without changes', () => {
      expect(canSave({ saving: true, isNew: false, hasChanges: false })).toBe(false)
    })
  })

  describe('when saving is false', () => {
    describe('new record', () => {
      it('should return true regardless of hasChanges (true)', () => {
        expect(canSave({ saving: false, isNew: true, hasChanges: true })).toBe(true)
      })

      it('should return true regardless of hasChanges (false)', () => {
        expect(canSave({ saving: false, isNew: true, hasChanges: false })).toBe(true)
      })
    })

    describe('existing record', () => {
      it('should return true when has changes', () => {
        expect(canSave({ saving: false, isNew: false, hasChanges: true })).toBe(true)
      })

      it('should return false when no changes', () => {
        expect(canSave({ saving: false, isNew: false, hasChanges: false })).toBe(false)
      })
    })
  })

  describe('edge cases', () => {
    it('should prioritize saving check over other conditions', () => {
      // Even if isNew is true and hasChanges is true, saving=true should block
      expect(canSave({ saving: true, isNew: true, hasChanges: true })).toBe(false)
    })

    it('should allow new record to be saved immediately', () => {
      // New record with no changes yet should still be saveable
      expect(canSave({ saving: false, isNew: true, hasChanges: false })).toBe(true)
    })
  })
})
