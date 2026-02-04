/**
 * Keyboard Shortcuts Library
 * 
 * Keyboard shortcut configuration and handling
 * Corresponds to EPIC-10: 快捷键支持
 */

import type { KeyInput } from "../../../hooks/useKeyboard";

/**
 * Available shortcut actions
 */
export type ShortcutAction =
  | "goBack"
  | "refresh"
  | "showHelp"
  | "quit"
  | "pageUp"
  | "pageDown"
  | "goToStart"
  | "goToEnd"
  | "navigateUp"
  | "navigateDown"
  | "navigateLeft"
  | "navigateRight"
  | "confirm"
  | "autocomplete"
  | "custom"
  | string;

/**
 * Shortcut configuration
 */
export interface ShortcutConfig {
  key?: string; // The key char (for regular keys like 'r', 'q')
  keyName?: string; // Special key name (escape, return, etc.)
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  action: ShortcutAction;
  description: string;
}

/**
 * Default keyboard shortcuts
 */
export const defaultShortcuts: ShortcutConfig[] = [
  // Navigation
  { keyName: "escape", action: "goBack", description: "Return to previous level" },
  { key: "q", action: "goBack", description: "Return to main view" },
  { keyName: "up", action: "navigateUp", description: "Navigate up" },
  { keyName: "down", action: "navigateDown", description: "Navigate down" },
  { keyName: "left", action: "navigateLeft", description: "Navigate left" },
  { keyName: "right", action: "navigateRight", description: "Navigate right" },
  { keyName: "return", action: "confirm", description: "Confirm selection" },
  { keyName: "tab", action: "autocomplete", description: "Autocomplete" },
  
  // Actions
  { key: "r", action: "refresh", description: "Refresh current view" },
  { key: "?", shift: true, action: "showHelp", description: "Show keyboard shortcuts help" },
  { key: "c", ctrl: true, action: "quit", description: "Exit the TUI" },
  
  // Pagination
  { keyName: "pageUp", action: "pageUp", description: "Previous page" },
  { keyName: "pageDown", action: "pageDown", description: "Next page" },
  { keyName: "home", action: "goToStart", description: "Jump to first item" },
  { keyName: "end", action: "goToEnd", description: "Jump to last item" },
];

/**
 * Match key input against shortcut config
 */
export function matchShortcut(
  keyInput: KeyInput,
  shortcuts: ShortcutConfig[]
): ShortcutAction | undefined {
  for (const shortcut of shortcuts) {
    // Check key name match (for special keys like escape, return, etc.)
    if (shortcut.keyName && keyInput.name === shortcut.keyName) {
      // Check modifiers if specified
      if (shortcut.ctrl !== undefined && shortcut.ctrl !== keyInput.ctrl) continue;
      if (shortcut.meta !== undefined && shortcut.meta !== keyInput.meta) continue;
      if (shortcut.shift !== undefined && shortcut.shift !== keyInput.shift) continue;
      return shortcut.action;
    }
    
    // Check char match (for regular keys)
    if (shortcut.key && !shortcut.keyName) {
      const charMatch = keyInput.char === shortcut.key;
      if (!charMatch) continue;
      
      // Check modifiers
      if (shortcut.ctrl !== undefined && shortcut.ctrl !== keyInput.ctrl) continue;
      if (shortcut.meta !== undefined && shortcut.meta !== keyInput.meta) continue;
      // Don't check shift for chars like '?' which inherently require shift
      if (shortcut.shift !== undefined && shortcut.key !== "?" && shortcut.shift !== keyInput.shift) continue;
      
      // For Ctrl+key combinations, ctrl must be true
      if (shortcut.ctrl === true && !keyInput.ctrl) continue;
      
      return shortcut.action;
    }
  }
  
  return undefined;
}

/**
 * Shortcut handler map
 */
export type ShortcutHandlers = Partial<Record<ShortcutAction, () => void>>;

/**
 * Create keyboard shortcut handler
 */
export function createKeyboardShortcutHandler(
  handlers: ShortcutHandlers,
  shortcuts: ShortcutConfig[] = defaultShortcuts
): (keyInput: KeyInput) => void {
  return (keyInput: KeyInput) => {
    const action = matchShortcut(keyInput, shortcuts);
    
    if (action && handlers[action]) {
      handlers[action]!();
    }
  };
}

/**
 * Format key name for display
 */
export function formatShortcutKey(
  key: string,
  modifiers?: { ctrl?: boolean; meta?: boolean; shift?: boolean }
): string {
  const parts: string[] = [];
  
  if (modifiers?.ctrl) parts.push("Ctrl");
  if (modifiers?.meta) parts.push("Cmd");
  if (modifiers?.shift) parts.push("Shift");
  
  // Format special key names
  const keyDisplay = formatKeyName(key);
  parts.push(keyDisplay);
  
  return parts.join("+");
}

/**
 * Format special key name for display
 */
function formatKeyName(key: string): string {
  const keyMap: Record<string, string> = {
    escape: "Esc",
    return: "Enter",
    tab: "Tab",
    backspace: "Backspace",
    delete: "Delete",
    up: "↑",
    down: "↓",
    left: "←",
    right: "→",
    pageUp: "Page Up",
    pageDown: "Page Down",
    home: "Home",
    end: "End",
  };
  
  return keyMap[key] || key.toUpperCase();
}

/**
 * Get shortcut help information
 */
export interface ShortcutHelp {
  key: string;
  action: ShortcutAction;
  description: string;
}

export function getShortcutHelp(shortcuts: ShortcutConfig[] = defaultShortcuts): ShortcutHelp[] {
  return shortcuts.map((shortcut) => {
    const keyDisplay = shortcut.keyName
      ? formatShortcutKey(shortcut.keyName, { ctrl: shortcut.ctrl, meta: shortcut.meta, shift: shortcut.shift })
      : formatShortcutKey(shortcut.key || "", { ctrl: shortcut.ctrl, meta: shortcut.meta, shift: shortcut.shift });
    
    return {
      key: keyDisplay,
      action: shortcut.action,
      description: shortcut.description,
    };
  });
}

/**
 * Check if a key is a modifier key
 */
export function isModifierKey(key: string): boolean {
  return ["ctrl", "meta", "shift", "alt"].includes(key.toLowerCase());
}
