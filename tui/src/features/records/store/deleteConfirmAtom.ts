/**
 * Delete Confirm State Atom (Task 2.2)
 *
 * Manages the state for delete confirmation dialog
 */

import { atom } from "jotai";

/**
 * Delete confirmation state
 */
export interface DeleteConfirmState {
  isOpen: boolean;
  collection: string | null;
  recordIds: string[];
  recordInfo: Record<string, unknown> | null;
}

/**
 * Initial state
 */
const initialState: DeleteConfirmState = {
  isOpen: false,
  collection: null,
  recordIds: [],
  recordInfo: null,
};

/**
 * Delete confirm atom
 */
export const deleteConfirmAtom = atom<DeleteConfirmState>(initialState);

/**
 * Open delete confirm dialog
 */
export interface OpenDeleteConfirmParams {
  collection: string;
  recordIds: string[];
  recordInfo: Record<string, unknown> | null;
}

export function openDeleteConfirm(params: OpenDeleteConfirmParams): DeleteConfirmState {
  return {
    isOpen: true,
    collection: params.collection,
    recordIds: params.recordIds,
    recordInfo: params.recordInfo,
  };
}

/**
 * Close delete confirm dialog and reset state
 */
export function closeDeleteConfirm(): DeleteConfirmState {
  return initialState;
}
