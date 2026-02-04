/**
 * Monitor Dashboard Component (STORY-7.3)
 *
 * Displays system metrics dashboard
 * - T-7.3.1: Display CPU, Memory, Goroutines, Connections
 * - T-7.3.2: Real-time refresh support
 */

import React from "react";
import { Box, Text } from "ink";
import type { SystemMetrics } from "../store/monitoringAtoms.js";
import { formatUptime, formatBytes } from "../lib/monitoringApi.js";

export interface MonitorDashboardProps {
  metrics: SystemMetrics | null;
  isLoading?: boolean;
  error?: string | null;
  refreshInterval?: number;
  onRefresh?: () => void;
}

/**
 * Get color based on percentage value
 */
function getPercentageColor(percent: number): string {
  if (percent >= 90) return "red";
  if (percent >= 70) return "yellow";
  if (percent >= 50) return "cyan";
  return "green";
}

/**
 * Progress bar component
 */
function ProgressBar({
  value,
  max = 100,
  width = 20,
  label,
}: {
  value: number;
  max?: number;
  width?: number;
  label: string;
}): React.ReactElement {
  const percent = Math.min((value / max) * 100, 100);
  const filled = Math.round((percent / 100) * width);
  const empty = width - filled;
  const color = getPercentageColor(percent);

  return (
    <Box>
      <Box width={12}>
        <Text>{label}</Text>
      </Box>
      <Text color={color}>
        {"█".repeat(filled)}
        {"░".repeat(empty)}
      </Text>
      <Text> </Text>
      <Text color={color} bold>
        {percent.toFixed(1)}%
      </Text>
    </Box>
  );
}

/**
 * Metric Card component
 */
function MetricCard({
  title,
  value,
  unit,
  color = "white",
}: {
  title: string;
  value: string | number;
  unit?: string;
  color?: string;
}): React.ReactElement {
  return (
    <Box flexDirection="column" marginRight={4}>
      <Text color="gray">{title}</Text>
      <Box>
        <Text color={color} bold>
          {value}
        </Text>
        {unit && <Text color="gray"> {unit}</Text>}
      </Box>
    </Box>
  );
}

/**
 * Monitor Dashboard Component
 */
export function MonitorDashboard({
  metrics,
  isLoading = false,
  error = null,
  refreshInterval = 5,
  onRefresh,
}: MonitorDashboardProps): React.ReactElement {
  if (isLoading && !metrics) {
    return (
      <Box flexDirection="column">
        <Text bold>System Monitor</Text>
        <Box marginTop={1}>
          <Text color="gray">Loading metrics...</Text>
        </Box>
      </Box>
    );
  }

  if (error) {
    return (
      <Box flexDirection="column">
        <Text bold>System Monitor</Text>
        <Box marginTop={1}>
          <Text color="red">Error: {error}</Text>
        </Box>
        <Box marginTop={1}>
          <Text color="gray">Press 'r' to retry</Text>
        </Box>
      </Box>
    );
  }

  if (!metrics) {
    return (
      <Box flexDirection="column">
        <Text bold>System Monitor</Text>
        <Box marginTop={1}>
          <Text color="gray">No metrics available</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box marginBottom={1} justifyContent="space-between">
        <Box>
          <Text bold>System Monitor</Text>
          <Text color="gray"> • </Text>
          <Text color="gray">Uptime: {formatUptime(metrics.uptime)}</Text>
        </Box>
        <Box>
          <Text color="gray">
            Refresh: {refreshInterval}s • Last: {metrics.timestamp.slice(11, 19)}
          </Text>
        </Box>
      </Box>

      {/* Resource Usage */}
      <Box flexDirection="column" borderStyle="single" paddingX={1} paddingY={1}>
        <Text bold color="cyan" underline>
          Resource Usage
        </Text>
        <Box marginTop={1} flexDirection="column">
          <ProgressBar value={metrics.cpu} label="CPU" />
          <ProgressBar value={metrics.memoryPercent} label="Memory" />
        </Box>
      </Box>

      {/* Metrics Grid */}
      <Box marginTop={1} borderStyle="single" paddingX={1} paddingY={1}>
        <Box flexDirection="column">
          <Text bold color="cyan" underline>
            Metrics
          </Text>
          <Box marginTop={1}>
            <MetricCard
              title="Memory Used"
              value={metrics.memory}
              unit="MB"
              color="cyan"
            />
            <MetricCard
              title="Goroutines"
              value={metrics.goroutines}
              color={metrics.goroutines > 1000 ? "yellow" : "green"}
            />
            <MetricCard
              title="Connections"
              value={metrics.activeConnections}
              color={metrics.activeConnections > 100 ? "yellow" : "green"}
            />
            <MetricCard
              title="CPU"
              value={`${metrics.cpu.toFixed(1)}%`}
              color={getPercentageColor(metrics.cpu)}
            />
          </Box>
        </Box>
      </Box>

      {/* Footer */}
      <Box marginTop={1}>
        <Text color="gray">
          r refresh • q back • Ctrl+C exit
          {isLoading && " • Updating..."}
        </Text>
      </Box>
    </Box>
  );
}
