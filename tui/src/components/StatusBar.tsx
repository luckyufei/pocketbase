/**
 * StatusBar Component
 * 
 * Displays connection status and server address
 */

import React from "react";
import { Box, Text } from "ink";
import type { AppState } from "../store/appAtoms.js";

export interface StatusBarProps {
  serverUrl: string;
  state: AppState;
  version?: string;
}

/**
 * Status indicator colors
 */
const stateColors: Record<AppState, string> = {
  connected: "green",
  connecting: "yellow",
  disconnected: "gray",
  error: "red",
};

/**
 * Status indicator symbols
 */
const stateSymbols: Record<AppState, string> = {
  connected: "●",
  connecting: "◐",
  disconnected: "○",
  error: "✗",
};

/**
 * StatusBar component showing connection status
 */
export function StatusBar({ serverUrl, state, version = "0.1.0" }: StatusBarProps): React.ReactElement {
  const color = stateColors[state];
  const symbol = stateSymbols[state];

  return (
    <Box justifyContent="space-between">
      <Box>
        <Text bold color="blue">PocketBase TUI</Text>
        <Text color="gray"> v{version}</Text>
      </Box>
      <Box>
        <Text color="gray">Server: </Text>
        <Text color="cyan">{serverUrl}</Text>
        <Text> </Text>
        <Text color={color}>{symbol}</Text>
        <Text color={color}> {state}</Text>
      </Box>
    </Box>
  );
}
