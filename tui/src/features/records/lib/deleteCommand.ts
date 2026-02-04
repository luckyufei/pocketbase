/**
 * Delete Command Parser (Task 2.3)
 *
 * Parses /delete command syntax
 */

/**
 * Result of parsing delete command
 */
export interface DeleteCommandResult {
  collection: string;
  recordIds: string[];
  force: boolean;
}

/**
 * Parse /delete command string
 *
 * Formats:
 * - /delete @collection:id
 * - /delete @collection:id1,id2,id3
 * - /delete @collection:id -f
 * - /delete @collection:id --force
 */
export function parseDeleteCommand(input: string): DeleteCommandResult | null {
  // Remove leading /delete and trim
  const trimmed = input.replace(/^\/delete\s*/i, "").trim();

  // Check for force flag
  const forceFlag = /-f|--force/i.test(trimmed);
  const withoutFlag = trimmed.replace(/\s*(-f|--force)\s*/gi, "").trim();

  // Parse @collection:id format
  const match = withoutFlag.match(/^@([a-zA-Z_][a-zA-Z0-9_]*):(.+)$/);

  if (!match) {
    return null;
  }

  const collection = match[1];
  const idsString = match[2];

  if (!collection || !idsString) {
    return null;
  }

  // Parse comma-separated IDs
  const recordIds = idsString.split(",").map((id) => id.trim()).filter(Boolean);

  if (recordIds.length === 0) {
    return null;
  }

  return {
    collection,
    recordIds,
    force: forceFlag,
  };
}
