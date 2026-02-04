/**
 * CommandSuggestions Component
 * 
 * Displays command autocomplete suggestions
 */

import React from "react";
import { Box, Text } from "ink";

export interface CommandSuggestionsProps {
  suggestions: string[];
  selectedIndex: number;
  maxVisible?: number;
}

/**
 * Command suggestions dropdown
 */
export function CommandSuggestions({
  suggestions,
  selectedIndex,
  maxVisible = 5,
}: CommandSuggestionsProps): React.ReactElement {
  // Only show up to maxVisible suggestions
  const visible = suggestions.slice(0, maxVisible);

  return (
    <Box flexDirection="column" marginBottom={1} paddingLeft={2}>
      {visible.map((suggestion, index) => {
        const isSelected = index === selectedIndex;
        return (
          <Box key={suggestion}>
            <Text color={isSelected ? "cyan" : "gray"}>
              {isSelected ? "▸ " : "  "}
            </Text>
            <Text color={isSelected ? "cyan" : "white"} bold={isSelected}>
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
