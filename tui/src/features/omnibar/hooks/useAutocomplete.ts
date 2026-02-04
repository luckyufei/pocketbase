/**
 * useAutocomplete Hook
 * 
 * Handles autocomplete suggestions for commands and resources
 */

import { useAtomValue, useSetAtom } from "jotai";
import { useCallback, useEffect } from "react";
import {
  omnibarQueryAtom,
  omnibarModeAtom,
  suggestionsAtom,
} from "../store/omnibarAtoms.js";
import { findCommands } from "../../../lib/commands.js";
import { pbClientAtom } from "../../../hooks/usePocketbase.js";

export interface UseAutocompleteResult {
  suggestions: string[];
  isLoading: boolean;
  refresh: () => void;
}

/**
 * Hook for autocomplete suggestions
 */
export function useAutocomplete(): UseAutocompleteResult {
  const query = useAtomValue(omnibarQueryAtom);
  const mode = useAtomValue(omnibarModeAtom);
  const setSuggestions = useSetAtom(suggestionsAtom);
  const pbClient = useAtomValue(pbClientAtom);
  const suggestions = useAtomValue(suggestionsAtom);

  // Update command suggestions
  useEffect(() => {
    if (mode === "command") {
      const commandPart = query.split(" ")[0];
      const matches = findCommands(commandPart);
      setSuggestions(matches.map(c => c.name));
    }
  }, [query, mode, setSuggestions]);

  // Fetch collection suggestions
  const fetchCollections = useCallback(async () => {
    if (mode !== "resource") return;
    
    try {
      const collections = await pbClient.collections.getFullList();
      const names = collections.map(c => `@${c.name}`);
      
      // Filter by partial input
      const atIndex = query.lastIndexOf("@");
      const partial = query.slice(atIndex + 1).toLowerCase();
      
      const filtered = names.filter(name => 
        name.toLowerCase().includes(partial)
      );
      
      setSuggestions(filtered);
    } catch {
      // Silently fail - user might not be connected
      setSuggestions([]);
    }
  }, [mode, query, pbClient, setSuggestions]);

  useEffect(() => {
    if (mode === "resource") {
      fetchCollections();
    }
  }, [mode, fetchCollections]);

  return {
    suggestions,
    isLoading: false,
    refresh: fetchCollections,
  };
}
