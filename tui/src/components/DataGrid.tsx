/**
 * DataGrid Component
 * 
 * Generic table component based on ink-table
 */

import React from "react";
import { Box, Text } from "ink";
import Table from "ink-table";

export interface DataGridColumn {
  key: string;
  label: string;
  width?: number;
}

export interface DataGridProps<T extends Record<string, unknown>> {
  data: T[];
  columns?: DataGridColumn[];
  selectedIndex?: number;
  emptyMessage?: string;
}

/**
 * DataGrid component for displaying tabular data
 */
export function DataGrid<T extends Record<string, unknown>>({
  data,
  columns,
  selectedIndex,
  emptyMessage = "No data",
}: DataGridProps<T>): React.ReactElement {
  if (data.length === 0) {
    return (
      <Box>
        <Text color="gray">{emptyMessage}</Text>
      </Box>
    );
  }

  // If columns specified, transform data to show only those columns
  const displayData = columns
    ? data.map((row) => {
        const display: Record<string, unknown> = {};
        columns.forEach((col) => {
          display[col.label] = row[col.key];
        });
        return display;
      })
    : data;

  return (
    <Box flexDirection="column">
      <Table data={displayData as Record<string, string>[]} />
      {selectedIndex !== undefined && selectedIndex >= 0 && (
        <Box marginTop={1}>
          <Text color="gray">
            Selected: {selectedIndex + 1}/{data.length}
          </Text>
        </Box>
      )}
    </Box>
  );
}
