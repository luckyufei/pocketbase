/**
 * useOmnibar Hook
 * 
 * Main hook for OmniBar functionality
 */

import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";
import {
  omnibarQueryAtom,
  omnibarModeAtom,
  suggestionsAtom,
  selectedSuggestionIndexAtom,
  setQueryAtom,
  clearQueryAtom,
  selectNextSuggestionAtom,
  selectPrevSuggestionAtom,
} from "../store/omnibarAtoms.js";
import { parseCommand, type ParsedCommand } from "../../../lib/parser.js";
import { findCommands, getCommand } from "../../../lib/commands.js";

export interface UseOmnibarResult {
  query: string;
  mode: "input" | "command" | "resource";
  suggestions: string[];
  selectedIndex: number;
  setQuery: (query: string) => void;
  clear: () => void;
  selectNext: () => void;
  selectPrev: () => void;
  acceptSuggestion: () => void;
  execute: () => ParsedCommand | null;
}

/**
 * Hook for OmniBar state and actions
 */
export function useOmnibar(): UseOmnibarResult {
  const query = useAtomValue(omnibarQueryAtom);
  const mode = useAtomValue(omnibarModeAtom);
  const [suggestions, setSuggestions] = useAtom(suggestionsAtom);
  const selectedIndex = useAtomValue(selectedSuggestionIndexAtom);
  
  const setQueryAction = useSetAtom(setQueryAtom);
  const clearAction = useSetAtom(clearQueryAtom);
  const selectNextAction = useSetAtom(selectNextSuggestionAtom);
  const selectPrevAction = useSetAtom(selectPrevSuggestionAtom);

  const setQuery = useCallback((newQuery: string) => {
    setQueryAction(newQuery);
    
    // Update suggestions based on mode
    if (newQuery.startsWith("/") && !newQuery.includes(" ")) {
      const matches = findCommands(newQuery);
      setSuggestions(matches.map(c => c.name));
    } else if (newQuery.includes("@") && !newQuery.endsWith(" ")) {
      // Resource suggestions would be populated by useAutocomplete
      // For now, just clear
      setSuggestions([]);
    } else {
      setSuggestions([]);
    }
  }, [setQueryAction, setSuggestions]);

  const acceptSuggestion = useCallback(() => {
    if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
      const suggestion = suggestions[selectedIndex];
      
      if (mode === "command") {
        // Replace the partial command with full command
        setQuery(suggestion + " ");
      } else if (mode === "resource") {
        // Replace partial resource with full resource
        const atIndex = query.lastIndexOf("@");
        const newQuery = query.slice(0, atIndex) + suggestion + " ";
        setQuery(newQuery);
      }
    }
  }, [selectedIndex, suggestions, mode, query, setQuery]);

  const execute = useCallback((): ParsedCommand | null => {
    if (!query.trim()) return null;
    
    const parsed = parseCommand(query);
    
    // Validate command exists
    if (parsed.command && !getCommand(parsed.command)) {
      return null;
    }
    
    return parsed;
  }, [query]);

  return {
    query,
    mode,
    suggestions,
    selectedIndex,
    setQuery,
    clear: clearAction,
    selectNext: selectNextAction,
    selectPrev: selectPrevAction,
    acceptSuggestion,
    execute,
  };
}
