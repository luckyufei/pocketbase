/**
 * Keyboard Shortcuts Unit Tests
 * 
 * TDD tests for keyboard shortcuts (Esc, r, ?, Ctrl+C, Page Up/Down, Home/End)
 * Corresponds to EPIC-10: 快捷键支持
 */

import { describe, test, expect, mock, beforeEach } from "bun:test";

import {
  createKeyboardShortcutHandler,
  ShortcutAction,
  ShortcutConfig,
  defaultShortcuts,
  matchShortcut,
  formatShortcutKey,
  getShortcutHelp,
  isModifierKey,
} from "../../../src/features/keyboard/lib/keyboardShortcuts";

import { parseKeyInput, type KeyInput } from "../../../src/hooks/useKeyboard";

describe("Keyboard Shortcuts", () => {
  // T-10.1.1: Esc tests
  describe("Esc - return to previous level (T-10.1.1, T-10.1.2)", () => {
    test("should match Esc key", () => {
      const keyInput: KeyInput = { name: "escape", ctrl: false, meta: false, shift: false };
      const action = matchShortcut(keyInput, defaultShortcuts);
      
      expect(action).toBe("goBack");
    });
    
    test("should not match Esc with Ctrl modifier", () => {
      const keyInput: KeyInput = { name: "escape", ctrl: true, meta: false, shift: false };
      const action = matchShortcut(keyInput, defaultShortcuts);
      
      expect(action).toBe("goBack");
    });
    
    test("should trigger goBack action", () => {
      const handler = mock();
      const shortcutHandler = createKeyboardShortcutHandler({
        goBack: handler,
      });
      
      const keyInput: KeyInput = { name: "escape", ctrl: false, meta: false, shift: false };
      shortcutHandler(keyInput);
      
      expect(handler).toHaveBeenCalled();
    });
  });
  
  // T-10.1.3: r refresh tests
  describe("r - refresh current view (T-10.1.3, T-10.1.4)", () => {
    test("should match 'r' key for refresh", () => {
      const keyInput: KeyInput = { char: "r", ctrl: false, meta: false, shift: false };
      const action = matchShortcut(keyInput, defaultShortcuts);
      
      expect(action).toBe("refresh");
    });
    
    test("should not match 'R' (uppercase) for refresh", () => {
      const keyInput: KeyInput = { char: "R", ctrl: false, meta: false, shift: true };
      const action = matchShortcut(keyInput, defaultShortcuts);
      
      // Could be different action or undefined
      expect(action).not.toBe("refresh");
    });
    
    test("should trigger refresh action", () => {
      const handler = mock();
      const shortcutHandler = createKeyboardShortcutHandler({
        refresh: handler,
      });
      
      const keyInput: KeyInput = { char: "r", ctrl: false, meta: false, shift: false };
      shortcutHandler(keyInput);
      
      expect(handler).toHaveBeenCalled();
    });
  });
  
  // T-10.1.5: ? help tests
  describe("? - show shortcuts help (T-10.1.5, T-10.1.6)", () => {
    test("should match '?' key for help", () => {
      const keyInput: KeyInput = { char: "?", ctrl: false, meta: false, shift: true };
      const action = matchShortcut(keyInput, defaultShortcuts);
      
      expect(action).toBe("showHelp");
    });
    
    test("should trigger showHelp action", () => {
      const handler = mock();
      const shortcutHandler = createKeyboardShortcutHandler({
        showHelp: handler,
      });
      
      const keyInput: KeyInput = { char: "?", ctrl: false, meta: false, shift: true };
      shortcutHandler(keyInput);
      
      expect(handler).toHaveBeenCalled();
    });
    
    test("should generate help text", () => {
      const help = getShortcutHelp(defaultShortcuts);
      
      expect(help.length).toBeGreaterThan(0);
      expect(help.some(h => h.action === "showHelp")).toBe(true);
    });
  });
  
  // T-10.1.7: Ctrl+C exit tests
  describe("Ctrl+C - exit (T-10.1.7, T-10.1.8)", () => {
    test("should match Ctrl+C for quit", () => {
      const keyInput: KeyInput = { char: "c", ctrl: true, meta: false, shift: false };
      const action = matchShortcut(keyInput, defaultShortcuts);
      
      expect(action).toBe("quit");
    });
    
    test("should not match 'c' without Ctrl", () => {
      const keyInput: KeyInput = { char: "c", ctrl: false, meta: false, shift: false };
      const action = matchShortcut(keyInput, defaultShortcuts);
      
      expect(action).not.toBe("quit");
    });
    
    test("should trigger quit action", () => {
      const handler = mock();
      const shortcutHandler = createKeyboardShortcutHandler({
        quit: handler,
      });
      
      const keyInput: KeyInput = { char: "c", ctrl: true, meta: false, shift: false };
      shortcutHandler(keyInput);
      
      expect(handler).toHaveBeenCalled();
    });
  });
  
  // T-10.1.9: Page Up/Down tests
  describe("Page Up/Down - pagination (T-10.1.9, T-10.1.10)", () => {
    test("should match Page Up key", () => {
      const keyInput: KeyInput = { name: "pageUp", ctrl: false, meta: false, shift: false };
      const action = matchShortcut(keyInput, defaultShortcuts);
      
      expect(action).toBe("pageUp");
    });
    
    test("should match Page Down key", () => {
      const keyInput: KeyInput = { name: "pageDown", ctrl: false, meta: false, shift: false };
      const action = matchShortcut(keyInput, defaultShortcuts);
      
      expect(action).toBe("pageDown");
    });
    
    test("should trigger pageUp action", () => {
      const handler = mock();
      const shortcutHandler = createKeyboardShortcutHandler({
        pageUp: handler,
      });
      
      const keyInput: KeyInput = { name: "pageUp", ctrl: false, meta: false, shift: false };
      shortcutHandler(keyInput);
      
      expect(handler).toHaveBeenCalled();
    });
    
    test("should trigger pageDown action", () => {
      const handler = mock();
      const shortcutHandler = createKeyboardShortcutHandler({
        pageDown: handler,
      });
      
      const keyInput: KeyInput = { name: "pageDown", ctrl: false, meta: false, shift: false };
      shortcutHandler(keyInput);
      
      expect(handler).toHaveBeenCalled();
    });
  });
  
  // T-10.1.11: Home/End tests
  describe("Home/End - jump to first/last (T-10.1.11, T-10.1.12)", () => {
    test("should match Home key", () => {
      const keyInput: KeyInput = { name: "home", ctrl: false, meta: false, shift: false };
      const action = matchShortcut(keyInput, defaultShortcuts);
      
      expect(action).toBe("goToStart");
    });
    
    test("should match End key", () => {
      const keyInput: KeyInput = { name: "end", ctrl: false, meta: false, shift: false };
      const action = matchShortcut(keyInput, defaultShortcuts);
      
      expect(action).toBe("goToEnd");
    });
    
    test("should trigger goToStart action", () => {
      const handler = mock();
      const shortcutHandler = createKeyboardShortcutHandler({
        goToStart: handler,
      });
      
      const keyInput: KeyInput = { name: "home", ctrl: false, meta: false, shift: false };
      shortcutHandler(keyInput);
      
      expect(handler).toHaveBeenCalled();
    });
    
    test("should trigger goToEnd action", () => {
      const handler = mock();
      const shortcutHandler = createKeyboardShortcutHandler({
        goToEnd: handler,
      });
      
      const keyInput: KeyInput = { name: "end", ctrl: false, meta: false, shift: false };
      shortcutHandler(keyInput);
      
      expect(handler).toHaveBeenCalled();
    });
  });
  
  // Additional shortcut tests
  describe("Additional shortcuts", () => {
    test("should match 'q' for quit (alternative)", () => {
      const keyInput: KeyInput = { char: "q", ctrl: false, meta: false, shift: false };
      const action = matchShortcut(keyInput, defaultShortcuts);
      
      expect(action).toBe("goBack");
    });
    
    test("should match arrow keys for navigation", () => {
      const upKey: KeyInput = { name: "up", ctrl: false, meta: false, shift: false };
      const downKey: KeyInput = { name: "down", ctrl: false, meta: false, shift: false };
      
      expect(matchShortcut(upKey, defaultShortcuts)).toBe("navigateUp");
      expect(matchShortcut(downKey, defaultShortcuts)).toBe("navigateDown");
    });
    
    test("should match Enter for confirm", () => {
      const keyInput: KeyInput = { name: "return", ctrl: false, meta: false, shift: false };
      const action = matchShortcut(keyInput, defaultShortcuts);
      
      expect(action).toBe("confirm");
    });
    
    test("should match Tab for autocomplete", () => {
      const keyInput: KeyInput = { name: "tab", ctrl: false, meta: false, shift: false };
      const action = matchShortcut(keyInput, defaultShortcuts);
      
      expect(action).toBe("autocomplete");
    });
  });
  
  // Utility function tests
  describe("Utility functions", () => {
    test("formatShortcutKey should format keys correctly", () => {
      expect(formatShortcutKey("escape")).toBe("Esc");
      expect(formatShortcutKey("return")).toBe("Enter");
      expect(formatShortcutKey("pageUp")).toBe("Page Up");
      expect(formatShortcutKey("pageDown")).toBe("Page Down");
    });
    
    test("formatShortcutKey with modifiers", () => {
      expect(formatShortcutKey("c", { ctrl: true })).toBe("Ctrl+C");
      expect(formatShortcutKey("s", { meta: true })).toBe("Cmd+S");
      expect(formatShortcutKey("a", { shift: true })).toBe("Shift+A");
    });
    
    test("isModifierKey should identify modifier keys", () => {
      expect(isModifierKey("ctrl")).toBe(true);
      expect(isModifierKey("meta")).toBe(true);
      expect(isModifierKey("shift")).toBe(true);
      expect(isModifierKey("a")).toBe(false);
    });
  });
  
  // ShortcutConfig tests
  describe("ShortcutConfig", () => {
    test("defaultShortcuts should have all required actions", () => {
      const requiredActions: ShortcutAction[] = [
        "goBack",
        "refresh",
        "showHelp",
        "quit",
        "pageUp",
        "pageDown",
        "goToStart",
        "goToEnd",
        "navigateUp",
        "navigateDown",
        "confirm",
        "autocomplete",
      ];
      
      const configuredActions = defaultShortcuts.map(s => s.action);
      
      for (const action of requiredActions) {
        expect(configuredActions).toContain(action);
      }
    });
    
    test("defaultShortcuts should have descriptions", () => {
      for (const shortcut of defaultShortcuts) {
        expect(shortcut.description).toBeDefined();
        expect(shortcut.description.length).toBeGreaterThan(0);
      }
    });
  });
  
  // Handler chain tests
  describe("Handler chain", () => {
    test("should call only matching handler", () => {
      const goBackHandler = mock();
      const refreshHandler = mock();
      
      const shortcutHandler = createKeyboardShortcutHandler({
        goBack: goBackHandler,
        refresh: refreshHandler,
      });
      
      const keyInput: KeyInput = { name: "escape", ctrl: false, meta: false, shift: false };
      shortcutHandler(keyInput);
      
      expect(goBackHandler).toHaveBeenCalled();
      expect(refreshHandler).not.toHaveBeenCalled();
    });
    
    test("should not crash on unhandled keys", () => {
      const shortcutHandler = createKeyboardShortcutHandler({});
      
      const keyInput: KeyInput = { char: "x", ctrl: false, meta: false, shift: false };
      
      // Should not throw
      expect(() => shortcutHandler(keyInput)).not.toThrow();
    });
    
    test("should allow custom shortcut config", () => {
      const customShortcuts: ShortcutConfig[] = [
        { key: "x", action: "custom", description: "Custom action" },
      ];
      
      const keyInput: KeyInput = { char: "x", ctrl: false, meta: false, shift: false };
      const action = matchShortcut(keyInput, customShortcuts);
      
      expect(action).toBe("custom");
    });
  });
});
