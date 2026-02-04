/**
 * Record Detail Component (STORY-5.3)
 * 
 * Displays single record in JSON format
 */

import React from "react";
import { Box, Text } from "ink";
import type { RecordData } from "../store/recordsAtoms.js";

export interface RecordDetailProps {
  record: RecordData;
}

/**
 * Format JSON with syntax highlighting
 */
function JsonLine({ 
  indent, 
  keyName, 
  value, 
  isLast 
}: { 
  indent: number; 
  keyName?: string; 
  value: unknown; 
  isLast: boolean;
}): React.ReactElement {
  const spaces = "  ".repeat(indent);
  const comma = isLast ? "" : ",";
  
  if (value === null) {
    return (
      <Text>
        {spaces}{keyName && <><Text color="cyan">"{keyName}"</Text>: </>}
        <Text color="gray">null</Text>{comma}
      </Text>
    );
  }
  
  if (typeof value === "boolean") {
    return (
      <Text>
        {spaces}{keyName && <><Text color="cyan">"{keyName}"</Text>: </>}
        <Text color="yellow">{value ? "true" : "false"}</Text>{comma}
      </Text>
    );
  }
  
  if (typeof value === "number") {
    return (
      <Text>
        {spaces}{keyName && <><Text color="cyan">"{keyName}"</Text>: </>}
        <Text color="yellow">{value}</Text>{comma}
      </Text>
    );
  }
  
  if (typeof value === "string") {
    return (
      <Text>
        {spaces}{keyName && <><Text color="cyan">"{keyName}"</Text>: </>}
        <Text color="green">"{value}"</Text>{comma}
      </Text>
    );
  }
  
  // For complex objects/arrays, stringify
  return (
    <Text>
      {spaces}{keyName && <><Text color="cyan">"{keyName}"</Text>: </>}
      <Text color="white">{JSON.stringify(value)}</Text>{comma}
    </Text>
  );
}

/**
 * Record Detail Component
 */
export function RecordDetail({ record }: RecordDetailProps): React.ReactElement {
  const allFields = {
    id: record.id,
    created: record.created,
    updated: record.updated,
    collectionId: record.collectionId,
    collectionName: record.collectionName,
    ...record.data,
  };
  
  const entries = Object.entries(allFields).filter(([_, v]) => v !== undefined);

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold>Record: </Text>
        <Text color="cyan">{record.id}</Text>
        {record.collectionName && (
          <>
            <Text> in </Text>
            <Text color="magenta">{record.collectionName}</Text>
          </>
        )}
      </Box>

      {/* JSON Content */}
      <Box flexDirection="column" paddingX={1}>
        <Text>{"{"}</Text>
        {entries.map(([key, value], index) => (
          <JsonLine
            key={key}
            indent={1}
            keyName={key}
            value={value}
            isLast={index === entries.length - 1}
          />
        ))}
        <Text>{"}"}</Text>
      </Box>

      {/* Footer */}
      <Box marginTop={1}>
        <Text color="gray">
          {entries.length} field{entries.length !== 1 ? "s" : ""} • 
          Esc back
        </Text>
      </Box>
    </Box>
  );
}
