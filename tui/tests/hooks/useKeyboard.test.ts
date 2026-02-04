/**
 * useKeyboard Hook Tests - TDD
 */

import { describe, test, expect } from "bun:test";
import {
  parseKeyInput,
  isSpecialKey,
  type KeyInput,
  SPECIAL_KEYS,
} from "../../src/hooks/useKeyboard.js";

describe("useKeyboard", () => {
  describe("parseKeyInput", () => {
    test("should parse regular character", () => {
      const result = parseKeyInput("a", { ctrl: false, meta: false, shift: false });
      expect(result.char).toBe("a");
      expect(result.ctrl).toBe(false);
      expect(result.meta).toBe(false);
    });

    test("should parse Ctrl+C", () => {
      const result = parseKeyInput("c", { ctrl: true, meta: false, shift: false });
      expect(result.char).toBe("c");
      expect(result.ctrl).toBe(true);
    });

    test("should parse escape key", () => {
      const result = parseKeyInput("\x1b", { ctrl: false, meta: false, shift: false });
      expect(result.name).toBe("escape");
    });

    test("should parse return key", () => {
      const result = parseKeyInput("\r", { ctrl: false, meta: false, shift: false });
      expect(result.name).toBe("return");
    });

    test("should parse tab key", () => {
      const result = parseKeyInput("\t", { ctrl: false, meta: false, shift: false });
      expect(result.name).toBe("tab");
    });

    test("should parse backspace key", () => {
      const result = parseKeyInput("\x7f", { ctrl: false, meta: false, shift: false });
      expect(result.name).toBe("backspace");
    });
  });

  describe("isSpecialKey", () => {
    test("should return true for escape", () => {
      expect(isSpecialKey("escape")).toBe(true);
    });

    test("should return true for return", () => {
      expect(isSpecialKey("return")).toBe(true);
    });

    test("should return false for regular keys", () => {
      expect(isSpecialKey("a")).toBe(false);
    });
  });

  describe("SPECIAL_KEYS", () => {
    test("should contain escape key", () => {
      expect(SPECIAL_KEYS.escape).toBe("\x1b");
    });

    test("should contain return key", () => {
      expect(SPECIAL_KEYS.return).toBe("\r");
    });

    test("should contain tab key", () => {
      expect(SPECIAL_KEYS.tab).toBe("\t");
    });
  });
});
