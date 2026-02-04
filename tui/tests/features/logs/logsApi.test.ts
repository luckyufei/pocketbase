/**
 * Logs API Tests (STORY-6.2)
 *
 * TDD: 🔴 Red Phase
 * Tests for:
 * - T-6.2.1: fetchLogs (获取日志列表)
 * - T-6.2.2: Logs API integration
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
  setErrorAtom,
  clearLogsAtom,
  type LogEntry,
  type LogLevel,
} from "../../../src/features/logs/store/logsAtoms.js";
import {
  fetchLogs,
  transformLogEntry,
  filterLogsByLevel,
  type FetchLogsOptions,
  type FetchLogsResult,
} from "../../../src/features/logs/lib/logsApi.js";

// Mock PocketBase client - now uses pb.send() for /api/logs
const createMockPBClient = (logs: any[] = []) => ({
  send: mock((path: string) => {
    if (path.startsWith("/api/logs")) {
      return Promise.resolve({
        items: logs,
        page: 1,
        perPage: 50,
        totalItems: logs.length,
        totalPages: 1,
      });
    }
    return Promise.reject(new Error("Unknown path"));
  }),
});

// Sample mock logs data - using numeric levels as PocketBase does
const mockRawLogs = [
  {
    id: "log1",
    created: "2024-01-01T00:00:00Z",
    level: 0, // info
    message: "Server started",
    data: { port: 8090 },
  },
  {
    id: "log2",
    created: "2024-01-01T00:00:01Z",
    level: 8, // error
    message: "Database connection failed",
    data: { error: "timeout" },
  },
  {
    id: "log3",
    created: "2024-01-01T00:00:02Z",
    level: 4, // warn
    message: "High memory usage",
    data: { usage: "95%" },
  },
  {
    id: "log4",
    created: "2024-01-01T00:00:03Z",
    level: 0, // info/debug
    message: "Request received",
    data: { path: "/api/users" },
  },
];

describe("Logs API", () => {
  describe("fetchLogs (T-6.2.1)", () => {
    it("should fetch logs from PocketBase /api/logs endpoint", async () => {
      const pb = createMockPBClient(mockRawLogs);

      const result = await fetchLogs(pb as any, {});

      expect(result.logs.length).toBe(4);
      expect(pb.send).toHaveBeenCalled();
      // Check that the first argument starts with /api/logs
      const callArgs = (pb.send as any).mock.calls[0];
      expect(callArgs[0]).toMatch(/^\/api\/logs/);
    });

    it("should transform raw logs to LogEntry format", async () => {
      const pb = createMockPBClient(mockRawLogs);

      const result = await fetchLogs(pb as any, {});

      expect(result.logs[0]).toHaveProperty("id");
      expect(result.logs[0]).toHaveProperty("timestamp");
      expect(result.logs[0]).toHaveProperty("level");
      expect(result.logs[0]).toHaveProperty("message");
    });

    it("should include data field in log entry", async () => {
      const pb = createMockPBClient(mockRawLogs);

      const result = await fetchLogs(pb as any, {});

      expect(result.logs[0].data).toEqual({ port: 8090 });
    });

    it("should support pagination options", async () => {
      const sendMock = mock((path: string) =>
        Promise.resolve({
          items: mockRawLogs,
          page: 2,
          perPage: 10,
          totalItems: mockRawLogs.length,
          totalPages: 1,
        })
      );
      const pb = { send: sendMock };

      await fetchLogs(pb as any, { page: 2, perPage: 10 });

      // Check that query params include page and perPage
      const callArgs = sendMock.mock.calls[0];
      expect(callArgs[0]).toContain("page=2");
      expect(callArgs[0]).toContain("perPage=10");
    });

    it("should handle empty logs", async () => {
      const pb = createMockPBClient([]);

      const result = await fetchLogs(pb as any, {});

      expect(result.logs).toEqual([]);
      expect(result.totalItems).toBe(0);
    });

    it("should handle network errors", async () => {
      const pb = {
        send: mock(() => Promise.reject(new Error("Network error"))),
      };

      await expect(fetchLogs(pb as any, {})).rejects.toThrow("Network error");
    });
  });

  describe("transformLogEntry", () => {
    it("should transform raw log to LogEntry with string level", () => {
      const raw = {
        id: "log1",
        created: "2024-01-01T00:00:00Z",
        level: "info",
        message: "Test message",
        data: { key: "value" },
      };

      const result = transformLogEntry(raw);

      expect(result.id).toBe("log1");
      expect(result.timestamp).toBe("2024-01-01T00:00:00Z");
      expect(result.level).toBe("info");
      expect(result.message).toBe("Test message");
      expect(result.data).toEqual({ key: "value" });
    });

    it("should map numeric level 0 to info", () => {
      const raw = {
        id: "log1",
        created: "2024-01-01T00:00:00Z",
        level: 0,
        message: "Info message",
      };

      const result = transformLogEntry(raw);

      expect(result.level).toBe("info");
    });

    it("should map numeric level 4 to warn", () => {
      const raw = {
        id: "log1",
        created: "2024-01-01T00:00:00Z",
        level: 4,
        message: "Warning message",
      };

      const result = transformLogEntry(raw);

      expect(result.level).toBe("warn");
    });

    it("should map numeric level 8 to error", () => {
      const raw = {
        id: "log1",
        created: "2024-01-01T00:00:00Z",
        level: 8,
        message: "Error message",
      };

      const result = transformLogEntry(raw);

      expect(result.level).toBe("error");
    });

    it("should handle missing data field", () => {
      const raw = {
        id: "log1",
        created: "2024-01-01T00:00:00Z",
        level: 8,
        message: "Error occurred",
      };

      const result = transformLogEntry(raw);

      expect(result.data).toBeUndefined();
    });
  });

  describe("filterLogsByLevel", () => {
    const logs: LogEntry[] = [
      { id: "1", timestamp: "", level: "info", message: "Info" },
      { id: "2", timestamp: "", level: "error", message: "Error" },
      { id: "3", timestamp: "", level: "warn", message: "Warning" },
      { id: "4", timestamp: "", level: "debug", message: "Debug" },
      { id: "5", timestamp: "", level: "error", message: "Another Error" },
    ];

    it("should return all logs when filter is null", () => {
      const result = filterLogsByLevel(logs, null);
      expect(result.length).toBe(5);
    });

    it("should filter by error level", () => {
      const result = filterLogsByLevel(logs, "error");
      expect(result.length).toBe(2);
      expect(result.every((l) => l.level === "error")).toBe(true);
    });

    it("should filter by warn level", () => {
      const result = filterLogsByLevel(logs, "warn");
      expect(result.length).toBe(1);
      expect(result[0].level).toBe("warn");
    });

    it("should filter by info level", () => {
      const result = filterLogsByLevel(logs, "info");
      expect(result.length).toBe(1);
      expect(result[0].level).toBe("info");
    });

    it("should filter by debug level", () => {
      const result = filterLogsByLevel(logs, "debug");
      expect(result.length).toBe(1);
      expect(result[0].level).toBe("debug");
    });

    it("should return empty array if no matches", () => {
      const onlyInfo: LogEntry[] = [
        { id: "1", timestamp: "", level: "info", message: "Info" },
      ];
      const result = filterLogsByLevel(onlyInfo, "error");
      expect(result).toEqual([]);
    });
  });
});

describe("Logs State Integration", () => {
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    store = createStore();
  });

  it("should integrate fetched logs with store", async () => {
    const pb = createMockPBClient(mockRawLogs);

    const result = await fetchLogs(pb as any, {});
    store.set(setLogsAtom, result.logs);

    const storedLogs = store.get(logsAtom);
    expect(storedLogs.length).toBe(4);
  });

  it("should support filtering logs by level in store", async () => {
    const pb = createMockPBClient(mockRawLogs);

    const result = await fetchLogs(pb as any, {});
    store.set(setLogsAtom, result.logs);
    store.set(setLevelFilterAtom, "error");

    const allLogs = store.get(logsAtom);
    const filter = store.get(logsLevelFilterAtom);
    const filtered = filterLogsByLevel(allLogs, filter);

    expect(filtered.length).toBe(1);
    expect(filtered[0].level).toBe("error");
  });

  it("should track loading state during fetch", async () => {
    const pb = createMockPBClient(mockRawLogs);

    // Set loading before fetch
    store.set(setLoadingAtom, true);
    expect(store.get(isLogsLoadingAtom)).toBe(true);

    // Fetch logs
    const result = await fetchLogs(pb as any, {});
    store.set(setLogsAtom, result.logs);
    store.set(setLoadingAtom, false);

    expect(store.get(isLogsLoadingAtom)).toBe(false);
  });

  it("should handle error state", async () => {
    const pb = {
      send: mock(() => Promise.reject(new Error("API Error"))),
    };

    store.set(setLoadingAtom, true);

    try {
      await fetchLogs(pb as any, {});
    } catch (error) {
      store.set(setErrorAtom, (error as Error).message);
      store.set(setLoadingAtom, false);
    }

    expect(store.get(logsErrorAtom)).toBe("API Error");
    expect(store.get(isLogsLoadingAtom)).toBe(false);
  });

  it("should add single log entry to store", () => {
    const newLog: LogEntry = {
      id: "new1",
      timestamp: "2024-01-01T00:00:05Z",
      level: "info",
      message: "New log entry",
    };

    store.set(addLogAtom, newLog);

    const logs = store.get(logsAtom);
    expect(logs.length).toBe(1);
    expect(logs[0]).toEqual(newLog);
  });

  it("should clear all logs state", async () => {
    const pb = createMockPBClient(mockRawLogs);

    const result = await fetchLogs(pb as any, {});
    store.set(setLogsAtom, result.logs);
    store.set(setLevelFilterAtom, "error");
    store.set(setLoadingAtom, true);
    store.set(setErrorAtom, "Some error");

    // Clear all state
    store.set(clearLogsAtom);

    expect(store.get(logsAtom)).toEqual([]);
    expect(store.get(logsLevelFilterAtom)).toBeNull();
    expect(store.get(isLogsLoadingAtom)).toBe(false);
    expect(store.get(logsErrorAtom)).toBeNull();
  });
});
