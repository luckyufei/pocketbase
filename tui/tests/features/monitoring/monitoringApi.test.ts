/**
 * Monitoring API Tests (STORY-7.2)
 *
 * TDD: 🔴 Red Phase
 * Tests for:
 * - T-7.2.1: fetchMetrics (获取系统指标)
 * - T-7.2.2: Monitoring API integration
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
  type RawMetrics,
} from "../../../src/features/monitoring/lib/monitoringApi.js";

// Mock /api/system/metrics response format
const mockMetricsResponse = {
  items: [
    {
      id: "metric1",
      timestamp: "2024-01-01T00:00:00Z",
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
};

const createMockPBClient = (metricsResponse = mockMetricsResponse) => ({
  health: {
    check: mock(() =>
      Promise.resolve({
        code: 200,
        message: "API is healthy",
        data: { canBackup: true },
      })
    ),
  },
  send: mock((path: string) => {
    if (path === "/api/system/metrics") {
      return Promise.resolve(metricsResponse);
    }
    return Promise.reject(new Error("Unknown path"));
  }),
});

describe("Monitoring API", () => {
  describe("fetchMetrics (T-7.2.1)", () => {
    it("should fetch system metrics from /api/system/metrics", async () => {
      const pb = createMockPBClient();

      const result = await fetchMetrics(pb as any);

      expect(result).toHaveProperty("cpu");
      expect(result).toHaveProperty("memory");
      expect(result).toHaveProperty("goroutines");
      expect(result).toHaveProperty("activeConnections");
      expect(pb.send).toHaveBeenCalledWith("/api/system/metrics", expect.any(Object));
    });

    it("should return CPU percentage", async () => {
      const pb = createMockPBClient();

      const result = await fetchMetrics(pb as any);

      expect(result.cpu).toBe(45.5);
    });

    it("should return memory in MB", async () => {
      const pb = createMockPBClient();

      const result = await fetchMetrics(pb as any);

      expect(result.memory).toBe(1024);
    });

    it("should include goroutine count", async () => {
      const pb = createMockPBClient();

      const result = await fetchMetrics(pb as any);

      expect(result.goroutines).toBe(150);
    });

    it("should include active connections (sqlite_open_conns)", async () => {
      const pb = createMockPBClient();

      const result = await fetchMetrics(pb as any);

      expect(result.activeConnections).toBe(10);
    });

    it("should include timestamp", async () => {
      const pb = createMockPBClient();

      const result = await fetchMetrics(pb as any);

      expect(result.timestamp).toBeDefined();
      expect(typeof result.timestamp).toBe("string");
    });

    it("should handle empty metrics response", async () => {
      const pb = createMockPBClient({ items: [], totalItems: 0 });

      const result = await fetchMetrics(pb as any);

      // Should return default values
      expect(result.cpu).toBe(0);
      expect(result.memory).toBe(0);
      expect(result.goroutines).toBe(0);
    });

    it("should handle fetch errors", async () => {
      const pb = {
        health: {
          check: mock(() => Promise.reject(new Error("Network error"))),
        },
        send: mock(() => Promise.reject(new Error("Network error"))),
      };

      await expect(fetchMetrics(pb as any)).rejects.toThrow("Network error");
    });
  });

  describe("formatUptime", () => {
    it("should format seconds only", () => {
      expect(formatUptime(45)).toBe("45s");
    });

    it("should format minutes and seconds", () => {
      expect(formatUptime(125)).toBe("2m 5s");
    });

    it("should format hours and minutes", () => {
      expect(formatUptime(3725)).toBe("1h 2m 5s");
    });

    it("should format days, hours, and minutes", () => {
      expect(formatUptime(90125)).toBe("1d 1h 2m 5s");
    });

    it("should format exactly 1 day", () => {
      expect(formatUptime(86400)).toBe("1d 0h 0m 0s");
    });

    it("should handle zero", () => {
      expect(formatUptime(0)).toBe("0s");
    });
  });

  describe("formatBytes", () => {
    it("should format bytes", () => {
      expect(formatBytes(500)).toBe("500 B");
    });

    it("should format kilobytes", () => {
      expect(formatBytes(1024)).toBe("1.00 KB");
    });

    it("should format megabytes", () => {
      expect(formatBytes(1048576)).toBe("1.00 MB");
    });

    it("should format gigabytes", () => {
      expect(formatBytes(1073741824)).toBe("1.00 GB");
    });

    it("should handle zero", () => {
      expect(formatBytes(0)).toBe("0 B");
    });

    it("should show 2 decimal places for large values", () => {
      expect(formatBytes(1536 * 1024 * 1024)).toBe("1.50 GB");
    });
  });
});

describe("Monitoring State Integration", () => {
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    store = createStore();
  });

  it("should integrate fetched metrics with store", async () => {
    const pb = createMockPBClient();

    const result = await fetchMetrics(pb as any);
    store.set(setMonitoringAtom, result);

    const stored = store.get(monitoringAtom);
    expect(stored).not.toBeNull();
    expect(stored?.cpu).toBe(45.5);
  });

  it("should track loading state during fetch", async () => {
    const pb = createMockPBClient();

    store.set(setMonitoringLoadingAtom, true);
    expect(store.get(isMonitoringLoadingAtom)).toBe(true);

    const result = await fetchMetrics(pb as any);
    store.set(setMonitoringAtom, result);
    store.set(setMonitoringLoadingAtom, false);

    expect(store.get(isMonitoringLoadingAtom)).toBe(false);
  });

  it("should handle error state", async () => {
    const pb = {
      health: {
        check: mock(() => Promise.reject(new Error("Server unavailable"))),
      },
      send: mock(() => Promise.reject(new Error("Server unavailable"))),
    };

    store.set(setMonitoringLoadingAtom, true);

    try {
      await fetchMetrics(pb as any);
    } catch (error) {
      store.set(setMonitoringErrorAtom, (error as Error).message);
      store.set(setMonitoringLoadingAtom, false);
    }

    expect(store.get(monitoringErrorAtom)).toBe("Server unavailable");
    expect(store.get(isMonitoringLoadingAtom)).toBe(false);
  });

  it("should clear monitoring state", async () => {
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
