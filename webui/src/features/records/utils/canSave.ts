/**
 * canSave Logic - Determines if a record can be saved
 * Used by UpsertPanel to control save button state
 */

export interface CanSaveParams {
  saving: boolean
  isNew: boolean
  hasChanges: boolean
}

/**
 * Determine if a record can be saved based on current state
 * @param params - Current form state parameters
 * @returns true if the record can be saved
 *
 * Rules:
 * - Cannot save if currently saving
 * - New records can always be saved
 * - Existing records can only be saved if there are changes
 */
export function canSave({ saving, isNew, hasChanges }: CanSaveParams): boolean {
  if (saving) return false
  if (isNew) return true // Can always save new record
  return hasChanges // For edit mode, need changes
}
