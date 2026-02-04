/**
 * Commands Registry Tests - TDD
 */

import { describe, test, expect } from "bun:test";
import {
  COMMANDS,
  getCommand,
  findCommands,
  type Command,
  type CommandArg,
} from "../../src/lib/commands.js";

describe("Commands Registry", () => {
  describe("COMMANDS", () => {
    test("should contain /cols command", () => {
      const cmd = COMMANDS.find((c) => c.name === "/cols");
      expect(cmd).toBeDefined();
      expect(cmd!.description).toContain("collection");
    });

    test("should contain /view command with @col argument", () => {
      const cmd = COMMANDS.find((c) => c.name === "/view");
      expect(cmd).toBeDefined();
      expect(cmd!.args).toBeDefined();
      expect(cmd!.args!.some((a) => a.name === "collection")).toBe(true);
    });

    test("should contain /get command", () => {
      const cmd = COMMANDS.find((c) => c.name === "/get");
      expect(cmd).toBeDefined();
    });

    test("should contain /schema command", () => {
      const cmd = COMMANDS.find((c) => c.name === "/schema");
      expect(cmd).toBeDefined();
    });

    test("should contain /logs command", () => {
      const cmd = COMMANDS.find((c) => c.name === "/logs");
      expect(cmd).toBeDefined();
    });

    test("should contain /monitor command", () => {
      const cmd = COMMANDS.find((c) => c.name === "/monitor");
      expect(cmd).toBeDefined();
    });

    test("should contain /help command", () => {
      const cmd = COMMANDS.find((c) => c.name === "/help");
      expect(cmd).toBeDefined();
    });

    test("should contain /quit command with /q alias", () => {
      const cmd = COMMANDS.find((c) => c.name === "/quit");
      expect(cmd).toBeDefined();
      expect(cmd!.aliases).toContain("/q");
    });

    test("should contain /clear command", () => {
      const cmd = COMMANDS.find((c) => c.name === "/clear");
      expect(cmd).toBeDefined();
    });

    test("should contain /health command", () => {
      const cmd = COMMANDS.find((c) => c.name === "/health");
      expect(cmd).toBeDefined();
    });
  });

  describe("getCommand", () => {
    test("should find command by name", () => {
      const cmd = getCommand("/cols");
      expect(cmd).toBeDefined();
      expect(cmd!.name).toBe("/cols");
    });

    test("should find command by alias", () => {
      const cmd = getCommand("/q");
      expect(cmd).toBeDefined();
      expect(cmd!.name).toBe("/quit");
    });

    test("should return undefined for unknown command", () => {
      const cmd = getCommand("/unknown");
      expect(cmd).toBeUndefined();
    });

    test("should be case insensitive", () => {
      const cmd = getCommand("/COLS");
      expect(cmd).toBeDefined();
      expect(cmd!.name).toBe("/cols");
    });
  });

  describe("findCommands", () => {
    test("should find commands by prefix", () => {
      const results = findCommands("/c");
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((c) => c.name === "/cols")).toBe(true);
      expect(results.some((c) => c.name === "/clear")).toBe(true);
    });

    test("should return all commands for / prefix", () => {
      const results = findCommands("/");
      expect(results.length).toBe(COMMANDS.length);
    });

    test("should return empty array for no match", () => {
      const results = findCommands("/xyz");
      expect(results).toEqual([]);
    });

    test("should be case insensitive", () => {
      const results = findCommands("/V");
      expect(results.some((c) => c.name === "/view")).toBe(true);
    });
  });
});
