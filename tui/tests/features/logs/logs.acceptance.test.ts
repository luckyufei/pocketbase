/**
 * Logs Acceptance Tests (STORY-6.4)
 *
 * TDD: 🔴 Red Phase
 * Tests for:
 * - T-6.4.1: /logs 切换到日志视图 (US7-AC1)
 * - T-6.4.2: 新日志自动滚动 (US7-AC2)
 * - T-6.4.3: level=error 只显示错误日志 (US7-AC3)
 * - T-6.4.4: q 或 Esc 返回主界面 (US7-AC4)
 */

import { describe, expect, it, beforeEach, mock } from "bun:test";
import { createStore } from "jotai";
import {
  logsAtom,
  logsLevelFilterAtom,
  isLogsLoadingAtom,
  logsErrorAtom,
  setLogsAtom,
  addLogAtom,
  setLevelFilterAtom,
  setLoadingAtom,
  clearLogsAtom,
  type LogEntry,
  type LogLevel,
} from "../../../src/features/logs/store/logsAtoms.js";
import {
  fetchLogs,
  filterLogsByLevel,
} from "../../../src/features/logs/lib/logsApi.js";
import { parseCommand } from "../../../src/lib/parser.js";
import { getCommand } from "../../../src/lib/commands.js";

// Mock PocketBase - now uses pb.send() for /api/logs
const mockLogs: LogEntry[] = [
  { id: "1", timestamp: "2024-01-01T00:00:00Z", level: "info", message: "Server started" },
  { id: "2", timestamp: "2024-01-01T00:00:01Z", level: "error", message: "Database error" },
  { id: "3", timestamp: "2024-01-01T00:00:02Z", level: "warn", message: "High memory" },
  { id: "4", timestamp: "2024-01-01T00:00:03Z", level: "debug", message: "Request received" },
  { id: "5", timestamp: "2024-01-01T00:00:04Z", level: "error", message: "Connection timeout" },
];

// Map string level to numeric level for mock
const levelMap: Record<string, number> = {
  debug: 0,
  info: 0,
  warn: 4,
  error: 8,
};

const createMockPBClient = (logs: LogEntry[] = []) => ({
  send: mock((path: string) => {
    if (path.startsWith("/api/logs")) {
      return Promise.resolve({
        items: logs.map((log) => ({
          id: log.id,
          created: log.timestamp,
          level: levelMap[log.level] ?? 0,
          message: log.message,
          data: log.data || {},
        })),
        page: 1,
        perPage: 50,
        totalItems: logs.length,
        totalPages: 1,
      });
    }
    return Promise.reject(new Error("Unknown path"));
  }),
});

