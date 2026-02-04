/**
 * ErrorBoundary Component
 * 
 * Catches and displays React errors gracefully
 */

import React from "react";
import { Box, Text } from "ink";

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Error boundary to catch React errors
 */
export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error("TUI Error:", error, errorInfo);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Box flexDirection="column" padding={1}>
          <Text color="red" bold>
            ✗ An error occurred
          </Text>
          <Box marginTop={1}>
            <Text color="gray">
              {this.state.error?.message || "Unknown error"}
            </Text>
          </Box>
          <Box marginTop={1}>
            <Text color="gray">
              Press Ctrl+C to exit and restart the application.
            </Text>
          </Box>
        </Box>
      );
    }

    return this.props.children;
  }
}
