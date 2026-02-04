/**
 * E2E Validation Tests - Epic 2: OmniBar Interaction
 *
 * Test scenarios:
 * - S-2.1.1: Input "/" shows command list
 * - S-2.1.2: Partial input "/v" filters commands
 * - S-2.1.3: Tab completes command
 * - S-2.1.4: Enter executes command
 * - S-2.2.1: Input "@" shows Collections
 * - S-2.2.2: Resource name filtering "@u"
 * - S-2.2.3: Tab completes resource
 * - S-2.2.4: Resource with ID "@users:id"
 * - S-2.3.1: Invalid command "/invalid"
 * - S-2.3.2: Missing arguments
 * - S-2.3.3: Non-existent resource
 * - S-2.3.4: Empty input handling
 */

import { describe, test, expect } from "bun:test";
import { parseCommand, parseResource, type ParsedCommand } from "../../src/lib/parser.js";
import { COMMANDS, getCommand, findCommands, getCommandSuggestions, type Command } from "../../src/lib/commands.js";

describe("Epic 2: OmniBar Interaction", () => {
  describe("STORY-2.1: Command Completion", () => {
    test("S-2.1.1: Input '/' triggers command mode - commands start with /", () => {
      // Verify all commands start with /
      expect(COMMANDS.length).toBeGreaterThan(0);

      for (const cmd of COMMANDS) {
        expect(cmd.name.startsWith("/")).toBe(true);
      }

      // Check parsing recognizes command prefix
      const result = parseCommand("/view @users");
      expect(result.command).toBe("/view");
    });

    test("S-2.1.2: Partial input '/v' filters commands", () => {
      // Filter commands starting with "/v"
      const filtered = findCommands("/v");

      expect(filtered.length).toBeGreaterThan(0);
      expect(filtered.some((cmd) => cmd.name === "/view")).toBe(true);
    });

    test("S-2.1.3: Tab completes command - completion data available", () => {
      // Verify command info has completion data
      const viewCmd = getCommand("/view");
      expect(viewCmd).toBeDefined();
      expect(viewCmd?.name).toBe("/view");
      expect(viewCmd?.description).toBeDefined();
      
      // Test suggestions
      const suggestions = getCommandSuggestions("/v");
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions).toContain("/view");
    });

    test("S-2.1.4: Enter executes command - parsing successful", () => {
      // Test command parsing
      const result = parseCommand("/view @posts");
      expect(result.command).toBe("/view");
      expect(result.resource).toBeDefined();
      expect(result.resource?.collection).toBe("posts");
    });
  });

  describe("STORY-2.2: Resource Selection", () => {
    test("S-2.2.1: Input '@' shows Collections - @ prefix recognized", () => {
      // Test resource reference parsing
      const result = parseCommand("/view @users");
      expect(result.resource).toBeDefined();
      expect(result.resource?.collection).toBe("users");

      // Parse the resource reference directly
      const resource = parseResource("@users");
      expect(resource).toBeDefined();
      expect(resource?.collection).toBe("users");
    });

    test("S-2.2.2: Resource name filtering '@u' - partial matching", () => {
      // This is UI behavior - test the underlying data structure
      const resource = parseResource("@u");
      // Partial resource should still be parseable
      expect(resource).toBeDefined();
      expect(resource?.collection).toBe("u");
    });

    test("S-2.2.3: Tab completes resource - resource parsing works", () => {
      // Test various resource formats
      const resources = ["@users", "@posts", "@tags", "@_superusers"];

      for (const res of resources) {
        const parsed = parseResource(res);
        expect(parsed).toBeDefined();
        expect(parsed?.collection).toBe(res.substring(1));
      }
    });

    test("S-2.2.4: Resource with ID '@users:id' - ID parsing", () => {
      // Test resource with ID
      const resourceWithId = parseResource("@users:abc123");
      expect(resourceWithId).toBeDefined();
      expect(resourceWithId?.collection).toBe("users");
      expect(resourceWithId?.id).toBe("abc123");

      // Test in command context
      const result = parseCommand("/get @users:abc123");
      expect(result.command).toBe("/get");
      expect(result.resource?.collection).toBe("users");
      expect(result.resource?.id).toBe("abc123");
    });
  });

  describe("STORY-2.3: Error Handling", () => {
    test("S-2.3.1: Invalid command '/invalid' - should not be in registry", () => {
      const invalid = getCommand("/invalid");
      expect(invalid).toBeUndefined();

      // Parse should still work but command won't be found in registry
      const result = parseCommand("/invalid");
      expect(result.command).toBe("/invalid");
    });

    test("S-2.3.2: Missing arguments - parse handles gracefully", () => {
      // Command without required argument
      const result = parseCommand("/view");
      expect(result.command).toBe("/view");
      expect(result.resource).toBeUndefined();
      // The command handler should handle missing args
    });

    test("S-2.3.3: Non-existent resource - parse still works", () => {
      const result = parseCommand("/view @nonexistent");
      expect(result.command).toBe("/view");

      const resource = parseResource("@nonexistent");
      expect(resource).toBeDefined();
      expect(resource?.collection).toBe("nonexistent");
      // API call would fail, but parsing should succeed
    });

    test("S-2.3.4: Empty input handling", () => {
      // Empty string
      const empty = parseCommand("");
      expect(empty.command).toBe("");

      // Whitespace only
      const whitespace = parseCommand("   ");
      expect(whitespace.command).toBe("");
    });
  });
});
