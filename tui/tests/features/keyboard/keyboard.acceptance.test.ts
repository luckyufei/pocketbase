/**
 * Keyboard Shortcuts Acceptance Tests
 * 
 * End-to-end tests for keyboard shortcuts
 * Corresponds to EPIC-10: 快捷键支持
 */

import { describe, test, expect, mock, beforeEach } from "bun:test";

import {
  createKeyboardShortcutHandler,
  defaultShortcuts,
  matchShortcut,
  getShortcutHelp,
} from "../../../src/features/keyboard/lib/keyboardShortcuts";
import type { KeyInput } from "../../../src/hooks/useKeyboard";

describe("Keyboard Shortcuts Acceptance Tests", () => {
  // Esc acceptance
  describe("Esc acceptance (T-10.1.1, T-10.1.2)", () => {
    test("acceptance: Esc returns to previous level", () => {
      const goBackMock = mock();
      const handler = createKeyboardShortcutHandler({ goBack: goBackMock });
      
      const escKey: KeyInput = { name: "escape", ctrl: false, meta: false, shift: false };
      handler(escKey);
      
      expect(goBackMock).toHaveBeenCalledTimes(1);
    });
    
    test("Esc should work in any view", () => {
      // Simulate different contexts
      const contexts = ["recordsList", "logView", "monitorView"];
      
      for (const _context of contexts) {
        const goBackMock = mock();
        const handler = createKeyboardShortcutHandler({ goBack: goBackMock });
        
        const escKey: KeyInput = { name: "escape", ctrl: false, meta: false, shift: false };
        handler(escKey);
        
        expect(goBackMock).toHaveBeenCalled();
      }
    });
  });
  
  // r refresh acceptance
  describe("r refresh acceptance (T-10.1.3, T-10.1.4)", () => {
    test("acceptance: r refreshes current view", () => {
      const refreshMock = mock();
      const handler = createKeyboardShortcutHandler({ refresh: refreshMock });
      
      const rKey: KeyInput = { char: "r", ctrl: false, meta: false, shift: false };
      handler(rKey);
      
      expect(refreshMock).toHaveBeenCalledTimes(1);
    });
    
    test("r should trigger data reload", () => {
      let refreshCount = 0;
      const handler = createKeyboardShortcutHandler({
        refresh: () => { refreshCount++; },
      });
      
      // Press r multiple times
      for (let i = 0; i < 3; i++) {
        const rKey: KeyInput = { char: "r", ctrl: false, meta: false, shift: false };
        handler(rKey);
      }
      
      expect(refreshCount).toBe(3);
    });
  });
  
  // ? help acceptance
  describe("? help acceptance (T-10.1.5, T-10.1.6)", () => {
    test("acceptance: ? shows shortcuts help", () => {
      const showHelpMock = mock();
      const handler = createKeyboardShortcutHandler({ showHelp: showHelpMock });
      
      const questionKey: KeyInput = { char: "?", ctrl: false, meta: false, shift: true };
      handler(questionKey);
      
      expect(showHelpMock).toHaveBeenCalledTimes(1);
    });
    
    test("help should list all shortcuts", () => {
      const help = getShortcutHelp();
      
      // Check all documented shortcuts are present
      const actions = help.map(h => h.action);
      
      expect(actions).toContain("goBack");
      expect(actions).toContain("refresh");
      expect(actions).toContain("showHelp");
      expect(actions).toContain("quit");
      expect(actions).toContain("pageUp");
      expect(actions).toContain("pageDown");
      expect(actions).toContain("navigateUp");
      expect(actions).toContain("navigateDown");
    });
    
    test("help entries should have readable key names", () => {
      const help = getShortcutHelp();
      
      const escHelp = help.find(h => h.action === "goBack" && h.key === "Esc");
      expect(escHelp).toBeDefined();
      
      const ctrlCHelp = help.find(h => h.action === "quit");
      expect(ctrlCHelp?.key).toContain("Ctrl");
    });
  });
  
  // Ctrl+C exit acceptance
  describe("Ctrl+C exit acceptance (T-10.1.7, T-10.1.8)", () => {
    test("acceptance: Ctrl+C exits the TUI", () => {
      const quitMock = mock();
      const handler = createKeyboardShortcutHandler({ quit: quitMock });
      
      const ctrlC: KeyInput = { char: "c", ctrl: true, meta: false, shift: false };
      handler(ctrlC);
      
      expect(quitMock).toHaveBeenCalledTimes(1);
    });
    
    test("Ctrl+C should not conflict with copy", () => {
      // In TUI context, Ctrl+C is exit, not copy
      const action = matchShortcut(
        { char: "c", ctrl: true, meta: false, shift: false },
        defaultShortcuts
      );
      
      expect(action).toBe("quit");
    });
  });
  
  // Page Up/Down acceptance
  describe("Page Up/Down acceptance (T-10.1.9, T-10.1.10)", () => {
    test("acceptance: Page Up goes to previous page", () => {
      const pageUpMock = mock();
      const handler = createKeyboardShortcutHandler({ pageUp: pageUpMock });
      
      const pageUpKey: KeyInput = { name: "pageUp", ctrl: false, meta: false, shift: false };
      handler(pageUpKey);
      
      expect(pageUpMock).toHaveBeenCalledTimes(1);
    });
    
    test("acceptance: Page Down goes to next page", () => {
      const pageDownMock = mock();
      const handler = createKeyboardShortcutHandler({ pageDown: pageDownMock });
      
      const pageDownKey: KeyInput = { name: "pageDown", ctrl: false, meta: false, shift: false };
      handler(pageDownKey);
      
      expect(pageDownMock).toHaveBeenCalledTimes(1);
    });
    
    test("Page Up/Down should work in list views", () => {
      let currentPage = 5;
      
      const handler = createKeyboardShortcutHandler({
        pageUp: () => { currentPage = Math.max(1, currentPage - 1); },
        pageDown: () => { currentPage++; },
      });
      
      // Page down
      handler({ name: "pageDown", ctrl: false, meta: false, shift: false });
      expect(currentPage).toBe(6);
      
      // Page up
      handler({ name: "pageUp", ctrl: false, meta: false, shift: false });
      expect(currentPage).toBe(5);
      
      // Page up multiple times shouldn't go below 1
      for (let i = 0; i < 10; i++) {
        handler({ name: "pageUp", ctrl: false, meta: false, shift: false });
      }
      expect(currentPage).toBe(1);
    });
  });
  
  // Home/End acceptance
  describe("Home/End acceptance (T-10.1.11, T-10.1.12)", () => {
    test("acceptance: Home jumps to first item", () => {
      const goToStartMock = mock();
      const handler = createKeyboardShortcutHandler({ goToStart: goToStartMock });
      
      const homeKey: KeyInput = { name: "home", ctrl: false, meta: false, shift: false };
      handler(homeKey);
      
      expect(goToStartMock).toHaveBeenCalledTimes(1);
    });
    
    test("acceptance: End jumps to last item", () => {
      const goToEndMock = mock();
      const handler = createKeyboardShortcutHandler({ goToEnd: goToEndMock });
      
      const endKey: KeyInput = { name: "end", ctrl: false, meta: false, shift: false };
      handler(endKey);
      
      expect(goToEndMock).toHaveBeenCalledTimes(1);
    });
    
    test("Home/End should work in list navigation", () => {
      const totalItems = 100;
      let selectedIndex = 50;
      
      const handler = createKeyboardShortcutHandler({
        goToStart: () => { selectedIndex = 0; },
        goToEnd: () => { selectedIndex = totalItems - 1; },
      });
      
      // Home
      handler({ name: "home", ctrl: false, meta: false, shift: false });
      expect(selectedIndex).toBe(0);
      
      // End
      handler({ name: "end", ctrl: false, meta: false, shift: false });
      expect(selectedIndex).toBe(99);
    });
  });
  
  // Combined navigation flow
  describe("Combined navigation flow", () => {
    test("should support complete navigation workflow", () => {
      let currentView = "collections";
      let selectedIndex = 0;
      let currentPage = 1;
      
      const handler = createKeyboardShortcutHandler({
        navigateDown: () => { selectedIndex++; },
        navigateUp: () => { selectedIndex = Math.max(0, selectedIndex - 1); },
        confirm: () => { currentView = "records"; },
        goBack: () => { currentView = "collections"; },
        pageDown: () => { currentPage++; },
        pageUp: () => { currentPage = Math.max(1, currentPage - 1); },
        goToStart: () => { selectedIndex = 0; },
        goToEnd: () => { selectedIndex = 99; },
      });
      
      // Navigate to item
      handler({ name: "down", ctrl: false, meta: false, shift: false });
      handler({ name: "down", ctrl: false, meta: false, shift: false });
      expect(selectedIndex).toBe(2);
      
      // Enter records view
      handler({ name: "return", ctrl: false, meta: false, shift: false });
      expect(currentView).toBe("records");
      
      // Navigate pages
      handler({ name: "pageDown", ctrl: false, meta: false, shift: false });
      expect(currentPage).toBe(2);
      
      // Jump to end
      handler({ name: "end", ctrl: false, meta: false, shift: false });
      expect(selectedIndex).toBe(99);
      
      // Go back
      handler({ name: "escape", ctrl: false, meta: false, shift: false });
      expect(currentView).toBe("collections");
    });
  });
  
  // Shortcut conflict detection
  describe("Shortcut conflict handling", () => {
    test("should not have conflicting shortcuts for different actions", () => {
      // Build a map of key signatures to actions
      const keyToAction = new Map<string, string>();
      
      for (const shortcut of defaultShortcuts) {
        const key = shortcut.keyName || shortcut.key || "";
        if (!key) continue; // Skip shortcuts without a key
        
        const modifiers = [
          shortcut.ctrl ? "ctrl" : "",
          shortcut.meta ? "meta" : "",
          shortcut.shift ? "shift" : "",
        ].filter(Boolean).join("+");
        
        const signature = modifiers ? `${modifiers}+${key}` : key;
        
        // Each signature should map to only one action
        // (or be intentionally aliased like q -> goBack)
        if (keyToAction.has(signature)) {
          // Same signature should have same action
          expect(keyToAction.get(signature)).toBe(shortcut.action);
        } else {
          keyToAction.set(signature, shortcut.action);
        }
      }
    });
  });
});
