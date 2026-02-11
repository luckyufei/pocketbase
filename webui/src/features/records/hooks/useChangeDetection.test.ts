import { renderHook } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { useChangeDetection } from './useChangeDetection'

describe('useChangeDetection', () => {
  it('should return false when no changes', () => {
    const original = { title: 'Test', count: 5 }
    const current = { title: 'Test', count: 5 }

    const { result } = renderHook(() =>
      useChangeDetection({
        original,
        current,
        uploadedFiles: {},
        deletedFiles: {},
      })
    )

    expect(result.current.hasChanges).toBe(false)
    expect(result.current.hasDataChanges).toBe(false)
    expect(result.current.hasFileChanges).toBe(false)
  })

  it('should detect data changes', () => {
    const original = { title: 'Test', count: 5 }
    const current = { title: 'Modified', count: 5 }

    const { result } = renderHook(() =>
      useChangeDetection({
        original,
        current,
        uploadedFiles: {},
        deletedFiles: {},
      })
    )

    expect(result.current.hasDataChanges).toBe(true)
    expect(result.current.hasChanges).toBe(true)
  })

  it('should detect file uploads', () => {
    const original = { title: 'Test' }
    const current = { title: 'Test' }
    const mockFile = new File(['content'], 'test.txt', { type: 'text/plain' })

    const { result } = renderHook(() =>
      useChangeDetection({
        original,
        current,
        uploadedFiles: { attachment: [mockFile] },
        deletedFiles: {},
      })
    )

    expect(result.current.hasFileChanges).toBe(true)
    expect(result.current.hasChanges).toBe(true)
    expect(result.current.hasDataChanges).toBe(false)
  })

  it('should detect file deletions', () => {
    const original = { title: 'Test' }
    const current = { title: 'Test' }

    const { result } = renderHook(() =>
      useChangeDetection({
        original,
        current,
        uploadedFiles: {},
        deletedFiles: { attachment: ['file1.txt', 'file2.txt'] },
      })
    )

    expect(result.current.hasFileChanges).toBe(true)
    expect(result.current.hasChanges).toBe(true)
  })

  it('should detect combined changes', () => {
    const original = { title: 'Test' }
    const current = { title: 'Modified' }
    const mockFile = new File(['content'], 'test.txt', { type: 'text/plain' })

    const { result } = renderHook(() =>
      useChangeDetection({
        original,
        current,
        uploadedFiles: { docs: [mockFile] },
        deletedFiles: { images: ['old.jpg'] },
      })
    )

    expect(result.current.hasChanges).toBe(true)
    expect(result.current.hasFileChanges).toBe(true)
    expect(result.current.hasDataChanges).toBe(true)
  })

  it('should handle empty arrays in uploadedFiles and deletedFiles', () => {
    const original = { title: 'Test' }
    const current = { title: 'Test' }

    const { result } = renderHook(() =>
      useChangeDetection({
        original,
        current,
        uploadedFiles: { field1: [], field2: [] },
        deletedFiles: { field1: [], field2: [] },
      })
    )

    expect(result.current.hasFileChanges).toBe(false)
    expect(result.current.hasChanges).toBe(false)
  })

  it('should detect nested object changes', () => {
    const original = { config: { enabled: true, value: 10 } }
    const current = { config: { enabled: true, value: 20 } }

    const { result } = renderHook(() =>
      useChangeDetection({
        original,
        current,
        uploadedFiles: {},
        deletedFiles: {},
      })
    )

    expect(result.current.hasDataChanges).toBe(true)
    expect(result.current.hasChanges).toBe(true)
  })

  it('should detect array changes', () => {
    const original = { tags: ['a', 'b', 'c'] }
    const current = { tags: ['a', 'b', 'd'] }

    const { result } = renderHook(() =>
      useChangeDetection({
        original,
        current,
        uploadedFiles: {},
        deletedFiles: {},
      })
    )

    expect(result.current.hasDataChanges).toBe(true)
    expect(result.current.hasChanges).toBe(true)
  })
})
