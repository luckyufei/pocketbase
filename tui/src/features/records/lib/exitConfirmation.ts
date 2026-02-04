/**
 * Exit Confirmation (Task 5.4)
 *
 * Handles confirmation when exiting with unsaved changes
 */

/**
 * Determine if exit should be confirmed
 */
export function shouldConfirmExit(isDirty: boolean): boolean {
  return isDirty;
}

/**
 * Exit confirmation state
 */
export interface ExitConfirmState {
  isOpen: boolean;
  onConfirm: (() => void) | null;
  onCancel: (() => void) | null;
}

/**
 * Initial exit confirm state
 */
export const initialExitConfirmState: ExitConfirmState = {
  isOpen: false,
  onConfirm: null,
  onCancel: null,
};
