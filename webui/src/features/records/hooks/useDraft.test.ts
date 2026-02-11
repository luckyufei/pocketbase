import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { useDraft } from './useDraft'

describe('useDraft', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()
  })

  it('should save draft to localStorage', () => {
    const { result } = renderHook(() =>
      useDraft({ collectionId: 'test_collection', recordId: 'record123' })
    )

    act(() => {
      result.current.saveDraft({ title: 'Test', content: 'Hello' })
    })

    expect(result.current.hasDraft).toBe(true)
    expect(localStorage.getItem('record_draft_test_collection_record123')).toBe(
      JSON.stringify({ title: 'Test', content: 'Hello' })
    )
  })

  it('should restore draft from localStorage', () => {
    localStorage.setItem(
      'record_draft_test_collection_new',
      JSON.stringify({ title: 'Saved Draft' })
    )

    const { result } = renderHook(() => useDraft({ collectionId: 'test_collection' }))

    expect(result.current.hasDraft).toBe(true)

    const draft = result.current.getDraft()
    expect(draft).toEqual({ title: 'Saved Draft' })
  })

  it('should delete draft', () => {
    localStorage.setItem(
      'record_draft_test_collection_new',
      JSON.stringify({ title: 'To Delete' })
    )

    const { result } = renderHook(() => useDraft({ collectionId: 'test_collection' }))

    act(() => {
      result.current.deleteDraft()
    })

    expect(result.current.hasDraft).toBe(false)
    expect(localStorage.getItem('record_draft_test_collection_new')).toBeNull()
  })

  it('should detect if draft exists', () => {
    const { result: result1 } = renderHook(() => useDraft({ collectionId: 'col1' }))
    expect(result1.current.hasDraft).toBe(false)

    localStorage.setItem('record_draft_col2_new', JSON.stringify({ data: 'test' }))
    const { result: result2 } = renderHook(() => useDraft({ collectionId: 'col2' }))
    expect(result2.current.hasDraft).toBe(true)
  })

  it('should generate correct draft key format', () => {
    const { result } = renderHook(() =>
      useDraft({ collectionId: 'my_collection', recordId: 'abc123' })
    )

    act(() => {
      result.current.saveDraft({ test: true })
    })

    expect(localStorage.getItem('record_draft_my_collection_abc123')).toBe(
      JSON.stringify({ test: true })
    )
  })

  it('should use "new" as recordId when not provided', () => {
    const { result } = renderHook(() => useDraft({ collectionId: 'test_col' }))

    act(() => {
      result.current.saveDraft({ newRecord: true })
    })

    expect(localStorage.getItem('record_draft_test_col_new')).toBe(
      JSON.stringify({ newRecord: true })
    )
  })

  it('should exclude password fields when restoring draft', () => {
    localStorage.setItem(
      'record_draft_auth_col_new',
      JSON.stringify({
        email: 'test@example.com',
        password: 'secret123',
        passwordConfirm: 'secret123',
        name: 'Test User',
      })
    )

    const { result } = renderHook(() => useDraft({ collectionId: 'auth_col' }))

    const draft = result.current.restoreDraft()

    expect(draft).toEqual({
      email: 'test@example.com',
      name: 'Test User',
    })
    expect(draft?.password).toBeUndefined()
    expect(draft?.passwordConfirm).toBeUndefined()
  })

  it('should return null for getDraft when no draft exists', () => {
    const { result } = renderHook(() => useDraft({ collectionId: 'empty' }))

    const draft = result.current.getDraft()
    expect(draft).toBeNull()
  })

  it('should handle invalid JSON gracefully', () => {
    localStorage.setItem('record_draft_bad_new', 'not valid json')

    const { result } = renderHook(() => useDraft({ collectionId: 'bad' }))

    // getDraft should return null for invalid JSON
    const draft = result.current.getDraft()
    expect(draft).toBeNull()
  })
})
