/**
 * Record Form Component (Task 3.1)
 *
 * Main form component for creating and editing records.
 * Renders fields based on collection schema.
 *
 * UI Design (from spec 2.2):
 * ┌─────────────────────────────────────────────────────┐
 * │ Create Record: posts                                │
 * ├─────────────────────────────────────────────────────┤
 * │                                                     │
 * │  title *      [                               ]     │
 * │  content      [                               ]     │
 * │  published    [ ] false                            │
 * │  author       [@users:_______________]             │
 * │                                                     │
 * │  [Ctrl+S] Save   [Esc] Cancel   [Tab] Next field   │
 * └─────────────────────────────────────────────────────┘
 *
 * Keyboard shortcuts:
 * - Tab: Move to next field
 * - Shift+Tab: Move to previous field
 * - Ctrl+S: Save record
 * - Esc: Cancel (with dirty check)
 * - Space: Toggle bool fields
 */

import React, { useState, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import { FieldInput } from "./FieldInput.js";
import type { FormState, SchemaField } from "../store/formStateAtom.js";
import { navigateField, NavigationDirection } from "../lib/formNavigation.js";
import { validateField, aggregateErrors } from "../lib/fieldValidation.js";

export interface RecordFormProps {
  /** Form state */
  state: FormState;
  /** Called when a field value changes */
  onFieldChange: (fieldName: string, value: unknown) => void;
  /** Called when form is submitted */
  onSubmit: () => void;
  /** Called when form is cancelled */
  onCancel: () => void;
  /** Loading state during save */
  isSaving?: boolean;
}

/**
 * Filter schema to only show editable fields (non-system fields)
 */
function getEditableFields(schema: SchemaField[]): SchemaField[] {
  const systemFields = ["id", "created", "updated", "collectionId", "collectionName"];
  return schema.filter((field) => !systemFields.includes(field.name));
}

/**
 * Record Form Component
 */
export function RecordForm({
  state,
  onFieldChange,
  onSubmit,
  onCancel,
  isSaving = false,
}: RecordFormProps): React.ReactElement | null {
  const [focusedIndex, setFocusedIndex] = useState(0);
  const editableFields = getEditableFields(state.schema);

  // Handle keyboard navigation
  useInput(
    (input, key) => {
      if (isSaving) return;

      // Tab navigation
      if (key.tab) {
        const direction: NavigationDirection = key.shift ? "previous" : "next";
        const newIndex = navigateField(
          focusedIndex,
          editableFields.length,
          direction
        );
        setFocusedIndex(newIndex);
        return;
      }

      // Ctrl+S to save
      if (key.ctrl && input === "s") {
        // Validate all fields before saving
        const errors: Record<string, string> = {};
        for (const field of editableFields) {
          const value = state.currentData[field.name];
          const fieldErrors = validateField(field, value);
          if (fieldErrors.length > 0) {
            errors[field.name] = fieldErrors[0];
          }
        }

        if (Object.keys(errors).length === 0) {
          onSubmit();
        }
        return;
      }

      // Escape to cancel
      if (key.escape) {
        onCancel();
        return;
      }

      // Space toggles bool fields
      if (input === " ") {
        const currentField = editableFields[focusedIndex];
        if (currentField?.type === "bool") {
          const currentValue = state.currentData[currentField.name];
          onFieldChange(currentField.name, !currentValue);
        }
        return;
      }
    },
    { isActive: state.mode !== null }
  );

  if (state.mode === null) {
    return null;
  }

  const title =
    state.mode === "create"
      ? `Create Record: ${state.collection}`
      : `Edit Record: ${state.collection}/${state.recordId}`;

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" padding={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="cyan">
          {title}
        </Text>
        {state.isDirty && (
          <Text color="yellow"> [Modified]</Text>
        )}
      </Box>

      {/* Fields */}
      <Box flexDirection="column" marginBottom={1}>
        {editableFields.length === 0 ? (
          <Text color="gray">No editable fields in schema</Text>
        ) : (
          editableFields.map((field, index) => (
            <Box key={field.name} marginBottom={1}>
              <FieldInput
                field={field}
                value={state.currentData[field.name]}
                onChange={(value) => onFieldChange(field.name, value)}
                isFocused={index === focusedIndex}
                error={state.errors[field.name]}
              />
            </Box>
          ))
        )}
      </Box>

      {/* Footer */}
      <Box borderStyle="single" borderTop borderBottom={false} borderLeft={false} borderRight={false}>
        {isSaving ? (
          <Text color="yellow">Saving...</Text>
        ) : (
          <Box>
            <Text color="green">[Ctrl+S]</Text>
            <Text> Save   </Text>
            <Text color="red">[Esc]</Text>
            <Text> Cancel   </Text>
            <Text color="gray">[Tab]</Text>
            <Text color="gray"> Next field</Text>
          </Box>
        )}
      </Box>

      {/* Field count and current position */}
      <Box>
        <Text color="gray">
          Field {focusedIndex + 1}/{editableFields.length}
          {editableFields[focusedIndex] && (
            <> • {editableFields[focusedIndex].name}</>
          )}
        </Text>
      </Box>
    </Box>
  );
}
