/**
 * OmniBar Feature Index
 */

export { OmniBar, type OmniBarProps } from "./components/OmniBar.js";
export { CommandSuggestions, type CommandSuggestionsProps } from "./components/CommandSuggestions.js";
export { ResourceSuggestions, type ResourceSuggestionsProps } from "./components/ResourceSuggestions.js";

export { useOmnibar, type UseOmnibarResult } from "./hooks/useOmnibar.js";
export { useAutocomplete, type UseAutocompleteResult } from "./hooks/useAutocomplete.js";

export {
  omnibarQueryAtom,
  omnibarModeAtom,
  suggestionsAtom,
  selectedSuggestionIndexAtom,
  setQueryAtom,
  clearQueryAtom,
  selectNextSuggestionAtom,
  selectPrevSuggestionAtom,
  type OmnibarMode,
} from "./store/omnibarAtoms.js";
