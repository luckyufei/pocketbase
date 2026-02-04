/**
 * Logs API (STORY-6.2)
 *
 * API functions for Logs operations
 * - T-6.2.1: fetchLogs
 * - T-6.2.2: Log filtering and transformation
 * 
 * NOTE: PocketBase logs are accessed via /api/logs endpoint, not a collection
 */

import type PocketBase from "pocketbase";
import type { LogEntry, LogLevel } from "../store/logsAtoms.js";

/**
 * Options for fetching logs
 */
export interface FetchLogsOptions {
  page?: number;
  perPage?: number;
  filter?: string;
  sort?: string;
}

/**
 * Result of fetching logs
 */
export interface FetchLogsResult {
  logs: LogEntry[];
  page: number;
  perPage: number;
  totalItems: number;
  totalPages: number;
}

/**
 * Raw log entry from PocketBase /api/logs endpoint
 */
interface RawLogEntry {
  id: string;
  created: string;
  level: number | string;  // PocketBase uses numeric levels: 0=info, 8=error
  message: string;
  data?: Record<string, unknown>;
}

/**
 * Raw response from /api/logs endpoint
 */
interface LogsResponse {
  items: RawLogEntry[];
  page: number;
  perPage: number;
  totalItems: number;
  totalPages: number;
}

/**
 * Map numeric log level to string
 */
function mapLogLevel(level: number | string): LogLevel {
  if (typeof level === "string") {
    return level as LogLevel;
  }
  // PocketBase uses: 0=info/debug, 4=warn, 8=error
  switch (level) {
    case 8:
      return "error";
    case 4:
      return "warn";
    case 0:
    default:
      return "info";
  }
}

/**
 * Transform raw PocketBase log entry to LogEntry format
 */
export function transformLogEntry(raw: RawLogEntry): LogEntry {
  return {
    id: raw.id,
    timestamp: raw.created,
    level: mapLogLevel(raw.level),
    message: raw.message,
    data: raw.data,
  };
}

/**
 * Filter logs by level
 * Returns all logs if filter is null
 */
export function filterLogsByLevel(
  logs: LogEntry[],
  level: LogLevel | null
): LogEntry[] {
  if (level === null) {
    return logs;
  }
  return logs.filter((log) => log.level === level);
}

/**
 * Fetch logs from PocketBase /api/logs endpoint
 * This is a system endpoint, not a collection
 */
export async function fetchLogs(
  pb: PocketBase,
  options: FetchLogsOptions
): Promise<FetchLogsResult> {
  const { page = 1, perPage = 50, filter = "", sort = "-created" } = options;

  // Build query params
  const params = new URLSearchParams({
    page: String(page),
    perPage: String(perPage),
  });
  if (filter) params.append("filter", filter);
  if (sort) params.append("sort", sort);

  // Use pb.send() to call the /api/logs endpoint directly
  const result = await pb.send<LogsResponse>(`/api/logs?${params.toString()}`, {
    method: "GET",
  });

  return {
    logs: result.items.map((item) => transformLogEntry(item)),
    page: result.page,
    perPage: result.perPage,
    totalItems: result.totalItems,
    totalPages: result.totalPages,
  };
}
