/**
 * Schema View Component (STORY-4.3)
 * 
 * Displays collection schema with fields and API rules
 */

import React from "react";
import { Box, Text } from "ink";
import type { CollectionSchema, SchemaField, APIRules } from "../lib/collectionsApi.js";

export interface SchemaViewProps {
  schema: CollectionSchema;
}

/**
 * Get color for field type
 */
function getFieldTypeColor(type: string): string {
  switch (type) {
    case "text":
    case "editor":
      return "green";
    case "number":
      return "yellow";
    case "bool":
      return "blue";
    case "email":
    case "url":
      return "cyan";
    case "date":
      return "magenta";
    case "relation":
      return "red";
    case "file":
      return "gray";
    case "json":
      return "white";
    default:
      return "gray";
  }
}

/**
 * Format rule for display
 */
function formatRule(rule: string | null): { text: string; color: string } {
  if (rule === null) {
    return { text: "✗ Denied", color: "red" };
  }
  if (rule === "") {
    return { text: "✓ Public", color: "green" };
  }
  return { text: rule, color: "yellow" };
}

/**
 * Schema Field Row
 */
function FieldRow({ field }: { field: SchemaField }): React.ReactElement {
  return (
    <Box paddingX={1}>
      <Box width="25%">
        <Text>{field.name}</Text>
      </Box>
      <Box width="15%">
        <Text color={getFieldTypeColor(field.type)}>{field.type}</Text>
      </Box>
      <Box width="15%">
        <Text color={field.required ? "red" : "gray"}>
          {field.required ? "required" : "optional"}
        </Text>
      </Box>
      <Box width="15%">
        <Text color={field.unique ? "cyan" : "gray"}>
          {field.unique ? "unique" : "-"}
        </Text>
      </Box>
    </Box>
  );
}

/**
 * API Rules Section
 */
function RulesSection({ rules }: { rules?: APIRules }): React.ReactElement {
  if (!rules) {
    return <Text color="gray">No API rules defined</Text>;
  }

  const ruleEntries: [string, string | null][] = [
    ["List", rules.list],
    ["View", rules.view],
    ["Create", rules.create],
    ["Update", rules.update],
    ["Delete", rules.delete],
  ];

  return (
    <Box flexDirection="column">
      <Text bold color="cyan">API Rules</Text>
      <Box marginTop={1} flexDirection="column">
        {ruleEntries.map(([name, value]) => {
          const formatted = formatRule(value);
          return (
            <Box key={name} paddingX={1}>
              <Box width="15%">
                <Text>{name}</Text>
              </Box>
              <Box>
                <Text color={formatted.color}>{formatted.text}</Text>
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

/**
 * Schema View Component
 */
export function SchemaView({ schema }: SchemaViewProps): React.ReactElement {
  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold>Collection: </Text>
        <Text color="cyan">{schema.name}</Text>
        <Text> (</Text>
        <Text color="magenta">{schema.type}</Text>
        <Text>)</Text>
      </Box>

      {/* Fields Header */}
      <Box borderStyle="single" borderBottom paddingX={1}>
        <Box width="25%">
          <Text bold color="cyan">Field</Text>
        </Box>
        <Box width="15%">
          <Text bold color="cyan">Type</Text>
        </Box>
        <Box width="15%">
          <Text bold color="cyan">Required</Text>
        </Box>
        <Box width="15%">
          <Text bold color="cyan">Unique</Text>
        </Box>
      </Box>

      {/* Fields */}
      {schema.fields.length === 0 ? (
        <Box paddingX={1}>
          <Text color="gray">No custom fields defined</Text>
        </Box>
      ) : (
        schema.fields.map((field) => (
          <FieldRow key={field.name} field={field} />
        ))
      )}

      {/* API Rules */}
      <Box marginTop={2}>
        <RulesSection rules={schema.rules} />
      </Box>

      {/* Footer */}
      <Box marginTop={1}>
        <Text color="gray">
          {schema.fields.length} field{schema.fields.length !== 1 ? "s" : ""} • 
          Esc back
        </Text>
      </Box>
    </Box>
  );
}
