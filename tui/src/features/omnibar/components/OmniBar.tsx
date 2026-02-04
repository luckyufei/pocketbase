/**
 * OmniBar Component
 * 
 * Main input component for command entry
 */

import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { useOmnibar } from "../hooks/useOmnibar.js";
import { CommandSuggestions } from "./CommandSuggestions.js";
import { ResourceSuggestions } from "./ResourceSuggestions.js";

export interface OmniBarProps {
  onExecute?: (command: string) => void;
  placeholder?: string;
}

/**
 * OmniBar input component with autocomplete
 */
export function OmniBar({ 
  onExecute, 
  placeholder = "Type / for commands, @ for resources" 
}: OmniBarProps): React.ReactElement {
  const {
    query,
    mode,
    suggestions,
    selectedIndex,
    setQuery,
    clear,
    selectNext,
    selectPrev,
    acceptSuggestion,
    execute,
  } = useOmnibar();

  useInput((input, key) => {
    if (key.tab) {
      // Tab to accept suggestion
      acceptSuggestion();
    } else if (key.upArrow) {
      selectPrev();
    } else if (key.downArrow) {
      selectNext();
    } else if (key.escape) {
      clear();
    } else if (key.return) {
      const parsed = execute();
      if (parsed && onExecute) {
        onExecute(query);
        clear();
      }
    }
  });

  return (
    <Box flexDirection="column">
      {/* Show suggestions above input */}
      {suggestions.length > 0 && mode === "command" && (
        <CommandSuggestions 
          suggestions={suggestions} 
          selectedIndex={selectedIndex} 
        />
      )}
      {suggestions.length > 0 && mode === "resource" && (
        <ResourceSuggestions 
          suggestions={suggestions} 
          selectedIndex={selectedIndex} 
        />
      )}
      
      {/* Input line */}
      <Box>
        <Text color="cyan" bold>❯ </Text>
        <TextInput
          value={query}
          onChange={setQuery}
          placeholder={placeholder}
        />
      </Box>
    </Box>
  );
}
