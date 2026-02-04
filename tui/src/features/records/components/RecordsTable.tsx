/**
 * Records Table Component (STORY-5.3)
 * 
 * Displays records in a table format
 */

import React from "react";
import { Box, Text } from "ink";
import type { RecordData } from "../store/recordsAtoms.js";

export interface RecordsTableProps {
  records: RecordData[];
  selectedIndex: number;
  columns?: string[];
  onSelect?: (record: RecordData) => void;
}

/**
 * Truncate string to max length
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + "...";
}

/**
 * Format value for display
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "boolean") return value ? "✓" : "✗";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/**
 * Records Table Component
 */
export function RecordsTable({ 
  records, 
  selectedIndex,
  columns = ["id", "created"],
}: RecordsTableProps): React.ReactElement {
  if (records.length === 0) {
    return (
      <Box>
        <Text color="gray">No records found</Text>
      </Box>
    );
  }

  // Determine columns from first record if not specified
  const displayColumns = columns.length > 0 
    ? columns 
    : ["id", ...Object.keys(records[0]?.data || {}).slice(0, 4)];

  const columnWidth = Math.floor(100 / displayColumns.length);

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box borderStyle="single" borderBottom paddingX={1}>
        {displayColumns.map((col) => (
          <Box key={col} width={`${columnWidth}%`}>
            <Text bold color="cyan">{truncate(col, 15)}</Text>
          </Box>
        ))}
      </Box>

      {/* Rows */}
      {records.map((record, index) => (
        <Box 
          key={record.id} 
          paddingX={1}
        >
          <Text inverse={index === selectedIndex} color={index === selectedIndex ? "cyan" : undefined}>
            {index === selectedIndex ? "▶ " : "  "}
          </Text>
          {displayColumns.map((col) => {
            const value = col === "id" || col === "created" || col === "updated"
              ? record[col as keyof RecordData]
              : record.data[col];
            return (
              <Box key={col} width={`${columnWidth}%`}>
                <Text 
                  color={index === selectedIndex ? "cyan" : undefined}
                  bold={index === selectedIndex}
                >
                  {truncate(formatValue(value), 20)}
                </Text>
              </Box>
            );
          })}
        </Box>
      ))}

      {/* Footer */}
      <Box marginTop={1}>
        <Text color="gray">
          {records.length} record{records.length !== 1 ? "s" : ""} • 
          ↑↓ navigate • Enter view • Page Up/Down paginate • Esc back
        </Text>
      </Box>
    </Box>
  );
}
