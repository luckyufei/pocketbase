/**
 * ResourceSuggestions Component
 * 
 * Displays collection/resource autocomplete suggestions
 */

import React from "react";
import { Box, Text } from "ink";

export interface ResourceSuggestionsProps {
  suggestions: string[];
  selectedIndex: number;
  maxVisible?: number;
}

/**
 * Resource suggestions dropdown
 */
export function ResourceSuggestions({
  suggestions,
  selectedIndex,
  maxVisible = 5,
}: ResourceSuggestionsProps): React.ReactElement {
  // Only show up to maxVisible suggestions
  const visible = suggestions.slice(0, maxVisible);

  return (
    <Box flexDirection="column" marginBottom={1} paddingLeft={2}>
      <Text color="gray" dimColor>Collections:</Text>
      {visible.map((suggestion, index) => {
        const isSelected = index === selectedIndex;
        return (
          <Box key={suggestion}>
            <Text color={isSelected ? "green" : "gray"}>
              {isSelected ? "▸ " : "  "}
            </Text>
            <Text color={isSelected ? "green" : "white"} bold={isSelected}>
              {suggestion}
            </Text>
          </Box>
        );
      })}
      {suggestions.length > maxVisible && (
        <Box>
          <Text color="gray" dimColor>
            {"  "}...and {suggestions.length - maxVisible} more
          </Text>
        </Box>
      )}
    </Box>
  );
}
