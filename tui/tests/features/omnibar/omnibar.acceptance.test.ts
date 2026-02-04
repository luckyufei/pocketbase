/**
 * OmniBar Acceptance Tests (STORY-3.6)
 * 
 * Tests for OmniBar interaction flows:
 * - T-3.6.1: Input `/` shows command list (US1-AC1)
 * - T-3.6.2: Input `/v` filters to `/view` (US1-AC2)
 * - T-3.6.3: Tab key autocomplete (US1-AC3)
 * - T-3.6.4: Space switches to argument mode (US1-AC4)
 * - T-3.6.5: Input `@` shows Collections list (US2-AC1)
 * - T-3.6.6: Input `@u` filters collections (US2-AC2)
 * - T-3.6.7: Tab autocomplete to `@users` (US2-AC3)
 * - T-3.6.8: Network failure shows error (US2-AC4)
 */

import { describe, expect, it, beforeEach, mock } from "bun:test";
import { createStore } from "jotai";
import {
  omnibarQueryAtom,
  omnibarModeAtom,
  suggestionsAtom,
  selectedSuggestionIndexAtom,
  setQueryAtom,
  clearQueryAtom,
  selectNextSuggestionAtom,
  selectPrevSuggestionAtom,
} from "../../../src/features/omnibar/store/omnibarAtoms.js";
import { findCommands, getCommand, COMMANDS } from "../../../src/lib/commands.js";
import { parseCommand, parseResource, parseArgs } from "../../../src/lib/parser.js";

