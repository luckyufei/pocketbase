/**
 * OmniBar State Atoms
 * 
 * State management for the OmniBar component
 */

import { atom } from "jotai";

/**
 * OmniBar input mode
 */
export type OmnibarMode = "input" | "command" | "resource";

/**
 * Current query text in OmniBar
 */
export const omnibarQueryAtom = atom<string>("");

/**
 * Current input mode (determines what suggestions to show)
 */
export const omnibarModeAtom = atom<OmnibarMode>("input");

/**
 * Current suggestions list
 */
export const suggestionsAtom = atom<string[]>([]);

/**
 * Currently selected suggestion index (-1 = none)
 */
export const selectedSuggestionIndexAtom = atom<number>(-1);

/**
 * Detect mode from query string
 * Note: Uses raw input (not trimmed) to detect trailing spaces
 */
function detectMode(query: string): OmnibarMode {
  const trimmed = query.trim();
  
  // Check if ends with @ (starting resource selection)
  if (query.endsWith("@")) {
    return "resource";
  }
  
  // Check if we're in resource selection mode (after @)
  if (trimmed.includes("@")) {
    // Find the last @ position in original query
    const lastAtIndex = query.lastIndexOf("@");
    const afterAt = query.slice(lastAtIndex + 1);
    // If there's no space after the resource, we're in resource mode
    if (!afterAt.includes(" ")) {
      return "resource";
    }
  }
  
  // Check if starts with / (command mode)
  if (trimmed.startsWith("/")) {
    return "command";
  }
  
  return "input";
}

/**
 * Write-only atom to set query and auto-detect mode
 */
export const setQueryAtom = atom(
  null,
  (get, set, query: string) => {
    set(omnibarQueryAtom, query);
    set(omnibarModeAtom, detectMode(query));
    // Reset selection when query changes
    set(selectedSuggestionIndexAtom, -1);
  }
);

/**
 * Write-only atom to clear query and reset state
 */
export const clearQueryAtom = atom(
  null,
  (_get, set) => {
    set(omnibarQueryAtom, "");
    set(omnibarModeAtom, "input");
    set(suggestionsAtom, []);
    set(selectedSuggestionIndexAtom, -1);
  }
);

/**
 * Write-only atom to select next suggestion
 */
export const selectNextSuggestionAtom = atom(
  null,
  (get, set) => {
    const suggestions = get(suggestionsAtom);
    const current = get(selectedSuggestionIndexAtom);
    if (suggestions.length === 0) return;
    
    const next = current < suggestions.length - 1 ? current + 1 : 0;
    set(selectedSuggestionIndexAtom, next);
  }
);

/**
 * Write-only atom to select previous suggestion
 */
export const selectPrevSuggestionAtom = atom(
  null,
  (get, set) => {
    const suggestions = get(suggestionsAtom);
    const current = get(selectedSuggestionIndexAtom);
    if (suggestions.length === 0) return;
    
    const prev = current > 0 ? current - 1 : suggestions.length - 1;
    set(selectedSuggestionIndexAtom, prev);
  }
);
