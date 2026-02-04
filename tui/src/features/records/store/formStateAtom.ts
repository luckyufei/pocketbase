/**
 * Form State Atom (Task 3.4)
 *
 * Manages the state for record create/edit forms
 */

import { atom } from "jotai";

/**
 * Edit mode type
 */
export type EditMode = "create" | "edit" | null;

/**
 * Schema field definition (simplified)
 */
export interface SchemaField {
  name: string;
  type: string;
  required: boolean;
}

/**
 * Form state
 */
export interface FormState {
  mode: EditMode;
  collection: string | null;
  recordId: string | null;
  originalData: Record<string, unknown> | null;
  currentData: Record<string, unknown>;
  errors: Record<string, string>;
  isDirty: boolean;
  schema: SchemaField[];
}

/**
 * Initial state
 */
const initialState: FormState = {
  mode: null,
  collection: null,
  recordId: null,
  originalData: null,
  currentData: {},
  errors: {},
  isDirty: false,
  schema: [],
};

/**
 * Form state atom
 */
export const formStateAtom = atom<FormState>(initialState);

/**
 * Compute if form is dirty (current differs from original)
 */
export function computeIsDirty(
  originalData: Record<string, unknown> | null,
  currentData: Record<string, unknown>
): boolean {
  if (originalData === null) {
    // Create mode: dirty if any field has value
    return Object.values(currentData).some(
      (v) => v !== undefined && v !== null && v !== ""
    );
  }

  // Edit mode: compare with original
  const originalKeys = Object.keys(originalData);
  const currentKeys = Object.keys(currentData);

  // Check all keys
  const allKeys = new Set([...originalKeys, ...currentKeys]);

  for (const key of allKeys) {
    const originalValue = originalData[key];
    const currentValue = currentData[key];

    if (JSON.stringify(originalValue) !== JSON.stringify(currentValue)) {
      return true;
    }
  }

  return false;
}

/**
 * Enter create mode
 */
export function enterCreateMode(
  collection: string,
  schema: SchemaField[]
): FormState {
  return {
    mode: "create",
    collection,
    recordId: null,
    originalData: null,
    currentData: {},
    errors: {},
    isDirty: false,
    schema,
  };
}

/**
 * Enter edit mode
 */
export function enterEditMode(
  collection: string,
  recordId: string,
  recordData: Record<string, unknown>
): FormState {
  return {
    mode: "edit",
    collection,
    recordId,
    originalData: { ...recordData },
    currentData: { ...recordData },
    errors: {},
    isDirty: false,
    schema: [],
  };
}

/**
 * Update a field value
 */
export function updateFieldValue(
  state: FormState,
  fieldName: string,
  value: unknown
): FormState {
  const newCurrentData = {
    ...state.currentData,
    [fieldName]: value,
  };

  return {
    ...state,
    currentData: newCurrentData,
    isDirty: computeIsDirty(state.originalData, newCurrentData),
  };
}

/**
 * Set a field error
 */
export function setFieldError(
  state: FormState,
  fieldName: string,
  error: string
): FormState {
  return {
    ...state,
    errors: {
      ...state.errors,
      [fieldName]: error,
    },
  };
}

/**
 * Clear a field error
 */
export function clearFieldError(state: FormState, fieldName: string): FormState {
  const { [fieldName]: _, ...restErrors } = state.errors;
  return {
    ...state,
    errors: restErrors,
  };
}

/**
 * Reset form state
 */
export function resetFormState(): FormState {
  return initialState;
}
