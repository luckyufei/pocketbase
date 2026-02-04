/**
 * Layout Component
 * 
 * Main application layout: StatusBar + Content + OmniBar
 */

import React from "react";
import { Box, Text } from "ink";

export interface LayoutProps {
  children: React.ReactNode;
  statusBar?: React.ReactNode;
  omniBar?: React.ReactNode;
}

/**
 * Main layout component with three sections:
 * - StatusBar at top
 * - Content in middle (flex grow)
 * - OmniBar at bottom
 */
export function Layout({ children, statusBar, omniBar }: LayoutProps): React.ReactElement {
  return (
    <Box flexDirection="column" width="100%" height="100%">
      {/* Status Bar */}
      {statusBar && (
        <Box borderStyle="single" borderColor="gray" paddingX={1}>
          {statusBar}
        </Box>
      )}

      {/* Main Content */}
      <Box flexGrow={1} flexDirection="column" paddingX={1}>
        {children}
      </Box>

      {/* OmniBar */}
      {omniBar && (
        <Box borderStyle="single" borderColor="cyan" paddingX={1}>
          {omniBar}
        </Box>
      )}
    </Box>
  );
}
