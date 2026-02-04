/**
 * Log Stream Component (STORY-6.3)
 *
 * Displays logs in a stream format with level filtering
 * - T-6.3.1: Display timestamp, level, message
 * - T-6.3.2: Level-based color coding
 */

import React from "react";
import { Box, Text } from "ink";
import type { LogEntry, LogLevel } from "../store/logsAtoms.js";

export interface LogStreamProps {
  logs: LogEntry[];
  selectedIndex?: number;
  maxLines?: number;
  showData?: boolean;
  levelFilter?: LogLevel | null;
  onLevelFilterChange?: (level: LogLevel | null) => void;
}

/**
 * Get color for log level
 */
function getLevelColor(level: LogLevel): string {
  switch (level) {
    case "error":
      return "red";
    case "warn":
      return "yellow";
    case "info":
      return "blue";
    case "debug":
      return "gray";
    default:
      return "white";
  }
}

/**
 * Get level badge text
 */
function getLevelBadge(level: LogLevel): string {
  switch (level) {
    case "error":
      return "ERR";
    case "warn":
      return "WRN";
    case "info":
      return "INF";
    case "debug":
      return "DBG";
    default:
      return String(level).toUpperCase().slice(0, 3);
  }
}

/**
 * Format timestamp for display
 */
function formatTimestamp(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return timestamp.slice(11, 19);
  }
}

/**
 * Single Log Line Component
 */
function LogLine({
  log,
  isSelected,
  showData,
}: {
  log: LogEntry;
  isSelected: boolean;
  showData: boolean;
}): React.ReactElement {
  const levelColor = getLevelColor(log.level);

  return (
    <Box flexDirection="column">
      <Box>
        {/* Selection indicator */}
        <Text inverse={isSelected} color={isSelected ? "cyan" : undefined}>
          {isSelected ? "▶ " : "  "}
        </Text>
        {/* Timestamp */}
        <Text color="gray">{formatTimestamp(log.timestamp)}</Text>
        <Text> </Text>

        {/* Level Badge */}
        <Text color={levelColor} bold>
          [{getLevelBadge(log.level)}]
        </Text>
        <Text> </Text>

        {/* Message */}
        <Text color={isSelected ? "cyan" : undefined} bold={isSelected}>{log.message}</Text>
      </Box>

      {/* Data (optional) */}
      {showData && log.data && Object.keys(log.data).length > 0 && (
        <Box paddingLeft={2}>
          <Text color="gray">{JSON.stringify(log.data)}</Text>
        </Box>
      )}
    </Box>
  );
}

/**
 * Log Stream Component
 */
export function LogStream({
  logs,
  selectedIndex = -1,
  maxLines = 50,
  showData = false,
  levelFilter = null,
  onLevelFilterChange,
}: LogStreamProps): React.ReactElement {
  // Apply level filter
  const filteredLogs = levelFilter
    ? logs.filter((log) => log.level === levelFilter)
    : logs;

  // Limit displayed logs
  const displayedLogs = filteredLogs.slice(-maxLines);

  if (logs.length === 0) {
    return (
      <Box flexDirection="column">
        <Box>
          <Text color="gray">No logs available</Text>
        </Box>
        <Box marginTop={1}>
          <Text color="gray">Waiting for log entries...</Text>
        </Box>
      </Box>
    );
  }

  if (filteredLogs.length === 0 && levelFilter) {
    return (
      <Box flexDirection="column">
        <Box>
          <Text color="gray">
            No {levelFilter} logs found
          </Text>
        </Box>
        <Box marginTop={1}>
          <Text color="gray">
            Filtering by: <Text color={getLevelColor(levelFilter)}>{levelFilter}</Text>
          </Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box marginBottom={1} justifyContent="space-between">
        <Box>
          <Text bold>Logs</Text>
          <Text color="gray"> • </Text>
          <Text color="gray">
            {filteredLogs.length} entries
            {levelFilter && (
              <>
                {" "}
                (filtered: <Text color={getLevelColor(levelFilter)}>{levelFilter}</Text>)
              </>
            )}
          </Text>
        </Box>
        <Box>
          <Text color="gray">
            [E]rror [W]arn [I]nfo [D]ebug [A]ll
          </Text>
        </Box>
      </Box>

      {/* Log Lines */}
      <Box flexDirection="column" borderStyle="single" paddingX={1}>
        {displayedLogs.map((log, index) => (
          <LogLine
            key={log.id}
            log={log}
            isSelected={index === selectedIndex}
            showData={showData}
          />
        ))}
      </Box>

      {/* Footer */}
      <Box marginTop={1}>
        <Text color="gray">
          {filteredLogs.length > maxLines && (
            <>
              Showing last {maxLines} of {filteredLogs.length} • 
            </>
          )}
          ↑↓ scroll • e/w/i/d/a filter • q back • r refresh
        </Text>
      </Box>
    </Box>
  );
}
