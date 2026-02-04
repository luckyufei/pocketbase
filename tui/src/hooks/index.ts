/**
 * Hooks Index
 * 
 * Export all global hooks
 */

export {
  usePocketbase,
  usePocketbaseUrl,
  pbClientAtom,
  pbUrlAtom,
  pbTokenAtom,
} from "./usePocketbase.js";

export {
  useKeyboard,
  parseKeyInput,
  isSpecialKey,
  SPECIAL_KEYS,
  type KeyInput,
  type KeyboardHandler,
} from "./useKeyboard.js";
