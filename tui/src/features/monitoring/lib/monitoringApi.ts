/**
 * Monitoring API (STORY-7.2)
 *
 * API functions for system monitoring
 * - T-7.2.1: fetchMetrics
 * - T-7.2.2: Helper functions
 * 
 * NOTE: PocketBase metrics are accessed via /api/system/metrics endpoint
 */

import type PocketBase from "pocketbase";
import type { SystemMetrics } from "../store/monitoringAtoms.js";

/**
 * Raw metrics response from server
 */
export interface RawMetrics {
  code: number;
  message: string;
  data?: Record<string, unknown>;
}

/**
 * Raw metric item from /api/system/metrics
 */
interface RawMetricItem {
  id: string;
  timestamp: string;
  cpu_usage_percent: number;
  memory_alloc_mb: number;
  goroutines_count: number;
  sqlite_wal_size_mb: number;
  sqlite_open_conns: number;
  p95_latency_ms: number;
  http_5xx_count: number;
}

/**
 * Raw response from /api/system/metrics
 */
interface MetricsResponse {
  items: RawMetricItem[];
  totalItems: number;
}

/**
 * Fetch system metrics from PocketBase /api/system/metrics endpoint
 */
export async function fetchMetrics(pb: PocketBase): Promise<SystemMetrics> {
  // Fetch metrics from the correct endpoint
  const response = await pb.send<MetricsResponse>("/api/system/metrics", {
    method: "GET",
  });

  // Get the latest metric (first item, sorted by timestamp desc)
  const latest = response.items[0];

  if (!latest) {
    // Return default metrics if no data
    return {
      cpu: 0,
      memory: 0,
      memoryPercent: 0,
      goroutines: 0,
      activeConnections: 0,
      uptime: 0,
      timestamp: new Date().toISOString(),
    };
  }

  return {
    cpu: latest.cpu_usage_percent,
    memory: Math.round(latest.memory_alloc_mb), // Already in MB
    memoryPercent: 0, // Not provided by this endpoint, calculate if needed
    goroutines: latest.goroutines_count,
    activeConnections: latest.sqlite_open_conns,
    uptime: 0, // Not provided by this endpoint
    timestamp: latest.timestamp,
  };
}

/**
 * Format uptime seconds to human readable string
 */
export function formatUptime(seconds: number): string {
  if (seconds === 0) return "0s";

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts: string[] = [];

  if (days > 0) {
    parts.push(`${days}d`);
    parts.push(`${hours}h`);
    parts.push(`${minutes}m`);
    parts.push(`${secs}s`);
  } else if (hours > 0) {
    parts.push(`${hours}h`);
    parts.push(`${minutes}m`);
    parts.push(`${secs}s`);
  } else if (minutes > 0) {
    parts.push(`${minutes}m`);
    parts.push(`${secs}s`);
  } else {
    parts.push(`${secs}s`);
  }

  return parts.join(" ");
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  let unitIndex = 0;
  let value = bytes;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }

  if (unitIndex === 0) {
    return `${value} ${units[unitIndex]}`;
  }

  return `${value.toFixed(2)} ${units[unitIndex]}`;
}
