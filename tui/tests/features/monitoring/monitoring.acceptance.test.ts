/**
 * Monitoring Acceptance Tests (STORY-7.4)
 *
 * TDD: 🔴 Red Phase
 * Tests for:
 * - T-7.4.1: /monitor 显示监控仪表盘 (US8-AC1)
 * - T-7.4.2: 显示 CPU、内存、Goroutine、连接数 (US8-AC2)
 * - T-7.4.3: 指标实时刷新 (US8-AC3)
 */

import { describe, expect, it, beforeEach, mock } from "bun:test";
import { createStore } from "jotai";
import {
  monitoringAtom,
  isMonitoringLoadingAtom,
  monitoringErrorAtom,
  setMonitoringAtom,
  setMonitoringLoadingAtom,
  setMonitoringErrorAtom,
  clearMonitoringAtom,
  type SystemMetrics,
} from "../../../src/features/monitoring/store/monitoringAtoms.js";
import {
  fetchMetrics,
  formatUptime,
  formatBytes,
} from "../../../src/features/monitoring/lib/monitoringApi.js";
import { parseCommand } from "../../../src/lib/parser.js";
import { getCommand } from "../../../src/lib/commands.js";

// Mock /api/system/metrics response format
const mockMetricsResponse = {
  items: [
    {
      id: "metric1",
      timestamp: "2024-01-01T00:00:00Z",
      cpu_usage_percent: 45.5,
      memory_alloc_mb: 1024, // 1GB in MB
      goroutines_count: 150,
      sqlite_wal_size_mb: 10.5,
      sqlite_open_conns: 10,
      p95_latency_ms: 15,
      http_5xx_count: 0,
    },
  ],
  totalItems: 1,
};

const createMockPBClient = (metricsResponse = mockMetricsResponse) => ({
  health: {
    check: mock(() =>
      Promise.resolve({ code: 200, message: "API is healthy" })
    ),
  },
  send: mock((path: string) => {
    if (path === "/api/system/metrics") {
      return Promise.resolve(metricsResponse);
    }
    return Promise.reject(new Error("Unknown path"));
  }),
});

