/**
 * Field Skip Rules Unit Tests
 * T9200: 创建字段跳过规则测试
 */
import { describe, it, expect } from 'vitest'
import type { CollectionField, CollectionModel } from 'pocketbase'
import {
  shouldSkipField,
  getEditableFields,
  getSkipFieldNames,
  BASE_SKIP_FIELD_NAMES,
  AUTH_SKIP_FIELD_NAMES,
} from './fieldSkipRules'

// Helper to create a mock field
function createField(overrides: Partial<CollectionField> = {}): CollectionField {
  return {
    id: 'field_id',
    name: 'test_field',
    type: 'text',
    system: false,
    hidden: false,
    required: false,
    ...overrides,
  } as CollectionField
}

// Helper to create a mock collection
function createCollection(
  overrides: Partial<CollectionModel> = {}
): CollectionModel {
  return {
    id: 'collection_id',
    name: 'test_collection',
    type: 'base',
    system: false,
    fields: [],
    indexes: [],
    created: '2024-01-01',
    updated: '2024-01-01',
    ...overrides,
  } as CollectionModel
}

describe('fieldSkipRules', () => {
  describe('BASE_SKIP_FIELD_NAMES', () => {
    it('should contain id, created, updated', () => {
      expect(BASE_SKIP_FIELD_NAMES).toContain('id')
      expect(BASE_SKIP_FIELD_NAMES).toContain('created')
      expect(BASE_SKIP_FIELD_NAMES).toContain('updated')
    })
  })

  describe('AUTH_SKIP_FIELD_NAMES', () => {
    it('should contain base fields', () => {
      expect(AUTH_SKIP_FIELD_NAMES).toContain('id')
      expect(AUTH_SKIP_FIELD_NAMES).toContain('created')
      expect(AUTH_SKIP_FIELD_NAMES).toContain('updated')
    })

    it('should contain auth-specific fields', () => {
      expect(AUTH_SKIP_FIELD_NAMES).toContain('email')
      expect(AUTH_SKIP_FIELD_NAMES).toContain('emailVisibility')
      expect(AUTH_SKIP_FIELD_NAMES).toContain('password')
      expect(AUTH_SKIP_FIELD_NAMES).toContain('passwordConfirm')
      expect(AUTH_SKIP_FIELD_NAMES).toContain('verified')
      expect(AUTH_SKIP_FIELD_NAMES).toContain('tokenKey')
    })
  })

  describe('shouldSkipField', () => {
    describe('base collection', () => {
      it('should skip id field by default', () => {
        const field = createField({ name: 'id' })
        expect(shouldSkipField(field, 'base')).toBe(true)
      })

      it('should not skip id field when includeId is true', () => {
        const field = createField({ name: 'id' })
        expect(shouldSkipField(field, 'base', { includeId: true })).toBe(false)
      })

      it('should skip created field', () => {
        const field = createField({ name: 'created' })
        expect(shouldSkipField(field, 'base')).toBe(true)
      })

      it('should skip updated field', () => {
        const field = createField({ name: 'updated' })
        expect(shouldSkipField(field, 'base')).toBe(true)
      })

      it('should skip autodate fields by default', () => {
        const field = createField({ type: 'autodate' })
        expect(shouldSkipField(field, 'base')).toBe(true)
      })

      it('should not skip autodate fields when includeAutodate is true', () => {
        const field = createField({ type: 'autodate', name: 'custom_autodate' })
        expect(shouldSkipField(field, 'base', { includeAutodate: true })).toBe(false)
      })

      it('should skip hidden fields by default', () => {
        const field = createField({ hidden: true })
        expect(shouldSkipField(field, 'base')).toBe(true)
      })

      it('should not skip hidden fields when includeHidden is true', () => {
        const field = createField({ hidden: true })
        expect(shouldSkipField(field, 'base', { includeHidden: true })).toBe(false)
      })

      it('should not skip regular text field', () => {
        const field = createField({ name: 'title', type: 'text' })
        expect(shouldSkipField(field, 'base')).toBe(false)
      })

      it('should not skip number field', () => {
        const field = createField({ name: 'count', type: 'number' })
        expect(shouldSkipField(field, 'base')).toBe(false)
      })
    })

    describe('auth collection', () => {
      it('should skip email field', () => {
        const field = createField({ name: 'email' })
        expect(shouldSkipField(field, 'auth')).toBe(true)
      })

      it('should skip emailVisibility field', () => {
        const field = createField({ name: 'emailVisibility' })
        expect(shouldSkipField(field, 'auth')).toBe(true)
      })

      it('should skip password field', () => {
        const field = createField({ name: 'password' })
        expect(shouldSkipField(field, 'auth')).toBe(true)
      })

      it('should skip passwordConfirm field', () => {
        const field = createField({ name: 'passwordConfirm' })
        expect(shouldSkipField(field, 'auth')).toBe(true)
      })

      it('should skip verified field', () => {
        const field = createField({ name: 'verified' })
        expect(shouldSkipField(field, 'auth')).toBe(true)
      })

      it('should skip tokenKey field', () => {
        const field = createField({ name: 'tokenKey' })
        expect(shouldSkipField(field, 'auth')).toBe(true)
      })

      it('should not skip custom fields', () => {
        const field = createField({ name: 'username', type: 'text' })
        expect(shouldSkipField(field, 'auth')).toBe(false)
      })
    })

    describe('view collection', () => {
      it('should skip id field by default', () => {
        const field = createField({ name: 'id' })
        expect(shouldSkipField(field, 'view')).toBe(true)
      })

      it('should not skip email field (not auth collection)', () => {
        const field = createField({ name: 'email' })
        expect(shouldSkipField(field, 'view')).toBe(false)
      })
    })
  })

  describe('getEditableFields', () => {
    it('should return empty array for null collection', () => {
      expect(getEditableFields(null)).toEqual([])
    })

    it('should return empty array for collection without fields', () => {
      const collection = createCollection({ fields: undefined as any })
      expect(getEditableFields(collection)).toEqual([])
    })

    it('should filter out system fields', () => {
      const collection = createCollection({
        fields: [
          createField({ name: 'id' }),
          createField({ name: 'created' }),
          createField({ name: 'updated' }),
          createField({ name: 'title', type: 'text' }),
        ],
      })
      const editable = getEditableFields(collection)
      expect(editable).toHaveLength(1)
      expect(editable[0].name).toBe('title')
    })

    it('should include id field when includeId is true', () => {
      const collection = createCollection({
        fields: [
          createField({ name: 'id' }),
          createField({ name: 'title', type: 'text' }),
        ],
      })
      const editable = getEditableFields(collection, { includeId: true })
      expect(editable).toHaveLength(2)
      expect(editable.map(f => f.name)).toContain('id')
    })

    it('should filter out auth fields for auth collection', () => {
      const collection = createCollection({
        type: 'auth',
        fields: [
          createField({ name: 'email' }),
          createField({ name: 'password' }),
          createField({ name: 'username', type: 'text' }),
        ],
      })
      const editable = getEditableFields(collection)
      expect(editable).toHaveLength(1)
      expect(editable[0].name).toBe('username')
    })

    it('should include autodate fields when includeAutodate is true', () => {
      const collection = createCollection({
        fields: [
          createField({ name: 'custom_date', type: 'autodate' }),
          createField({ name: 'title', type: 'text' }),
        ],
      })
      const editable = getEditableFields(collection, { includeAutodate: true })
      expect(editable).toHaveLength(2)
      expect(editable.map(f => f.name)).toContain('custom_date')
    })
  })

  describe('getSkipFieldNames', () => {
    it('should return base skip fields for base collection', () => {
      expect(getSkipFieldNames('base')).toEqual(BASE_SKIP_FIELD_NAMES)
    })

    it('should return auth skip fields for auth collection', () => {
      expect(getSkipFieldNames('auth')).toEqual(AUTH_SKIP_FIELD_NAMES)
    })

    it('should return base skip fields for view collection', () => {
      expect(getSkipFieldNames('view')).toEqual(BASE_SKIP_FIELD_NAMES)
    })
  })
})
