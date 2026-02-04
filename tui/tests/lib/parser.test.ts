/**
 * Command Parser Tests - TDD
 */

import { describe, test, expect } from "bun:test";
import {
  parseCommand,
  parseResource,
  parseArgs,
  type ParsedCommand,
  type ParsedResource,
} from "../../src/lib/parser.js";

describe("Command Parser", () => {
  describe("parseCommand", () => {
    test("should parse simple command", () => {
      const result = parseCommand("/cols");
      expect(result.command).toBe("/cols");
      expect(result.resource).toBeUndefined();
      expect(result.args).toEqual({});
    });

    test("should parse command with resource", () => {
      const result = parseCommand("/view @users");
      expect(result.command).toBe("/view");
      expect(result.resource).toBeDefined();
      expect(result.resource!.collection).toBe("users");
    });

    test("should parse command with resource and ID", () => {
      const result = parseCommand("/get @users:abc123");
      expect(result.command).toBe("/get");
      expect(result.resource!.collection).toBe("users");
      expect(result.resource!.id).toBe("abc123");
    });

    test("should parse command with filter argument", () => {
      const result = parseCommand('/view @users filter="verified=true"');
      expect(result.command).toBe("/view");
      expect(result.resource!.collection).toBe("users");
      expect(result.args.filter).toBe("verified=true");
    });

    test("should parse command with multiple arguments", () => {
      const result = parseCommand('/view @posts filter="published=true" sort="created" page=2');
      expect(result.command).toBe("/view");
      expect(result.args.filter).toBe("published=true");
      expect(result.args.sort).toBe("created");
      expect(result.args.page).toBe("2");
    });

    test("should parse command with single quotes", () => {
      const result = parseCommand("/view @users filter='verified=true'");
      expect(result.args.filter).toBe("verified=true");
    });

    test("should handle empty input", () => {
      const result = parseCommand("");
      expect(result.command).toBe("");
      expect(result.resource).toBeUndefined();
    });

    test("should handle whitespace only", () => {
      const result = parseCommand("   ");
      expect(result.command).toBe("");
    });

    test("should trim whitespace", () => {
      const result = parseCommand("  /cols  ");
      expect(result.command).toBe("/cols");
    });
  });

  describe("parseResource", () => {
    test("should parse collection only", () => {
      const result = parseResource("@users");
      expect(result).toBeDefined();
      expect(result!.collection).toBe("users");
      expect(result!.id).toBeUndefined();
    });

    test("should parse collection with ID", () => {
      const result = parseResource("@users:abc123");
      expect(result!.collection).toBe("users");
      expect(result!.id).toBe("abc123");
    });

    test("should return undefined for invalid resource", () => {
      const result = parseResource("users");
      expect(result).toBeUndefined();
    });

    test("should handle empty string", () => {
      const result = parseResource("");
      expect(result).toBeUndefined();
    });

    test("should handle @ only", () => {
      const result = parseResource("@");
      expect(result).toBeUndefined();
    });
  });

  describe("parseArgs", () => {
    test("should parse key=value pairs", () => {
      const result = parseArgs('filter="test" page=1');
      expect(result.filter).toBe("test");
      expect(result.page).toBe("1");
    });

    test("should parse quoted values with spaces", () => {
      const result = parseArgs('filter="name = \'John\'"');
      expect(result.filter).toBe("name = 'John'");
    });

    test("should handle empty string", () => {
      const result = parseArgs("");
      expect(result).toEqual({});
    });

    test("should handle value without quotes", () => {
      const result = parseArgs("page=10 perPage=20");
      expect(result.page).toBe("10");
      expect(result.perPage).toBe("20");
    });
  });
});
