/**
 * Connection Status Component (STORY-8.2)
 *
 * Displays connection status
 */

import React from "react";
import { Box, Text } from "ink";
import type { ConnectionState } from "../store/connectionAtoms.js";

export interface ConnectionStatusProps {
  state: ConnectionState;
  url: string;
  error?: string | null;
  onRetry?: () => void;
}

/**
 * Get color for connection state
 */
function getStateColor(state: ConnectionState): string {
  switch (state) {
    case "connected":
      return "green";
    case "connecting":
      return "yellow";
    case "error":
      return "red";
    case "disconnected":
    default:
      return "gray";
  }
}

/**
 * Get status icon
 */
function getStateIcon(state: ConnectionState): string {
  switch (state) {
    case "connected":
      return "●";
    case "connecting":
      return "◐";
    case "error":
      return "✗";
    case "disconnected":
    default:
      return "○";
  }
}

/**
 * Get status text
 */
function getStateText(state: ConnectionState): string {
  switch (state) {
    case "connected":
      return "Connected";
    case "connecting":
      return "Connecting...";
    case "error":
      return "Error";
    case "disconnected":
    default:
      return "Disconnected";
  }
}

/**
 * Connection Status Component
 */
export function ConnectionStatus({
  state,
  url,
  error,
  onRetry,
}: ConnectionStatusProps): React.ReactElement {
  const color = getStateColor(state);

  return (
    <Box flexDirection="column">
      <Box>
        <Text color={color} bold>
          {getStateIcon(state)}
        </Text>
        <Text> </Text>
        <Text color={color}>{getStateText(state)}</Text>
        <Text> </Text>
        <Text color="gray">• </Text>
        <Text>{url}</Text>
      </Box>

      {state === "error" && error && (
        <Box marginTop={1}>
          <Text color="red">Error: {error}</Text>
        </Box>
      )}

      {state === "error" && (
        <Box marginTop={1}>
          <Text color="gray">Press 'r' to retry connection</Text>
        </Box>
      )}
    </Box>
  );
}
