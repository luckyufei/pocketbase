/**
 * PocketBase TUI - Main Application Component
 * 
 * Integrates all feature modules:
 * - OmniBar for command input
 * - ViewRenderer for displaying different views
 * - Connection management
 * - Keyboard shortcuts
 */

import React, { useEffect, useState, useCallback } from "react";
import { Box, Text, useApp, useInput } from "ink";
import { Provider, useAtom, useAtomValue, useSetAtom } from "jotai";
import PocketBase from "pocketbase";
import { OmniBar } from "./features/omnibar/components/OmniBar.js";
import { ViewRenderer } from "./components/ViewRenderer.js";
import { useCommandRouter } from "./features/commands/hooks/useCommandRouter.js";
import { 
  appStateAtom, 
  currentViewAtom, 
  clearMessagesAtom,
  addMessageAtom,
  type AppState 
} from "./store/appAtoms.js";
import { 
  connectionStateAtom, 
  connectionUrlAtom, 
  connectionTokenAtom 
} from "./features/connection/store/connectionAtoms.js";

/**
 * App props interface
 */
export interface AppProps {
  url: string;
  token?: string;
}

/**
 * Inner App component (uses Jotai hooks)
 */
function AppInner({ url, token }: AppProps): React.ReactElement {
  const { exit } = useApp();
  const [pb, setPb] = useState<PocketBase | null>(null);
  const [appState, setAppState] = useAtom(appStateAtom);
  const [connectionState, setConnectionState] = useAtom(connectionStateAtom);
  const setConnectionUrl = useSetAtom(connectionUrlAtom);
  const setConnectionToken = useSetAtom(connectionTokenAtom);
  const [currentView, setCurrentView] = useAtom(currentViewAtom);
  const clearMessages = useSetAtom(clearMessagesAtom);
  const addMessage = useSetAtom(addMessageAtom);
  
  const { executeCommand } = useCommandRouter();

  // Initialize PocketBase client
  useEffect(() => {
    const client = new PocketBase(url);
    if (token) {
      client.authStore.save(token, null);
    }
    setPb(client);
    setConnectionUrl(url);
    setConnectionToken(token || null);
    
    // Check connection
    setConnectionState("connecting");
    client.health.check()
      .then(() => {
        setConnectionState("connected");
        setAppState("connected");
      })
      .catch((err) => {
        setConnectionState("error");
        setAppState("error");
        addMessage({ type: "error", text: `Connection failed: ${err.message}` });
      });
  }, [url, token]);

  // Handle command execution
  const handleExecute = useCallback(async (input: string) => {
    if (!pb) return;
    
    // Handle /clear specially
    if (input.trim() === "/clear") {
      clearMessages();
      return;
    }
    
    // Handle /quit specially
    if (input.trim() === "/quit" || input.trim() === "/q") {
      exit();
      return;
    }
    
    await executeCommand(input, pb);
  }, [pb, executeCommand, clearMessages, exit]);

  // Global keyboard shortcuts
  useInput((input, key) => {
    if (key.escape) {
      // Go back to dashboard
      if (currentView !== "dashboard") {
        setCurrentView("dashboard");
      }
    } else if (input === "?" && currentView !== "help") {
      setCurrentView("help");
    } else if (key.ctrl && input === "c") {
      exit();
    }
  });

  // Status bar color based on connection
  const statusColor = connectionState === "connected" ? "green" : 
                      connectionState === "connecting" ? "yellow" : "red";

  return (
    <Box flexDirection="column" height="100%">
      {/* Header */}
      <Box marginBottom={1} justifyContent="space-between">
        <Box>
          <Text bold color="blue">PocketBase TUI</Text>
          <Text color="gray"> v0.1.0</Text>
        </Box>
        <Box>
          <Text color="gray">Server: </Text>
          <Text color="cyan">{url}</Text>
          {token && (
            <>
              <Text color="gray"> | Token: </Text>
              <Text color="yellow">****</Text>
            </>
          )}
          <Text color="gray"> | </Text>
          <Text color={statusColor}>
            {connectionState === "connected" ? "● Connected" : 
             connectionState === "connecting" ? "○ Connecting..." : 
             "✗ Disconnected"}
          </Text>
        </Box>
      </Box>

      {/* Main content area */}
      <Box flexDirection="column" flexGrow={1} marginBottom={1}>
        <ViewRenderer />
      </Box>

      {/* OmniBar */}
      <Box borderStyle="single" borderTop paddingX={1}>
        <OmniBar onExecute={handleExecute} />
      </Box>

      {/* Footer hints */}
      <Box>
        <Text color="gray">
          Type / for commands, @ for resources | Esc=back | ?=help | Ctrl+C=quit
        </Text>
      </Box>
    </Box>
  );
}

/**
 * Main application component with Jotai Provider
 */
export function App(props: AppProps): React.ReactElement {
  return (
    <Provider>
      <AppInner {...props} />
    </Provider>
  );
}
