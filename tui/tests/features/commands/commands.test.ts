/**
 * Commands Unit Tests
 * 
 * TDD tests for general commands (/quit, /help, /clear, /health)
 * Corresponds to EPIC-9: 通用命令
 */

import { describe, test, expect, mock, beforeEach } from "bun:test";

// Import will be created after tests
import {
  executeQuitCommand,
  executeHelpCommand,
  executeClearCommand,
  executeHealthCommand,
  CommandResult,
  QuitResult,
  HelpResult,
  ClearResult,
  HealthResult,
} from "../../../src/features/commands/lib/commandsApi";

describe("Commands API", () => {
  // T-9.1.1: /quit command tests
  describe("/quit command (T-9.1.1, T-9.1.2)", () => {
    test("should return quit result with shouldQuit=true", () => {
      const result = executeQuitCommand();
      
      expect(result.type).toBe("quit");
      expect(result.shouldQuit).toBe(true);
    });
    
    test("should include confirmation message", () => {
      const result = executeQuitCommand();
      
      expect(result.message).toBeDefined();
      expect(result.message.toLowerCase()).toContain("exit");
    });
    
    test("should work with /q alias behavior", () => {
      // /q is handled by command parser, executeQuitCommand is the same
      const result = executeQuitCommand();
      
      expect(result.shouldQuit).toBe(true);
    });
  });
  
  // T-9.1.3: /help command tests
  describe("/help command (T-9.1.3, T-9.1.4)", () => {
    test("should return all commands when no argument provided", () => {
      const result = executeHelpCommand();
      
      expect(result.type).toBe("help");
      expect(result.commands).toBeDefined();
      expect(result.commands.length).toBeGreaterThan(0);
    });
    
    test("should include command names in output", () => {
      const result = executeHelpCommand();
      
      const commandNames = result.commands.map((c) => c.name);
      expect(commandNames).toContain("/cols");
      expect(commandNames).toContain("/view");
      expect(commandNames).toContain("/quit");
    });
    
    test("should include command descriptions", () => {
      const result = executeHelpCommand();
      
      const colsCmd = result.commands.find((c) => c.name === "/cols");
      expect(colsCmd?.description).toBeDefined();
      expect(colsCmd?.description.length).toBeGreaterThan(0);
    });
    
    test("should return specific command help when command name provided", () => {
      const result = executeHelpCommand("view");
      
      expect(result.type).toBe("help");
      expect(result.specificCommand).toBeDefined();
      expect(result.specificCommand?.name).toBe("/view");
    });
    
    test("should handle /help view without slash", () => {
      const result = executeHelpCommand("view");
      
      expect(result.specificCommand?.name).toBe("/view");
    });
    
    test("should handle /help /view with slash", () => {
      const result = executeHelpCommand("/view");
      
      expect(result.specificCommand?.name).toBe("/view");
    });
    
    test("should include arguments for specific command", () => {
      const result = executeHelpCommand("view");
      
      expect(result.specificCommand?.args).toBeDefined();
      expect(result.specificCommand?.args?.length).toBeGreaterThan(0);
    });
    
    test("should include examples for specific command", () => {
      const result = executeHelpCommand("view");
      
      expect(result.specificCommand?.examples).toBeDefined();
      expect(result.specificCommand?.examples?.length).toBeGreaterThan(0);
    });
    
    test("should return error for unknown command", () => {
      const result = executeHelpCommand("unknowncmd");
      
      expect(result.error).toBeDefined();
      expect(result.error).toContain("unknown");
    });
    
    test("should handle quit alias /q", () => {
      const result = executeHelpCommand("q");
      
      expect(result.specificCommand?.name).toBe("/quit");
    });
  });
  
  // T-9.1.5: /clear command tests
  describe("/clear command (T-9.1.5, T-9.1.6)", () => {
    test("should return clear result with shouldClear=true", () => {
      const result = executeClearCommand();
      
      expect(result.type).toBe("clear");
      expect(result.shouldClear).toBe(true);
    });
    
    test("should include ANSI escape sequence for clearing", () => {
      const result = executeClearCommand();
      
      // Standard ANSI clear screen and move cursor to home
      expect(result.clearSequence).toBeDefined();
      expect(result.clearSequence).toContain("\x1b[2J"); // Clear screen
      expect(result.clearSequence).toContain("\x1b[H"); // Move cursor to home
    });
  });
  
  // T-9.1.7: /health command tests
  describe("/health command (T-9.1.7, T-9.1.8)", () => {
    test("should check server health successfully", async () => {
      const mockPb = {
        health: {
          check: mock(() => Promise.resolve({ code: 200, message: "ok" })),
        },
      };
      
      const result = await executeHealthCommand(mockPb as any);
      
      expect(result.type).toBe("health");
      expect(result.healthy).toBe(true);
    });
    
    test("should return server version info", async () => {
      const mockPb = {
        health: {
          check: mock(() => Promise.resolve({ code: 200, message: "ok" })),
        },
      };
      
      const result = await executeHealthCommand(mockPb as any);
      
      expect(result.code).toBe(200);
      expect(result.message).toBe("ok");
    });
    
    test("should handle server unhealthy response", async () => {
      const mockPb = {
        health: {
          check: mock(() => Promise.resolve({ code: 503, message: "unhealthy" })),
        },
      };
      
      const result = await executeHealthCommand(mockPb as any);
      
      expect(result.healthy).toBe(false);
      expect(result.code).toBe(503);
    });
    
    test("should handle network error", async () => {
      const mockPb = {
        health: {
          check: mock(() => Promise.reject(new Error("Network error"))),
        },
      };
      
      const result = await executeHealthCommand(mockPb as any);
      
      expect(result.healthy).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain("Network");
    });
    
    test("should measure response time", async () => {
      const mockPb = {
        health: {
          check: mock(() => Promise.resolve({ code: 200, message: "ok" })),
        },
      };
      
      const result = await executeHealthCommand(mockPb as any);
      
      expect(result.responseTime).toBeDefined();
      expect(result.responseTime).toBeGreaterThanOrEqual(0);
    });
    
    test("should handle timeout", async () => {
      const mockPb = {
        health: {
          check: mock(() => new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Timeout")), 100)
          )),
        },
      };
      
      const result = await executeHealthCommand(mockPb as any);
      
      expect(result.healthy).toBe(false);
      expect(result.error).toContain("Timeout");
    });
    
    test("should include server URL in result", async () => {
      const mockPb = {
        baseUrl: "http://127.0.0.1:8090",
        health: {
          check: mock(() => Promise.resolve({ code: 200, message: "ok" })),
        },
      };
      
      const result = await executeHealthCommand(mockPb as any);
      
      expect(result.serverUrl).toBe("http://127.0.0.1:8090");
    });
  });
  
  // Combined command result type tests
  describe("CommandResult types", () => {
    test("QuitResult should have correct structure", () => {
      const result = executeQuitCommand();
      
      expect(result).toHaveProperty("type", "quit");
      expect(result).toHaveProperty("shouldQuit");
      expect(result).toHaveProperty("message");
    });
    
    test("HelpResult should have correct structure", () => {
      const result = executeHelpCommand();
      
      expect(result).toHaveProperty("type", "help");
      expect(result).toHaveProperty("commands");
    });
    
    test("ClearResult should have correct structure", () => {
      const result = executeClearCommand();
      
      expect(result).toHaveProperty("type", "clear");
      expect(result).toHaveProperty("shouldClear");
      expect(result).toHaveProperty("clearSequence");
    });
    
    test("HealthResult should have correct structure", async () => {
      const mockPb = {
        baseUrl: "http://test:8090",
        health: {
          check: mock(() => Promise.resolve({ code: 200, message: "ok" })),
        },
      };
      
      const result = await executeHealthCommand(mockPb as any);
      
      expect(result).toHaveProperty("type", "health");
      expect(result).toHaveProperty("healthy");
      expect(result).toHaveProperty("responseTime");
    });
  });
});

describe("Command Execution Integration", () => {
  // Test command dispatcher pattern
  describe("Command dispatcher", () => {
    test("should route /quit to quit handler", () => {
      const result = executeQuitCommand();
      expect(result.type).toBe("quit");
    });
    
    test("should route /help to help handler", () => {
      const result = executeHelpCommand();
      expect(result.type).toBe("help");
    });
    
    test("should route /clear to clear handler", () => {
      const result = executeClearCommand();
      expect(result.type).toBe("clear");
    });
  });
});
