/**
 * Monitoring Atoms Tests (STORY-7.1)
 *
 * TDD: 🔴 Red Phase
 * Tests for:
 * - T-7.1.1: monitoringAtom (系统指标)
 * - T-7.1.2: Monitoring state management
 */

import { describe, expect, it, beforeEach } from "bun:test";
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

describe("Monitoring Atoms", () => {
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    store = createStore();
  });

  describe("monitoringAtom (T-7.1.1)", () => {
    it("should have null initial metrics", () => {
      const metrics = store.get(monitoringAtom);
      expect(metrics).toBeNull();
    });

    it("should allow setting system metrics", () => {
      const mockMetrics: SystemMetrics = {
        cpu: 45.5,
        memory: 1024,
        memoryPercent: 62.3,
        goroutines: 150,
        activeConnections: 10,
        uptime: 86400,
        timestamp: "2024-01-01T12:00:00Z",
      };

      store.set(setMonitoringAtom, mockMetrics);
      const metrics = store.get(monitoringAtom);

      expect(metrics).not.toBeNull();
      expect(metrics?.cpu).toBe(45.5);
      expect(metrics?.memory).toBe(1024);
      expect(metrics?.goroutines).toBe(150);
    });

    it("should store CPU usage percentage", () => {
      const metrics: SystemMetrics = {
        cpu: 78.9,
        memory: 512,
        memoryPercent: 25.0,
        goroutines: 100,
        activeConnections: 5,
        uptime: 3600,
        timestamp: "2024-01-01T00:00:00Z",
      };

      store.set(setMonitoringAtom, metrics);
      expect(store.get(monitoringAtom)?.cpu).toBe(78.9);
    });

    it("should store memory in MB", () => {
      const metrics: SystemMetrics = {
        cpu: 50.0,
        memory: 2048,
        memoryPercent: 50.0,
        goroutines: 200,
        activeConnections: 15,
        uptime: 7200,
        timestamp: "2024-01-01T00:00:00Z",
      };

      store.set(setMonitoringAtom, metrics);
      expect(store.get(monitoringAtom)?.memory).toBe(2048);
    });

    it("should store goroutine count", () => {
      const metrics: SystemMetrics = {
        cpu: 30.0,
        memory: 1024,
        memoryPercent: 25.0,
        goroutines: 500,
        activeConnections: 20,
        uptime: 10000,
        timestamp: "2024-01-01T00:00:00Z",
      };

      store.set(setMonitoringAtom, metrics);
      expect(store.get(monitoringAtom)?.goroutines).toBe(500);
    });

    it("should store active connections", () => {
      const metrics: SystemMetrics = {
        cpu: 20.0,
        memory: 768,
        memoryPercent: 18.75,
        goroutines: 75,
        activeConnections: 42,
        uptime: 5000,
        timestamp: "2024-01-01T00:00:00Z",
      };

      store.set(setMonitoringAtom, metrics);
      expect(store.get(monitoringAtom)?.activeConnections).toBe(42);
    });

    it("should store uptime in seconds", () => {
      const metrics: SystemMetrics = {
        cpu: 25.0,
        memory: 512,
        memoryPercent: 12.5,
        goroutines: 50,
        activeConnections: 3,
        uptime: 172800, // 2 days
        timestamp: "2024-01-01T00:00:00Z",
      };

      store.set(setMonitoringAtom, metrics);
      expect(store.get(monitoringAtom)?.uptime).toBe(172800);
    });

    it("should store timestamp", () => {
      const metrics: SystemMetrics = {
        cpu: 10.0,
        memory: 256,
        memoryPercent: 6.25,
        goroutines: 25,
        activeConnections: 1,
        uptime: 1000,
        timestamp: "2024-01-01T15:30:45Z",
      };

      store.set(setMonitoringAtom, metrics);
      expect(store.get(monitoringAtom)?.timestamp).toBe("2024-01-01T15:30:45Z");
    });
  });

  describe("isMonitoringLoadingAtom", () => {
    it("should have false initial loading state", () => {
      expect(store.get(isMonitoringLoadingAtom)).toBe(false);
    });

    it("should allow setting loading to true", () => {
      store.set(setMonitoringLoadingAtom, true);
      expect(store.get(isMonitoringLoadingAtom)).toBe(true);
    });

    it("should allow setting loading to false", () => {
      store.set(setMonitoringLoadingAtom, true);
      store.set(setMonitoringLoadingAtom, false);
      expect(store.get(isMonitoringLoadingAtom)).toBe(false);
    });
  });

  describe("monitoringErrorAtom", () => {
    it("should have null initial error", () => {
      expect(store.get(monitoringErrorAtom)).toBeNull();
    });

    it("should allow setting error message", () => {
      store.set(setMonitoringErrorAtom, "Failed to fetch metrics");
      expect(store.get(monitoringErrorAtom)).toBe("Failed to fetch metrics");
    });

    it("should allow clearing error", () => {
      store.set(setMonitoringErrorAtom, "Some error");
      store.set(setMonitoringErrorAtom, null);
      expect(store.get(monitoringErrorAtom)).toBeNull();
    });
  });

  describe("clearMonitoringAtom", () => {
    it("should clear all monitoring state", () => {
      const metrics: SystemMetrics = {
        cpu: 50.0,
        memory: 1024,
        memoryPercent: 25.0,
        goroutines: 100,
        activeConnections: 5,
        uptime: 3600,
        timestamp: "2024-01-01T00:00:00Z",
      };

      store.set(setMonitoringAtom, metrics);
      store.set(setMonitoringLoadingAtom, true);
      store.set(setMonitoringErrorAtom, "Some error");

      store.set(clearMonitoringAtom);

      expect(store.get(monitoringAtom)).toBeNull();
      expect(store.get(isMonitoringLoadingAtom)).toBe(false);
      expect(store.get(monitoringErrorAtom)).toBeNull();
    });
  });

  describe("SystemMetrics interface", () => {
    it("should support all required metric fields", () => {
      const metrics: SystemMetrics = {
        cpu: 0,
        memory: 0,
        memoryPercent: 0,
        goroutines: 0,
        activeConnections: 0,
        uptime: 0,
        timestamp: "",
      };

      expect(metrics).toHaveProperty("cpu");
      expect(metrics).toHaveProperty("memory");
      expect(metrics).toHaveProperty("memoryPercent");
      expect(metrics).toHaveProperty("goroutines");
      expect(metrics).toHaveProperty("activeConnections");
      expect(metrics).toHaveProperty("uptime");
      expect(metrics).toHaveProperty("timestamp");
    });

    it("should handle high values", () => {
      const metrics: SystemMetrics = {
        cpu: 99.9,
        memory: 65536, // 64GB
        memoryPercent: 99.9,
        goroutines: 100000,
        activeConnections: 10000,
        uptime: 31536000, // 1 year
        timestamp: "2024-12-31T23:59:59Z",
      };

      store.set(setMonitoringAtom, metrics);
      const stored = store.get(monitoringAtom);

      expect(stored?.cpu).toBe(99.9);
      expect(stored?.memory).toBe(65536);
      expect(stored?.goroutines).toBe(100000);
    });

    it("should handle zero values", () => {
      const metrics: SystemMetrics = {
        cpu: 0,
        memory: 0,
        memoryPercent: 0,
        goroutines: 0,
        activeConnections: 0,
        uptime: 0,
        timestamp: "2024-01-01T00:00:00Z",
      };

      store.set(setMonitoringAtom, metrics);
      const stored = store.get(monitoringAtom);

      expect(stored?.cpu).toBe(0);
      expect(stored?.memory).toBe(0);
      expect(stored?.activeConnections).toBe(0);
    });
  });
});
