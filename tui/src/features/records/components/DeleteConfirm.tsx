/**
 * Delete Confirm Component (Task 2.1)
 *
 * A confirmation dialog for deleting records.
 * Supports single and batch delete operations.
 *
 * UI Design (from spec 2.2):
 * ┌─────────────────────────────────────────────────────┐
 * │ Delete Record                                       │
 * ├─────────────────────────────────────────────────────┤
 * │                                                     │
 * │  Are you sure you want to delete this record?      │
 * │                                                     │
 * │  Collection: posts                                  │
 * │  Record ID:  abc123xyz                              │
 * │  Title:      "My First Post"                        │
 * │                                                     │
 * │  [y] Yes, delete   [n] No, cancel   [Esc] Cancel   │
 * └─────────────────────────────────────────────────────┘
 */

import React from "react";
import { Box, Text, useInput } from "ink";
import type { DeleteConfirmState } from "../store/deleteConfirmAtom.js";

export interface DeleteConfirmProps {
  /** Delete confirmation state */
  state: DeleteConfirmState;
  /** Called when user confirms deletion */
  onConfirm: () => void;
  /** Called when user cancels deletion */
  onCancel: () => void;
  /** Loading state during deletion */
  isDeleting?: boolean;
}

/**
 * Delete Confirm Dialog Component
 */
export function DeleteConfirm({
  state,
  onConfirm,
  onCancel,
  isDeleting = false,
}: DeleteConfirmProps): React.ReactElement | null {
  // Handle keyboard input
  useInput((input, key) => {
    if (isDeleting) return;

    if (input === "y" || input === "Y") {
      onConfirm();
    } else if (input === "n" || input === "N" || key.escape) {
      onCancel();
    } else if (key.return) {
      // Enter key confirms
      onConfirm();
    }
  });

  if (!state.isOpen) {
    return null;
  }

  const isBatch = state.recordIds.length > 1;
  const recordCount = state.recordIds.length;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="red"
      paddingX={2}
      paddingY={1}
    >
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="red">
          {isBatch ? `Delete ${recordCount} Records` : "Delete Record"}
        </Text>
      </Box>

      {/* Confirmation Message */}
      <Box marginBottom={1}>
        <Text>
          {isBatch
            ? `Are you sure you want to delete ${recordCount} records?`
            : "Are you sure you want to delete this record?"}
        </Text>
      </Box>

      {/* Record Info */}
      <Box flexDirection="column" marginBottom={1}>
        <Box>
          <Text color="gray">Collection: </Text>
          <Text color="magenta">{state.collection}</Text>
        </Box>

        {isBatch ? (
          <Box>
            <Text color="gray">Record IDs: </Text>
            <Text color="cyan">{state.recordIds.join(", ")}</Text>
          </Box>
        ) : (
          <>
            <Box>
              <Text color="gray">Record ID:  </Text>
              <Text color="cyan">{state.recordIds[0]}</Text>
            </Box>
            {state.recordInfo && (
              <>
                {Object.entries(state.recordInfo)
                  .filter(
                    ([key]) =>
                      !["id", "created", "updated", "collectionId", "collectionName"].includes(
                        key
                      )
                  )
                  .slice(0, 3)
                  .map(([key, value]) => (
                    <Box key={key}>
                      <Text color="gray">{key.padEnd(12)}</Text>
                      <Text color="green">
                        {typeof value === "string"
                          ? `"${value}"`
                          : JSON.stringify(value)}
                      </Text>
                    </Box>
                  ))}
              </>
            )}
          </>
        )}
      </Box>

      {/* Warning for batch delete */}
      {isBatch && (
        <Box marginBottom={1}>
          <Text color="yellow">⚠ This action cannot be undone!</Text>
        </Box>
      )}

      {/* Actions */}
      <Box>
        {isDeleting ? (
          <Text color="yellow">Deleting...</Text>
        ) : (
          <>
            <Text color="green">[y]</Text>
            <Text> Yes, delete   </Text>
            <Text color="red">[n]</Text>
            <Text> No, cancel   </Text>
            <Text color="gray">[Esc]</Text>
            <Text color="gray"> Cancel</Text>
          </>
        )}
      </Box>
    </Box>
  );
}
