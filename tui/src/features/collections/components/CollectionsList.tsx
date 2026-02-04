/**
 * Collections List Component (STORY-4.3)
 * 
 * Displays collections in a table format
 * Shows: name, type, records count
 */

import React from "react";
import { Box, Text } from "ink";
import type { CollectionInfo } from "../store/collectionsAtoms.js";

export interface CollectionsListProps {
  collections: CollectionInfo[];
  selectedIndex: number;
  onSelect?: (collection: CollectionInfo) => void;
}

/**
 * Get color for collection type badge
 */
function getTypeColor(type: string): string {
  switch (type) {
    case "auth":
      return "blue";
    case "view":
      return "magenta";
    default:
      return "gray";
  }
}

/**
 * Collections List Component
 */
export function CollectionsList({ 
  collections, 
  selectedIndex,
}: CollectionsListProps): React.ReactElement {
  if (collections.length === 0) {
    return (
      <Box>
        <Text color="gray">No collections found</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box borderStyle="single" borderBottom paddingX={1}>
        <Box width="30%">
          <Text bold color="cyan">Name</Text>
        </Box>
        <Box width="20%">
          <Text bold color="cyan">Type</Text>
        </Box>
        <Box width="20%">
          <Text bold color="cyan">Records</Text>
        </Box>
      </Box>

      {/* Rows */}
      {collections.map((col, index) => (
        <Box 
          key={col.id} 
          paddingX={1}
        >
          <Box width="30%">
            <Text 
              color={index === selectedIndex ? "cyan" : undefined}
              bold={index === selectedIndex}
              inverse={index === selectedIndex}
            >
              {index === selectedIndex ? "▶ " : "  "}{col.name}
            </Text>
          </Box>
          <Box width="20%">
            <Text color={getTypeColor(col.type)}>
              {col.type}
            </Text>
          </Box>
          <Box width="20%">
            <Text color={index === selectedIndex ? "cyan" : "gray"}>
              {col.recordsCount}
            </Text>
          </Box>
        </Box>
      ))}

      {/* Footer */}
      <Box marginTop={1}>
        <Text color="gray">
          {collections.length} collection{collections.length !== 1 ? "s" : ""} • 
          ↑↓ navigate • Enter select • Esc back
        </Text>
      </Box>
    </Box>
  );
}
