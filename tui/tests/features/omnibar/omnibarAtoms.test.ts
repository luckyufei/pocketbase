/**
 * OmniBar Atoms Tests - TDD
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { createStore } from "jotai";
import {
  omnibarQueryAtom,
  omnibarModeAtom,
  suggestionsAtom,
  selectedSuggestionIndexAtom,
  setQueryAtom,
  clearQueryAtom,
  type OmnibarMode,
} from "../../../src/features/omnibar/store/omnibarAtoms.js";

describe("OmniBar Atoms", () => {
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    store = createStore();
  });

  describe("omnibarQueryAtom", () => {
    test("should have empty initial query", () => {
      expect(store.get(omnibarQueryAtom)).toBe("");
    });

    test("should allow setting query", () => {
      store.set(omnibarQueryAtom, "/view");
      expect(store.get(omnibarQueryAtom)).toBe("/view");
    });
  });

  describe("omnibarModeAtom", () => {
    test("should have initial mode as input", () => {
      expect(store.get(omnibarModeAtom)).toBe("input");
    });

    test("should allow setting to command mode", () => {
      store.set(omnibarModeAtom, "command");
      expect(store.get(omnibarModeAtom)).toBe("command");
    });

    test("should allow setting to resource mode", () => {
      store.set(omnibarModeAtom, "resource");
      expect(store.get(omnibarModeAtom)).toBe("resource");
    });
  });

  describe("suggestionsAtom", () => {
    test("should have empty initial suggestions", () => {
      expect(store.get(suggestionsAtom)).toEqual([]);
    });

    test("should allow setting suggestions", () => {
      store.set(suggestionsAtom, ["/cols", "/view", "/get"]);
      expect(store.get(suggestionsAtom)).toEqual(["/cols", "/view", "/get"]);
    });
  });

  describe("selectedSuggestionIndexAtom", () => {
    test("should have initial index as -1", () => {
      expect(store.get(selectedSuggestionIndexAtom)).toBe(-1);
    });

    test("should allow setting index", () => {
      store.set(selectedSuggestionIndexAtom, 2);
      expect(store.get(selectedSuggestionIndexAtom)).toBe(2);
    });
  });

  describe("setQueryAtom", () => {
    test("should set query and detect command mode", () => {
      store.set(setQueryAtom, "/v");
      expect(store.get(omnibarQueryAtom)).toBe("/v");
      expect(store.get(omnibarModeAtom)).toBe("command");
    });

    test("should set query and detect resource mode", () => {
      store.set(setQueryAtom, "/view @");
      expect(store.get(omnibarQueryAtom)).toBe("/view @");
      expect(store.get(omnibarModeAtom)).toBe("resource");
    });

    test("should set query as input mode for regular text", () => {
      store.set(setQueryAtom, "hello");
      expect(store.get(omnibarQueryAtom)).toBe("hello");
      expect(store.get(omnibarModeAtom)).toBe("input");
    });
  });

  describe("clearQueryAtom", () => {
    test("should clear query and reset mode", () => {
      store.set(omnibarQueryAtom, "/view @users");
      store.set(omnibarModeAtom, "resource");
      store.set(clearQueryAtom);
      expect(store.get(omnibarQueryAtom)).toBe("");
      expect(store.get(omnibarModeAtom)).toBe("input");
    });
  });
});