describe("Logs Acceptance Tests (STORY-6.4)", () => {
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    store = createStore();
  });

  describe("US7-AC1: /logs 切换到日志视图 (T-6.4.1)", () => {
    it("should recognize /logs as a valid command", () => {
      const parsed = parseCommand("/logs");

      expect(parsed.command).toBe("/logs");
    });

    it("should have /logs command registered", () => {
      const cmd = getCommand("/logs");

      expect(cmd).toBeDefined();
      expect(cmd?.name).toBe("/logs");
    });

    it("should parse /logs with level parameter", () => {
      const parsed = parseCommand("/logs level=error");

      expect(parsed.command).toBe("/logs");
      expect(parsed.args.level).toBe("error");
    });

    it("should fetch and display logs when /logs is executed", async () => {
      const pb = createMockPBClient(mockLogs);

      // Simulate command execution
      const result = await fetchLogs(pb as any, {});
      store.set(setLogsAtom, result.logs);

      const logs = store.get(logsAtom);
      expect(logs.length).toBe(5);
      expect(logs[0].message).toBe("Server started");
    });

    it("should show loading state during fetch", async () => {
      const pb = createMockPBClient(mockLogs);

      store.set(setLoadingAtom, true);
      expect(store.get(isLogsLoadingAtom)).toBe(true);

      const result = await fetchLogs(pb as any, {});
      store.set(setLogsAtom, result.logs);
      store.set(setLoadingAtom, false);

      expect(store.get(isLogsLoadingAtom)).toBe(false);
    });
  });

  describe("US7-AC2: 新日志自动滚动 (T-6.4.2)", () => {
    it("should support adding new log entries", () => {
      store.set(setLogsAtom, mockLogs.slice(0, 3));
      expect(store.get(logsAtom).length).toBe(3);

      const newLog: LogEntry = {
        id: "6",
        timestamp: "2024-01-01T00:00:05Z",
        level: "info",
        message: "New entry",
      };

      store.set(addLogAtom, newLog);

      const logs = store.get(logsAtom);
      expect(logs.length).toBe(4);
      expect(logs[logs.length - 1].message).toBe("New entry");
    });

    it("should maintain log order (newest last)", () => {
      store.set(setLogsAtom, []);

      const log1: LogEntry = { id: "1", timestamp: "2024-01-01T00:00:01Z", level: "info", message: "First" };
      const log2: LogEntry = { id: "2", timestamp: "2024-01-01T00:00:02Z", level: "info", message: "Second" };
      const log3: LogEntry = { id: "3", timestamp: "2024-01-01T00:00:03Z", level: "info", message: "Third" };

      store.set(addLogAtom, log1);
      store.set(addLogAtom, log2);
      store.set(addLogAtom, log3);

      const logs = store.get(logsAtom);
      expect(logs[0].message).toBe("First");
      expect(logs[1].message).toBe("Second");
      expect(logs[2].message).toBe("Third");
    });

    it("should append logs to existing list", () => {
      store.set(setLogsAtom, mockLogs);
      const initialCount = store.get(logsAtom).length;

      store.set(addLogAtom, {
        id: "new-1",
        timestamp: "2024-01-01T00:00:10Z",
        level: "warn",
        message: "New warning",
      });

      expect(store.get(logsAtom).length).toBe(initialCount + 1);
    });
  });

  describe("US7-AC3: level=error 只显示错误日志 (T-6.4.3)", () => {
    it("should parse level parameter from /logs command", () => {
      const parsed = parseCommand("/logs level=error");

      expect(parsed.args.level).toBe("error");
    });

    it("should filter logs by error level", () => {
      store.set(setLogsAtom, mockLogs);
      store.set(setLevelFilterAtom, "error");

      const allLogs = store.get(logsAtom);
      const filter = store.get(logsLevelFilterAtom);
      const filtered = filterLogsByLevel(allLogs, filter);

      expect(filtered.length).toBe(2);
      expect(filtered.every((l) => l.level === "error")).toBe(true);
    });

    it("should filter logs by warn level", () => {
      store.set(setLogsAtom, mockLogs);
      store.set(setLevelFilterAtom, "warn");

      const allLogs = store.get(logsAtom);
      const filter = store.get(logsLevelFilterAtom);
      const filtered = filterLogsByLevel(allLogs, filter);

      expect(filtered.length).toBe(1);
      expect(filtered[0].level).toBe("warn");
    });

    it("should filter logs by info level", () => {
      store.set(setLogsAtom, mockLogs);
      store.set(setLevelFilterAtom, "info");

      const allLogs = store.get(logsAtom);
      const filter = store.get(logsLevelFilterAtom);
      const filtered = filterLogsByLevel(allLogs, filter);

      expect(filtered.length).toBe(1);
      expect(filtered[0].level).toBe("info");
    });

    it("should filter logs by debug level", () => {
      store.set(setLogsAtom, mockLogs);
      store.set(setLevelFilterAtom, "debug");

      const allLogs = store.get(logsAtom);
      const filter = store.get(logsLevelFilterAtom);
      const filtered = filterLogsByLevel(allLogs, filter);

      expect(filtered.length).toBe(1);
      expect(filtered[0].level).toBe("debug");
    });

    it("should show all logs when filter is cleared", () => {
      store.set(setLogsAtom, mockLogs);
      store.set(setLevelFilterAtom, "error");
      store.set(setLevelFilterAtom, null);

      const allLogs = store.get(logsAtom);
      const filter = store.get(logsLevelFilterAtom);
      const filtered = filterLogsByLevel(allLogs, filter);

      expect(filtered.length).toBe(mockLogs.length);
    });

    it("should support all log levels for filtering", () => {
      store.set(setLogsAtom, mockLogs);

      const levels: LogLevel[] = ["debug", "info", "warn", "error"];

      for (const level of levels) {
        store.set(setLevelFilterAtom, level);
        const filter = store.get(logsLevelFilterAtom);
        expect(filter).toBe(level);
      }
    });
  });

  describe("US7-AC4: q 或 Esc 返回主界面 (T-6.4.4)", () => {
    it("should clear logs state when exiting view", () => {
      store.set(setLogsAtom, mockLogs);
      store.set(setLevelFilterAtom, "error");
      store.set(setLoadingAtom, true);

      // Simulate exit with clear
      store.set(clearLogsAtom);

      expect(store.get(logsAtom)).toEqual([]);
      expect(store.get(logsLevelFilterAtom)).toBeNull();
      expect(store.get(isLogsLoadingAtom)).toBe(false);
    });

    it("should preserve logs state if not explicitly cleared", () => {
      store.set(setLogsAtom, mockLogs);

      // Logs should still be there
      expect(store.get(logsAtom).length).toBe(5);
    });
  });

  describe("Error Handling", () => {
    it("should handle empty logs gracefully", async () => {
      const pb = createMockPBClient([]);

      const result = await fetchLogs(pb as any, {});
      store.set(setLogsAtom, result.logs);

      expect(store.get(logsAtom)).toEqual([]);
    });

    it("should handle fetch error", async () => {
      const pb = {
        send: mock(() => Promise.reject(new Error("Network error"))),
      };

      try {
        await fetchLogs(pb as any, {});
      } catch (error) {
        store.set(logsErrorAtom, (error as Error).message);
      }

      expect(store.get(logsErrorAtom)).toBe("Network error");
    });
  });

  describe("Logs Display", () => {
    it("should display log with timestamp", () => {
      const log: LogEntry = {
        id: "1",
        timestamp: "2024-01-01T12:34:56Z",
        level: "info",
        message: "Test message",
      };

      store.set(setLogsAtom, [log]);

      const logs = store.get(logsAtom);
      expect(logs[0].timestamp).toBe("2024-01-01T12:34:56Z");
    });

    it("should display log with level", () => {
      const log: LogEntry = {
        id: "1",
        timestamp: "2024-01-01T00:00:00Z",
        level: "error",
        message: "Error message",
      };

      store.set(setLogsAtom, [log]);

      const logs = store.get(logsAtom);
      expect(logs[0].level).toBe("error");
    });

    it("should display log with message", () => {
      const log: LogEntry = {
        id: "1",
        timestamp: "2024-01-01T00:00:00Z",
        level: "info",
        message: "This is the message",
      };

      store.set(setLogsAtom, [log]);

      const logs = store.get(logsAtom);
      expect(logs[0].message).toBe("This is the message");
    });

    it("should display log with optional data", () => {
      const log: LogEntry = {
        id: "1",
        timestamp: "2024-01-01T00:00:00Z",
        level: "info",
        message: "Test",
        data: { key: "value", count: 42 },
      };

      store.set(setLogsAtom, [log]);

      const logs = store.get(logsAtom);
      expect(logs[0].data).toEqual({ key: "value", count: 42 });
    });
  });
});
