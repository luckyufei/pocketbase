/**
 * useConfirmation hook
 * Provides a convenient way to show confirmation dialogs
 */
import { useCallback } from 'react'
import { useSetAtom } from 'jotai'
import { showConfirmation, type ShowConfirmationParams } from '@/store/confirmation'

/**
 * Hook to show confirmation dialogs
 */
export function useConfirmation() {
  const show = useSetAtom(showConfirmation)

  const confirm = useCallback(
    (params: ShowConfirmationParams) => {
      show(params)
    },
    [show]
  )

  return { confirm }
}
