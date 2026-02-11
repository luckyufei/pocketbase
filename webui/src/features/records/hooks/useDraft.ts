import { useState, useEffect, useCallback } from 'react'

interface UseDraftOptions {
  collectionId: string
  recordId?: string
}

interface UseDraftReturn {
  hasDraft: boolean
  getDraft: () => Record<string, unknown> | null
  saveDraft: (data: Record<string, unknown>) => void
  deleteDraft: () => void
  restoreDraft: () => Record<string, unknown> | null
}

/**
 * Hook for managing draft data in localStorage
 * Draft key format: record_draft_{collectionId}_{recordId}
 */
export function useDraft(options: UseDraftOptions): UseDraftReturn {
  const draftKey = `record_draft_${options.collectionId}_${options.recordId || 'new'}`

  const [hasDraft, setHasDraft] = useState(false)

  useEffect(() => {
    try {
      const draft = localStorage.getItem(draftKey)
      setHasDraft(!!draft)
    } catch {
      setHasDraft(false)
    }
  }, [draftKey])

  const getDraft = useCallback(() => {
    try {
      const raw = localStorage.getItem(draftKey)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  }, [draftKey])

  const saveDraft = useCallback(
    (data: Record<string, unknown>) => {
      try {
        localStorage.setItem(draftKey, JSON.stringify(data))
        setHasDraft(true)
      } catch (e) {
        // localStorage might be full - silently fail
        console.warn('Draft save failed:', e)
        try {
          localStorage.removeItem(draftKey)
        } catch {
          // ignore
        }
        setHasDraft(false)
      }
    },
    [draftKey]
  )

  const deleteDraft = useCallback(() => {
    try {
      localStorage.removeItem(draftKey)
    } catch {
      // ignore
    }
    setHasDraft(false)
  }, [draftKey])

  const restoreDraft = useCallback(() => {
    const draft = getDraft()
    if (draft) {
      // Exclude sensitive fields from restoration
      delete draft.password
      delete draft.passwordConfirm
    }
    return draft
  }, [getDraft])

  return { hasDraft, getDraft, saveDraft, deleteDraft, restoreDraft }
}