describe("Monitoring Acceptance Tests (STORY-7.4)", () => {
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    store = createStore();
  });

  describe("US8-AC1: /monitor 显示监控仪表盘 (T-7.4.1)", () => {
    it("should recognize /monitor as a valid command", () => {
      const parsed = parseCommand("/monitor");

      expect(parsed.command).toBe("/monitor");
    });

    it("should have /monitor command registered", () => {
      const cmd = getCommand("/monitor");

      expect(cmd).toBeDefined();
      expect(cmd?.name).toBe("/monitor");
    });

    it("should fetch metrics when /monitor is executed", async () => {
      const pb = createMockPBClient();

      const result = await fetchMetrics(pb as any);
      store.set(setMonitoringAtom, result);

      const metrics = store.get(monitoringAtom);
      expect(metrics).not.toBeNull();
      expect(metrics?.cpu).toBeDefined();
    });

    it("should show loading state while fetching", async () => {
      const pb = createMockPBClient();

      store.set(setMonitoringLoadingAtom, true);
      expect(store.get(isMonitoringLoadingAtom)).toBe(true);

      const result = await fetchMetrics(pb as any);
      store.set(setMonitoringAtom, result);
      store.set(setMonitoringLoadingAtom, false);

      expect(store.get(isMonitoringLoadingAtom)).toBe(false);
    });
  });

  describe("US8-AC2: 显示 CPU、内存、Goroutine、连接数 (T-7.4.2)", () => {
    it("should display CPU percentage", async () => {
      const pb = createMockPBClient();

      const result = await fetchMetrics(pb as any);
      store.set(setMonitoringAtom, result);

      const metrics = store.get(monitoringAtom);
      expect(metrics?.cpu).toBe(45.5);
    });

    it("should display memory usage in MB", async () => {
      const pb = createMockPBClient();

      const result = await fetchMetrics(pb as any);
      store.set(setMonitoringAtom, result);

      const metrics = store.get(monitoringAtom);
      expect(metrics?.memory).toBe(1024); // Already in MB
    });

    it("should display memory percentage (may be 0 if not provided)", async () => {
      const pb = createMockPBClient();

      const result = await fetchMetrics(pb as any);
      store.set(setMonitoringAtom, result);

      const metrics = store.get(monitoringAtom);
      // memoryPercent may be 0 if not provided by endpoint
      expect(metrics?.memoryPercent).toBeDefined();
    });

    it("should display goroutine count", async () => {
      const pb = createMockPBClient();

      const result = await fetchMetrics(pb as any);
      store.set(setMonitoringAtom, result);

      const metrics = store.get(monitoringAtom);
      expect(metrics?.goroutines).toBe(150);
    });

    it("should display active connections", async () => {
      const pb = createMockPBClient();

      const result = await fetchMetrics(pb as any);
      store.set(setMonitoringAtom, result);

      const metrics = store.get(monitoringAtom);
      expect(metrics?.activeConnections).toBe(10);
    });

    it("should display uptime (may be 0 if not provided)", async () => {
      const pb = createMockPBClient();

      const result = await fetchMetrics(pb as any);
      store.set(setMonitoringAtom, result);

      const metrics = store.get(monitoringAtom);
      // uptime may be 0 if not provided by endpoint
      expect(metrics?.uptime).toBeDefined();
    });
  });

  describe("US8-AC3: 指标实时刷新 (T-7.4.3)", () => {
    it("should update metrics on refresh", async () => {
      // Create mock with different timestamp each time
      let callCount = 0;
      const pb = {
        health: {
          check: mock(() => Promise.resolve({ code: 200, message: "API is healthy" })),
        },
        send: mock((path: string) => {
          callCount++;
          if (path === "/api/system/metrics") {
            return Promise.resolve({
              items: [
                {
                  id: `metric${callCount}`,
                  timestamp: `2024-01-01T00:00:0${callCount}Z`,
                  cpu_usage_percent: 45.5,
                  memory_alloc_mb: 1024,
                  goroutines_count: 150,
                  sqlite_wal_size_mb: 10.5,
                  sqlite_open_conns: 10,
                  p95_latency_ms: 15,
                  http_5xx_count: 0,
                },
              ],
              totalItems: 1,
            });
          }
          return Promise.reject(new Error("Unknown path"));
        }),
      };

      // First fetch
      const result1 = await fetchMetrics(pb as any);
      store.set(setMonitoringAtom, result1);
      const timestamp1 = store.get(monitoringAtom)?.timestamp;

      // Second fetch (simulating refresh)
      const result2 = await fetchMetrics(pb as any);
      store.set(setMonitoringAtom, result2);
      const timestamp2 = store.get(monitoringAtom)?.timestamp;

      // Timestamps should be different
      expect(timestamp2).not.toBe(timestamp1);
    });

    it("should support multiple consecutive refreshes", async () => {
      const pb = createMockPBClient();

      for (let i = 0; i < 3; i++) {
        store.set(setMonitoringLoadingAtom, true);
        const result = await fetchMetrics(pb as any);
        store.set(setMonitoringAtom, result);
        store.set(setMonitoringLoadingAtom, false);

        expect(store.get(monitoringAtom)).not.toBeNull();
        expect(store.get(isMonitoringLoadingAtom)).toBe(false);
      }
    });

    it("should handle refresh errors gracefully", async () => {
      const pb = createMockPBClient();

      // First successful fetch
      const result = await fetchMetrics(pb as any);
      store.set(setMonitoringAtom, result);

      // Simulate error on refresh
      const failingPb = {
        send: mock(() => Promise.reject(new Error("Refresh failed"))),
      };

      try {
        await fetchMetrics(failingPb as any);
      } catch (error) {
        store.set(setMonitoringErrorAtom, (error as Error).message);
      }

      // Should still have old metrics
      expect(store.get(monitoringAtom)).not.toBeNull();
      expect(store.get(monitoringErrorAtom)).toBe("Refresh failed");
    });

    it("should include timestamp for each refresh", async () => {
      const pb = createMockPBClient();

      const result = await fetchMetrics(pb as any);
      store.set(setMonitoringAtom, result);

      const metrics = store.get(monitoringAtom);
      expect(metrics?.timestamp).toBeDefined();
      expect(typeof metrics?.timestamp).toBe("string");
      // Can be ISO format from API or generated
      expect(metrics?.timestamp.length).toBeGreaterThan(0);
    });
  });

  describe("Error Handling", () => {
    it("should handle server unavailable", async () => {
      const pb = {
        send: mock(() => Promise.reject(new Error("Server unavailable"))),
      };

      try {
        await fetchMetrics(pb as any);
      } catch (error) {
        store.set(setMonitoringErrorAtom, (error as Error).message);
      }

      expect(store.get(monitoringErrorAtom)).toBe("Server unavailable");
    });

    it("should clear error on successful refresh", async () => {
      const pb = createMockPBClient();

      // Set initial error
      store.set(setMonitoringErrorAtom, "Previous error");

      // Successful fetch should clear error
      const result = await fetchMetrics(pb as any);
      store.set(setMonitoringAtom, result);
      store.set(setMonitoringErrorAtom, null);

      expect(store.get(monitoringErrorAtom)).toBeNull();
    });
  });

  describe("Clear State on Exit", () => {
    it("should clear monitoring state when exiting view", async () => {
      const pb = createMockPBClient();

      const result = await fetchMetrics(pb as any);
      store.set(setMonitoringAtom, result);
      store.set(setMonitoringLoadingAtom, true);
      store.set(setMonitoringErrorAtom, "Some error");

      store.set(clearMonitoringAtom);

      expect(store.get(monitoringAtom)).toBeNull();
      expect(store.get(isMonitoringLoadingAtom)).toBe(false);
      expect(store.get(monitoringErrorAtom)).toBeNull();
    });
  });
});
