import { describe, it, expect } from 'bun:test'
import { exportFormData } from './exportFormData'
import type { CollectionModel } from 'pocketbase'

describe('exportFormData', () => {
  const baseCollection: CollectionModel = {
    id: 'col1',
    name: 'test_collection',
    type: 'base',
    system: false,
    fields: [
      { name: 'id', type: 'text' },
      { name: 'title', type: 'text', required: true },
      { name: 'count', type: 'number' },
      { name: 'data', type: 'json' },
      { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
      { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
    ],
    indexes: [],
    created: '',
    updated: '',
  } as CollectionModel

  const authCollection: CollectionModel = {
    ...baseCollection,
    id: 'auth1',
    name: 'users',
    type: 'auth',
    fields: [
      { name: 'id', type: 'text' },
      { name: 'email', type: 'email', required: true },
      { name: 'password', type: 'password' },
      { name: 'name', type: 'text' },
      { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
      { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
    ],
  } as CollectionModel

  it('should export basic fields', () => {
    const formData = exportFormData({
      record: { title: 'Test', count: 42 },
      collection: baseCollection,
    })

    expect(formData.get('title')).toBe('Test')
    expect(formData.get('count')).toBe('42')
  })

  it('should skip autodate fields', () => {
    const formData = exportFormData({
      record: {
        title: 'Test',
        created: '2024-01-01T00:00:00Z',
        updated: '2024-01-01T00:00:00Z',
      },
      collection: baseCollection,
    })

    expect(formData.get('title')).toBe('Test')
    expect(formData.has('created')).toBe(false)
    expect(formData.has('updated')).toBe(false)
  })

  it('should handle JSON fields', () => {
    const formData = exportFormData({
      record: {
        title: 'Test',
        data: { foo: 'bar', num: 123 },
      },
      collection: baseCollection,
    })

    expect(formData.get('data')).toBe('{"foo":"bar","num":123}')
  })

  it('should validate JSON fields and throw on invalid JSON', () => {
    expect(() => {
      exportFormData({
        record: {
          title: 'Test',
          data: 'invalid json {',
        },
        collection: baseCollection,
      })
    }).toThrow()
  })

  it('should convert undefined to empty string', () => {
    const formData = exportFormData({
      record: { title: 'Test', count: undefined },
      collection: baseCollection,
    })

    expect(formData.get('title')).toBe('Test')
    expect(formData.get('count')).toBe('')
  })

  it('should convert null to empty string', () => {
    const formData = exportFormData({
      record: { title: 'Test', count: null },
      collection: baseCollection,
    })

    expect(formData.get('count')).toBe('')
  })

  it('should handle arrays', () => {
    const collectionWithSelect = {
      ...baseCollection,
      fields: [
        ...baseCollection.fields,
        { name: 'tags', type: 'select', maxSelect: 3 },
      ],
    } as CollectionModel

    const formData = exportFormData({
      record: { title: 'Test', tags: ['a', 'b', 'c'] },
      collection: collectionWithSelect,
    })

    expect(formData.getAll('tags')).toEqual(['a', 'b', 'c'])
  })

  it('should handle empty arrays', () => {
    const collectionWithSelect = {
      ...baseCollection,
      fields: [
        ...baseCollection.fields,
        { name: 'tags', type: 'select', maxSelect: 3 },
      ],
    } as CollectionModel

    const formData = exportFormData({
      record: { title: 'Test', tags: [] },
      collection: collectionWithSelect,
    })

    expect(formData.get('tags')).toBe('')
  })

  it('should handle file uploads with + suffix', () => {
    const collectionWithFile = {
      ...baseCollection,
      fields: [
        ...baseCollection.fields,
        { name: 'avatar', type: 'file', maxSelect: 1 },
      ],
    } as CollectionModel

    const mockFile = new File(['test'], 'test.png', { type: 'image/png' })
    const formData = exportFormData({
      record: { title: 'Test' },
      collection: collectionWithFile,
      uploadedFiles: { avatar: [mockFile] },
    })

    expect(formData.get('avatar+')).toBeInstanceOf(File)
  })

  it('should handle file deletions with - suffix', () => {
    const collectionWithFile = {
      ...baseCollection,
      fields: [
        ...baseCollection.fields,
        { name: 'avatar', type: 'file', maxSelect: 1 },
      ],
    } as CollectionModel

    const formData = exportFormData({
      record: { title: 'Test' },
      collection: collectionWithFile,
      deletedFiles: { avatar: ['old_file.png'] },
    })

    expect(formData.get('avatar-')).toBe('old_file.png')
  })

  it('should skip password field for auth collection unless explicitly set', () => {
    const formData = exportFormData({
      record: { email: 'test@example.com', name: 'Test User' },
      collection: authCollection,
    })

    expect(formData.get('email')).toBe('test@example.com')
    expect(formData.get('name')).toBe('Test User')
    expect(formData.has('password')).toBe(false)
  })

  it('should include password for auth collection when set', () => {
    const formData = exportFormData({
      record: {
        email: 'test@example.com',
        password: 'secret123',
        passwordConfirm: 'secret123',
      },
      collection: authCollection,
    })

    expect(formData.get('password')).toBe('secret123')
    expect(formData.get('passwordConfirm')).toBe('secret123')
  })

  it('should handle boolean values', () => {
    const collectionWithBool = {
      ...baseCollection,
      fields: [
        ...baseCollection.fields,
        { name: 'active', type: 'bool' },
      ],
    } as CollectionModel

    const formData = exportFormData({
      record: { title: 'Test', active: true },
      collection: collectionWithBool,
    })

    expect(formData.get('active')).toBe('true')

    const formData2 = exportFormData({
      record: { title: 'Test', active: false },
      collection: collectionWithBool,
    })

    expect(formData2.get('active')).toBe('false')
  })

  it('should include id field when set for new records', () => {
    const formData = exportFormData({
      record: { id: 'custom_id', title: 'Test' },
      collection: baseCollection,
    })

    expect(formData.get('id')).toBe('custom_id')
  })
})
