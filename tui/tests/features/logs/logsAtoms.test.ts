/**
 * Logs Atoms Tests (STORY-6.1)
 * 
 * TDD: 🔴 Red Phase
 * Tests for:
 * - T-6.1.1: logsAtom (Logs list)
 * - T-6.1.3: logsLevelFilterAtom (Level filter)
 */

import { describe, expect, it, beforeEach } from "bun:test";
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

describe("Logs Atoms", () => {
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    store = createStore();
  });

  describe("logsAtom (T-6.1.1, T-6.1.2)", () => {
    it("should have empty initial logs", () => {
      const logs = store.get(logsAtom);
      expect(logs).toEqual([]);
    });

    it("should allow setting logs", () => {
      const mockLogs: LogEntry[] = [
        { id: "1", timestamp: "2024-01-01T00:00:00Z", level: "info", message: "Server started" },
        { id: "2", timestamp: "2024-01-01T00:00:01Z", level: "error", message: "Database error" },
      ];

      store.set(setLogsAtom, mockLogs);
      const logs = store.get(logsAtom);

      expect(logs.length).toBe(2);
      expect(logs[0].message).toBe("Server started");
      expect(logs[1].level).toBe("error");
    });

    it("should store log with all fields", () => {
      const log: LogEntry = {
        id: "abc123",
        timestamp: "2024-01-01T12:00:00Z",
        level: "warn",
        message: "High memory usage",
        data: { memory: "95%" },
      };

      store.set(setLogsAtom, [log]);
      const logs = store.get(logsAtom);

      expect(logs[0].id).toBe("abc123");
      expect(logs[0].level).toBe("warn");
      expect(logs[0].data?.memory).toBe("95%");
    });

    it("should support adding single log entry", () => {
      store.set(setLogsAtom, [
        { id: "1", timestamp: "2024-01-01T00:00:00Z", level: "info", message: "Log 1" },
      ]);

      store.set(addLogAtom, { 
        id: "2", 
        timestamp: "2024-01-01T00:00:01Z", 
        level: "info", 
        message: "Log 2" 
      });

      const logs = store.get(logsAtom);
      expect(logs.length).toBe(2);
      expect(logs[1].message).toBe("Log 2");
    });

    it("should support all log levels", () => {
      const levels: LogLevel[] = ["debug", "info", "warn", "error"];
      const logs: LogEntry[] = levels.map((level, i) => ({
        id: String(i),
        timestamp: "2024-01-01T00:00:00Z",
        level,
        message: `${level} message`,
      }));

      store.set(setLogsAtom, logs);
      const stored = store.get(logsAtom);

      expect(stored.map(l => l.level)).toEqual(levels);
    });
  });

  describe("logsLevelFilterAtom (T-6.1.3, T-6.1.4)", () => {
    it("should have null initial level filter (show all)", () => {
      const filter = store.get(logsLevelFilterAtom);
      expect(filter).toBeNull();
    });

    it("should allow setting level filter to error", () => {
      store.set(setLevelFilterAtom, "error");
      expect(store.get(logsLevelFilterAtom)).toBe("error");
    });

    it("should allow setting level filter to warn", () => {
      store.set(setLevelFilterAtom, "warn");
      expect(store.get(logsLevelFilterAtom)).toBe("warn");
    });

    it("should allow setting level filter to info", () => {
      store.set(setLevelFilterAtom, "info");
      expect(store.get(logsLevelFilterAtom)).toBe("info");
    });

    it("should allow clearing level filter", () => {
      store.set(setLevelFilterAtom, "error");
      store.set(setLevelFilterAtom, null);
      expect(store.get(logsLevelFilterAtom)).toBeNull();
    });
  });

  describe("isLogsLoadingAtom", () => {
    it("should have false initial loading state", () => {
      expect(store.get(isLogsLoadingAtom)).toBe(false);
    });

    it("should allow setting loading state", () => {
      store.set(setLoadingAtom, true);
      expect(store.get(isLogsLoadingAtom)).toBe(true);
    });
  });

  describe("logsErrorAtom", () => {
    it("should have null initial error", () => {
      expect(store.get(logsErrorAtom)).toBeNull();
    });

    it("should allow setting error message", () => {
      store.set(setErrorAtom, "Failed to fetch logs");
      expect(store.get(logsErrorAtom)).toBe("Failed to fetch logs");
    });
  });

  describe("clearLogsAtom", () => {
    it("should clear all logs state", () => {
      store.set(setLogsAtom, [
        { id: "1", timestamp: "", level: "info", message: "Test" },
      ]);
      store.set(setLevelFilterAtom, "error");
      store.set(setLoadingAtom, true);
      store.set(setErrorAtom, "Some error");

      store.set(clearLogsAtom);

      expect(store.get(logsAtom)).toEqual([]);
      expect(store.get(logsLevelFilterAtom)).toBeNull();
      expect(store.get(isLogsLoadingAtom)).toBe(false);
      expect(store.get(logsErrorAtom)).toBeNull();
    });
  });

  describe("Log filtering by level", () => {
    it("should filter logs by error level", () => {
      const logs: LogEntry[] = [
        { id: "1", timestamp: "", level: "info", message: "Info" },
        { id: "2", timestamp: "", level: "error", message: "Error" },
        { id: "3", timestamp: "", level: "warn", message: "Warning" },
        { id: "4", timestamp: "", level: "error", message: "Another error" },
      ];

      store.set(setLogsAtom, logs);
      store.set(setLevelFilterAtom, "error");

      const allLogs = store.get(logsAtom);
      const filter = store.get(logsLevelFilterAtom);
      const filtered = allLogs.filter(l => l.level === filter);

      expect(filtered.length).toBe(2);
      expect(filtered.every(l => l.level === "error")).toBe(true);
    });
  });
});
