/**
 * Spinner Component
 * 
 * Loading indicator based on ink-spinner
 */

import React from "react";
import { Box, Text } from "ink";
import InkSpinner from "ink-spinner";

export interface SpinnerProps {
  label?: string;
  type?: "dots" | "line" | "arc" | "bouncingBar";
}

/**
 * Spinner component for loading states
 */
export function Spinner({ label = "Loading...", type = "dots" }: SpinnerProps): React.ReactElement {
  return (
    <Box>
      <Text color="cyan">
        <InkSpinner type={type} />
      </Text>
      <Text> {label}</Text>
    </Box>
  );
}
