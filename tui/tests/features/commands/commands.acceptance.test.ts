/**
 * Commands Acceptance Tests
 * 
 * End-to-end tests for general commands (/quit, /help, /clear, /health)
 * Corresponds to EPIC-9: 通用命令
 */

import { describe, test, expect, mock, beforeEach } from "bun:test";

import {
  executeQuitCommand,
  executeHelpCommand,
  executeClearCommand,
  executeHealthCommand,
} from "../../../src/features/commands/lib/commandsApi";
import { parseCommand } from "../../../src/lib/parser";
import { getCommand, COMMANDS } from "../../../src/lib/commands";

describe("Commands Acceptance Tests", () => {
  // /quit command acceptance
  describe("/quit command acceptance", () => {
    test("should parse /quit command correctly", () => {
      const parsed = parseCommand("/quit");
      
      expect(parsed.command).toBe("/quit");
      expect(parsed.raw).toBe("/quit");
    });
    
    test("should parse /q alias correctly", () => {
      const parsed = parseCommand("/q");
      
      // /q should be recognized as a valid command (alias for /quit)
      expect(parsed.command).toBe("/q");
    });
    
    test("should find /quit via alias /q", () => {
      const command = getCommand("/q");
      
      expect(command).toBeDefined();
      expect(command?.name).toBe("/quit");
    });
    
    test("should execute /quit and return exit signal", () => {
      const result = executeQuitCommand();
      
      expect(result.shouldQuit).toBe(true);
    });
    
    test("acceptance: /quit triggers application exit", () => {
      // Integration test for quit flow
      const parsed = parseCommand("/quit");
      expect(parsed.command).toBe("/quit");
      
      const result = executeQuitCommand();
      expect(result.type).toBe("quit");
      expect(result.shouldQuit).toBe(true);
      expect(result.message).toBeDefined();
    });
  });
  
  // /help command acceptance
  describe("/help command acceptance", () => {
    test("should parse /help command correctly", () => {
      const parsed = parseCommand("/help");
      
      expect(parsed.command).toBe("/help");
      expect(parsed.raw).toBe("/help");
    });
    
    test("should parse /help with argument", () => {
      const parsed = parseCommand("/help view");
      
      expect(parsed.command).toBe("/help");
      // "view" is not key=value format, so it's not in args
      // We need to handle positional arguments differently
      expect(parsed.raw).toBe("/help view");
    });
    
    test("should list all commands when no argument", () => {
      const result = executeHelpCommand();
      
      expect(result.commands.length).toBe(COMMANDS.length);
    });
    
    test("should show specific command details", () => {
      const result = executeHelpCommand("view");
      
      expect(result.specificCommand).toBeDefined();
      expect(result.specificCommand?.name).toBe("/view");
      expect(result.specificCommand?.description).toBeDefined();
      expect(result.specificCommand?.args).toBeDefined();
      expect(result.specificCommand?.examples).toBeDefined();
    });
    
    test("acceptance: /help displays command list", () => {
      const parsed = parseCommand("/help");
      expect(parsed.command).toBe("/help");
      
      const result = executeHelpCommand();
      expect(result.type).toBe("help");
      expect(result.commands.length).toBeGreaterThan(0);
      
      // All expected commands should be present
      const names = result.commands.map(c => c.name);
      expect(names).toContain("/cols");
      expect(names).toContain("/view");
      expect(names).toContain("/get");
      expect(names).toContain("/schema");
      expect(names).toContain("/logs");
      expect(names).toContain("/monitor");
      expect(names).toContain("/health");
      expect(names).toContain("/clear");
      expect(names).toContain("/help");
      expect(names).toContain("/quit");
    });
    
    test("acceptance: /help [command] displays command details", () => {
      const parsed = parseCommand("/help view");
      expect(parsed.command).toBe("/help");
      
      // Extract positional argument from raw
      const cmdArg = parsed.raw.replace("/help ", "").trim();
      const result = executeHelpCommand(cmdArg);
      expect(result.type).toBe("help");
      expect(result.specificCommand?.name).toBe("/view");
    });
  });
  
  // /clear command acceptance
  describe("/clear command acceptance", () => {
    test("should parse /clear command correctly", () => {
      const parsed = parseCommand("/clear");
      
      expect(parsed.command).toBe("/clear");
      expect(parsed.raw).toBe("/clear");
    });
    
    test("should return ANSI clear sequence", () => {
      const result = executeClearCommand();
      
      expect(result.clearSequence).toBeDefined();
      expect(result.clearSequence.length).toBeGreaterThan(0);
    });
    
    test("acceptance: /clear clears the screen", () => {
      const parsed = parseCommand("/clear");
      expect(parsed.command).toBe("/clear");
      
      const result = executeClearCommand();
      expect(result.type).toBe("clear");
      expect(result.shouldClear).toBe(true);
      
      // Verify ANSI escape codes
      expect(result.clearSequence).toContain("\x1b[2J");
      expect(result.clearSequence).toContain("\x1b[H");
    });
  });
  
  // /health command acceptance
  describe("/health command acceptance", () => {
    test("should parse /health command correctly", () => {
      const parsed = parseCommand("/health");
      
      expect(parsed.command).toBe("/health");
      expect(parsed.raw).toBe("/health");
    });
    
    test("should check healthy server", async () => {
      const mockPb = {
        baseUrl: "http://127.0.0.1:8090",
        health: {
          check: mock(() => Promise.resolve({ code: 200, message: "ok" })),
        },
      };
      
      const result = await executeHealthCommand(mockPb as any);
      
      expect(result.healthy).toBe(true);
      expect(result.code).toBe(200);
    });
    
    test("should handle server down", async () => {
      const mockPb = {
        baseUrl: "http://127.0.0.1:8090",
        health: {
          check: mock(() => Promise.reject(new Error("Connection refused"))),
        },
      };
      
      const result = await executeHealthCommand(mockPb as any);
      
      expect(result.healthy).toBe(false);
      expect(result.error).toBeDefined();
    });
    
    test("acceptance: /health shows server status", async () => {
      const parsed = parseCommand("/health");
      expect(parsed.command).toBe("/health");
      
      const mockPb = {
        baseUrl: "http://127.0.0.1:8090",
        health: {
          check: mock(() => Promise.resolve({ code: 200, message: "ok" })),
        },
      };
      
      const result = await executeHealthCommand(mockPb as any);
      expect(result.type).toBe("health");
      expect(result.healthy).toBe(true);
      expect(result.serverUrl).toBe("http://127.0.0.1:8090");
      expect(result.responseTime).toBeDefined();
    });
  });
  
  // Integration flow tests
  describe("Command integration flow", () => {
    test("full flow: parse -> find -> execute /quit", () => {
      // 1. Parse command
      const parsed = parseCommand("/quit");
      expect(parsed.command).toBe("/quit");
      
      // 2. Find command definition
      const cmd = getCommand(parsed.command);
      expect(cmd?.name).toBe("/quit");
      
      // 3. Execute command
      const result = executeQuitCommand();
      expect(result.shouldQuit).toBe(true);
    });
    
    test("full flow: parse -> find -> execute /help view", () => {
      // 1. Parse command
      const parsed = parseCommand("/help view");
      expect(parsed.command).toBe("/help");
      
      // 2. Find command definition
      const cmd = getCommand(parsed.command);
      expect(cmd?.name).toBe("/help");
      
      // 3. Execute command with extracted argument
      const cmdArg = parsed.raw.replace("/help ", "").trim();
      const result = executeHelpCommand(cmdArg);
      expect(result.specificCommand?.name).toBe("/view");
    });
    
    test("full flow: parse -> find -> execute /clear", () => {
      // 1. Parse command
      const parsed = parseCommand("/clear");
      expect(parsed.command).toBe("/clear");
      
      // 2. Find command definition
      const cmd = getCommand(parsed.command);
      expect(cmd?.name).toBe("/clear");
      
      // 3. Execute command
      const result = executeClearCommand();
      expect(result.shouldClear).toBe(true);
    });
    
    test("full flow: parse -> find -> execute /health", async () => {
      // 1. Parse command
      const parsed = parseCommand("/health");
      expect(parsed.command).toBe("/health");
      
      // 2. Find command definition
      const cmd = getCommand(parsed.command);
      expect(cmd?.name).toBe("/health");
      
      // 3. Execute command
      const mockPb = {
        baseUrl: "http://test:8090",
        health: {
          check: mock(() => Promise.resolve({ code: 200, message: "ok" })),
        },
      };
      
      const result = await executeHealthCommand(mockPb as any);
      expect(result.healthy).toBe(true);
    });
  });
  
  // Error handling tests
  describe("Command error handling", () => {
    test("should handle unknown command in /help", () => {
      const result = executeHelpCommand("unknowncmd");
      
      expect(result.error).toBeDefined();
      expect(result.error).toContain("unknown");
    });
    
    test("should handle network error in /health", async () => {
      const mockPb = {
        baseUrl: "http://unreachable:8090",
        health: {
          check: mock(() => Promise.reject(new Error("ECONNREFUSED"))),
        },
      };
      
      const result = await executeHealthCommand(mockPb as any);
      
      expect(result.healthy).toBe(false);
      expect(result.error).toContain("ECONNREFUSED");
    });
  });
});