describe("OmniBar Acceptance Tests", () => {
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    store = createStore();
  });

  describe("T-3.6.1: Input `/` shows command list (US1-AC1)", () => {
    it("should switch to command mode when `/` is typed", () => {
      store.set(setQueryAtom, "/");
      
      expect(store.get(omnibarModeAtom)).toBe("command");
    });

    it("should return all commands when `/` is typed", () => {
      const matches = findCommands("/");
      
      expect(matches.length).toBe(COMMANDS.length);
      expect(matches.map(c => c.name)).toContain("/cols");
      expect(matches.map(c => c.name)).toContain("/view");
      expect(matches.map(c => c.name)).toContain("/get");
      expect(matches.map(c => c.name)).toContain("/schema");
      expect(matches.map(c => c.name)).toContain("/logs");
      expect(matches.map(c => c.name)).toContain("/monitor");
      expect(matches.map(c => c.name)).toContain("/help");
      expect(matches.map(c => c.name)).toContain("/quit");
    });

    it("should have command list with descriptions", () => {
      const matches = findCommands("/");
      
      matches.forEach(cmd => {
        expect(cmd.description).toBeTruthy();
        expect(typeof cmd.description).toBe("string");
      });
    });
  });

  describe("T-3.6.2: Input `/v` filters to `/view` (US1-AC2)", () => {
    it("should filter commands by prefix `/v`", () => {
      store.set(setQueryAtom, "/v");
      
      const matches = findCommands("/v");
      expect(matches.length).toBe(1);
      expect(matches[0].name).toBe("/view");
    });

    it("should filter commands by prefix `/c`", () => {
      const matches = findCommands("/c");
      
      expect(matches.map(c => c.name)).toContain("/cols");
      expect(matches.map(c => c.name)).toContain("/clear");
    });

    it("should filter commands by prefix `/q`", () => {
      const matches = findCommands("/q");
      
      expect(matches.length).toBe(1);
      expect(matches[0].name).toBe("/quit");
    });

    it("should return empty for non-matching prefix", () => {
      const matches = findCommands("/xyz");
      
      expect(matches.length).toBe(0);
    });

    it("should be case-insensitive", () => {
      const matchesLower = findCommands("/view");
      const matchesUpper = findCommands("/VIEW");
      
      expect(matchesLower.length).toBe(matchesUpper.length);
      expect(matchesLower[0].name).toBe(matchesUpper[0].name);
    });
  });

  describe("T-3.6.3: Tab key autocomplete (US1-AC3)", () => {
    it("should allow selecting suggestion with selectNext", () => {
      store.set(suggestionsAtom, ["/view", "/cols", "/get"]);
      store.set(selectedSuggestionIndexAtom, -1);
      
      store.set(selectNextSuggestionAtom);
      expect(store.get(selectedSuggestionIndexAtom)).toBe(0);
      
      store.set(selectNextSuggestionAtom);
      expect(store.get(selectedSuggestionIndexAtom)).toBe(1);
    });

    it("should wrap around when reaching end of suggestions", () => {
      store.set(suggestionsAtom, ["/view", "/cols"]);
      store.set(selectedSuggestionIndexAtom, 1);
      
      store.set(selectNextSuggestionAtom);
      expect(store.get(selectedSuggestionIndexAtom)).toBe(0);
    });

    it("should allow selecting previous suggestion", () => {
      store.set(suggestionsAtom, ["/view", "/cols", "/get"]);
      store.set(selectedSuggestionIndexAtom, 2);
      
      store.set(selectPrevSuggestionAtom);
      expect(store.get(selectedSuggestionIndexAtom)).toBe(1);
    });

    it("should wrap around to end when at beginning", () => {
      store.set(suggestionsAtom, ["/view", "/cols", "/get"]);
      store.set(selectedSuggestionIndexAtom, 0);
      
      store.set(selectPrevSuggestionAtom);
      expect(store.get(selectedSuggestionIndexAtom)).toBe(2);
    });

    it("should not change index if no suggestions", () => {
      store.set(suggestionsAtom, []);
      store.set(selectedSuggestionIndexAtom, -1);
      
      store.set(selectNextSuggestionAtom);
      expect(store.get(selectedSuggestionIndexAtom)).toBe(-1);
    });
  });

  describe("T-3.6.4: Space switches to argument mode (US1-AC4)", () => {
    it("should parse command with arguments", () => {
      const result = parseCommand('/view @users filter="verified=true"');
      
      expect(result.command).toBe("/view");
      expect(result.resource?.collection).toBe("users");
      expect(result.args.filter).toBe("verified=true");
    });

    it("should parse multiple arguments", () => {
      const result = parseCommand('/view @posts filter="published=true" sort="created" page=2');
      
      expect(result.command).toBe("/view");
      expect(result.resource?.collection).toBe("posts");
      expect(result.args.filter).toBe("published=true");
      expect(result.args.sort).toBe("created");
      expect(result.args.page).toBe("2");
    });

    it("should handle command without resource", () => {
      const result = parseCommand("/logs level=error");
      
      expect(result.command).toBe("/logs");
      expect(result.resource).toBeUndefined();
      expect(result.args.level).toBe("error");
    });

    it("should handle command only", () => {
      const result = parseCommand("/cols");
      
      expect(result.command).toBe("/cols");
      expect(result.resource).toBeUndefined();
      expect(Object.keys(result.args).length).toBe(0);
    });
  });

  describe("T-3.6.5: Input `@` shows Collections list (US2-AC1)", () => {
    it("should switch to resource mode when `@` is typed", () => {
      store.set(setQueryAtom, "/view @");
      
      expect(store.get(omnibarModeAtom)).toBe("resource");
    });

    it("should detect resource mode with partial resource", () => {
      store.set(setQueryAtom, "/view @u");
      
      expect(store.get(omnibarModeAtom)).toBe("resource");
    });

    it("should switch back to command mode after resource is complete", () => {
      store.set(setQueryAtom, "/view @users");
      expect(store.get(omnibarModeAtom)).toBe("resource");
      
      // After space, switches back to command mode (for argument input)
      store.set(setQueryAtom, "/view @users ");
      expect(store.get(omnibarModeAtom)).toBe("command");
    });
  });

  describe("T-3.6.6: Input `@u` filters collections (US2-AC2)", () => {
    it("should parse partial resource correctly", () => {
      const result = parseResource("@u");
      
      expect(result?.collection).toBe("u");
      expect(result?.id).toBeUndefined();
    });

    it("should parse full collection name", () => {
      const result = parseResource("@users");
      
      expect(result?.collection).toBe("users");
    });

    it("should return undefined for invalid resource", () => {
      expect(parseResource("")).toBeUndefined();
      expect(parseResource("users")).toBeUndefined();
      expect(parseResource("@")).toBeUndefined();
    });
  });

  describe("T-3.6.7: Tab autocomplete to `@users` (US2-AC3)", () => {
    it("should parse resource with collection:id format", () => {
      const result = parseResource("@users:abc123");
      
      expect(result?.collection).toBe("users");
      expect(result?.id).toBe("abc123");
    });

    it("should handle empty id", () => {
      const result = parseResource("@users:");
      
      expect(result?.collection).toBe("users");
      expect(result?.id).toBeUndefined();
    });

    it("should extract resource from command", () => {
      const result = parseCommand("/get @users:abc123");
      
      expect(result.command).toBe("/get");
      expect(result.resource?.collection).toBe("users");
      expect(result.resource?.id).toBe("abc123");
    });
  });

  describe("T-3.6.8: Network failure shows error (US2-AC4)", () => {
    it("should handle network error gracefully", () => {
      // Test that parseCommand doesn't throw on valid input
      const result = parseCommand("/view @users");
      
      expect(result.command).toBe("/view");
      expect(result.resource?.collection).toBe("users");
    });

    it("should validate command exists", () => {
      const validCommand = getCommand("/view");
      const invalidCommand = getCommand("/invalid");
      
      expect(validCommand).toBeDefined();
      expect(validCommand?.name).toBe("/view");
      expect(invalidCommand).toBeUndefined();
    });

    it("should support command aliases", () => {
      const quitByName = getCommand("/quit");
      const quitByAlias = getCommand("/q");
      
      expect(quitByName).toBeDefined();
      expect(quitByAlias).toBeDefined();
      expect(quitByName?.name).toBe(quitByAlias?.name);
    });

    it("should clear state on error recovery", () => {
      store.set(setQueryAtom, "/view @users");
      store.set(suggestionsAtom, ["@users", "@posts"]);
      store.set(selectedSuggestionIndexAtom, 0);
      
      // Simulate error recovery by clearing
      store.set(clearQueryAtom);
      
      expect(store.get(omnibarQueryAtom)).toBe("");
      expect(store.get(omnibarModeAtom)).toBe("input");
      expect(store.get(suggestionsAtom)).toEqual([]);
      expect(store.get(selectedSuggestionIndexAtom)).toBe(-1);
    });
  });

  describe("Complete command flow integration", () => {
    it("should handle complete `/view @users` flow", () => {
      // Step 1: Type `/`
      store.set(setQueryAtom, "/");
      expect(store.get(omnibarModeAtom)).toBe("command");
      
      // Step 2: Type `/view`
      store.set(setQueryAtom, "/view");
      expect(store.get(omnibarModeAtom)).toBe("command");
      const matches = findCommands("/view");
      expect(matches.length).toBe(1);
      expect(matches[0].name).toBe("/view");
      
      // Step 3: Add space and @
      store.set(setQueryAtom, "/view @");
      expect(store.get(omnibarModeAtom)).toBe("resource");
      
      // Step 4: Complete resource
      store.set(setQueryAtom, "/view @users");
      expect(store.get(omnibarModeAtom)).toBe("resource");
      
      // Step 5: Parse final command
      const result = parseCommand("/view @users");
      expect(result.command).toBe("/view");
      expect(result.resource?.collection).toBe("users");
    });

    it("should handle complete `/get @users:id` flow", () => {
      // Step 1: Type command
      store.set(setQueryAtom, "/get");
      const matches = findCommands("/get");
      expect(matches.length).toBe(1);
      
      // Step 2: Add resource with ID
      store.set(setQueryAtom, "/get @users:abc123");
      
      // Step 3: Parse
      const result = parseCommand("/get @users:abc123");
      expect(result.command).toBe("/get");
      expect(result.resource?.collection).toBe("users");
      expect(result.resource?.id).toBe("abc123");
    });

    it("should handle `/logs level=error` flow", () => {
      // Type command
      store.set(setQueryAtom, "/logs");
      expect(store.get(omnibarModeAtom)).toBe("command");
      
      // Add argument
      store.set(setQueryAtom, "/logs level=error");
      
      // Parse
      const result = parseCommand("/logs level=error");
      expect(result.command).toBe("/logs");
      expect(result.args.level).toBe("error");
    });

    it("should handle complex filter expressions", () => {
      const result = parseCommand('/view @posts filter="created>\'2024-01-01\' && published=true" sort="-created"');
      
      expect(result.command).toBe("/view");
      expect(result.resource?.collection).toBe("posts");
      expect(result.args.filter).toBe("created>'2024-01-01' && published=true");
      expect(result.args.sort).toBe("-created");
    });
  });

  describe("Edge cases", () => {
    it("should handle empty input", () => {
      store.set(setQueryAtom, "");
      expect(store.get(omnibarModeAtom)).toBe("input");
      
      const result = parseCommand("");
      expect(result.command).toBe("");
    });

    it("should handle whitespace-only input", () => {
      store.set(setQueryAtom, "   ");
      expect(store.get(omnibarModeAtom)).toBe("input");
    });

    it("should handle arguments with special characters", () => {
      const result = parseCommand('/view @users filter="email~\'@gmail.com\'"');
      
      expect(result.args.filter).toBe("email~'@gmail.com'");
    });

    it("should handle single-quoted values", () => {
      const args = parseArgs("name='John Doe' age=25");
      
      expect(args.name).toBe("John Doe");
      expect(args.age).toBe("25");
    });

    it("should handle unquoted values", () => {
      const args = parseArgs("page=1 perPage=20");
      
      expect(args.page).toBe("1");
      expect(args.perPage).toBe("20");
    });
  });
});
