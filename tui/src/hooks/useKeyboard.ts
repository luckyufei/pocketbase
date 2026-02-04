/**
 * useKeyboard Hook
 * 
 * Keyboard event handling utilities
 */

import { useInput } from "ink";
import { useCallback } from "react";

/**
 * Special key codes
 */
export const SPECIAL_KEYS = {
  escape: "\x1b",
  return: "\r",
  tab: "\t",
  backspace: "\x7f",
  delete: "\x1b[3~",
  up: "\x1b[A",
  down: "\x1b[B",
  left: "\x1b[D",
  right: "\x1b[C",
  pageUp: "\x1b[5~",
  pageDown: "\x1b[6~",
  home: "\x1b[H",
  end: "\x1b[F",
} as const;

/**
 * Key input with modifiers
 */
export interface KeyInput {
  char?: string;
  name?: string;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
}

/**
 * Key modifiers from Ink
 */
interface KeyModifiers {
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
}

/**
 * Parse raw key input into KeyInput structure
 */
export function parseKeyInput(input: string, modifiers: KeyModifiers): KeyInput {
  const result: KeyInput = {
    ctrl: modifiers.ctrl,
    meta: modifiers.meta,
    shift: modifiers.shift,
  };

  // Map special keys
  switch (input) {
    case SPECIAL_KEYS.escape:
      result.name = "escape";
      break;
    case SPECIAL_KEYS.return:
      result.name = "return";
      break;
    case SPECIAL_KEYS.tab:
      result.name = "tab";
      break;
    case SPECIAL_KEYS.backspace:
      result.name = "backspace";
      break;
    case SPECIAL_KEYS.up:
      result.name = "up";
      break;
    case SPECIAL_KEYS.down:
      result.name = "down";
      break;
    case SPECIAL_KEYS.left:
      result.name = "left";
      break;
    case SPECIAL_KEYS.right:
      result.name = "right";
      break;
    case SPECIAL_KEYS.pageUp:
      result.name = "pageUp";
      break;
    case SPECIAL_KEYS.pageDown:
      result.name = "pageDown";
      break;
    default:
      result.char = input;
  }

  return result;
}

/**
 * Check if a key name is a special key
 */
export function isSpecialKey(name: string): boolean {
  const specialNames = [
    "escape", "return", "tab", "backspace", "delete",
    "up", "down", "left", "right",
    "pageUp", "pageDown", "home", "end",
  ];
  return specialNames.includes(name);
}

/**
 * Keyboard handler type
 */
export type KeyboardHandler = (key: KeyInput) => void;

/**
 * Hook to handle keyboard input
 */
export function useKeyboard(handler: KeyboardHandler): void {
  useInput((input, key) => {
    const keyInput = parseKeyInput(input, {
      ctrl: key.ctrl,
      meta: key.meta,
      shift: key.shift,
    });

    // Handle special keys from Ink
    if (key.escape) keyInput.name = "escape";
    if (key.return) keyInput.name = "return";
    if (key.tab) keyInput.name = "tab";
    if (key.backspace) keyInput.name = "backspace";
    if (key.delete) keyInput.name = "delete";
    if (key.upArrow) keyInput.name = "up";
    if (key.downArrow) keyInput.name = "down";
    if (key.leftArrow) keyInput.name = "left";
    if (key.rightArrow) keyInput.name = "right";
    if (key.pageUp) keyInput.name = "pageUp";
    if (key.pageDown) keyInput.name = "pageDown";

    handler(keyInput);
  });
}
