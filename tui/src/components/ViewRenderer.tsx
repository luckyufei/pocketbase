/**
 * ViewRenderer Component
 * 
 * Renders the appropriate view based on currentViewAtom
 */

import React from "react";
import { Box, Text, useInput } from "ink";
import { useAtomValue, useAtom } from "jotai";
import { currentViewAtom, messagesAtom, type ViewType } from "../store/appAtoms.js";
import { collectionsAtom, isCollectionsLoadingAtom, collectionsSelectedIndexAtom } from "../features/collections/store/collectionsAtoms.js";
import { recordsAtom, isRecordsLoadingAtom } from "../features/records/store/recordsAtoms.js";
import { logsAtom, isLogsLoadingAtom, logsLevelFilterAtom } from "../features/logs/store/logsAtoms.js";
import { monitoringAtom, isMonitoringLoadingAtom } from "../features/monitoring/store/monitoringAtoms.js";
import { CollectionsList } from "../features/collections/components/CollectionsList.js";
import { RecordsTable } from "../features/records/components/RecordsTable.js";
import { LogStream } from "../features/logs/components/LogStream.js";
import { MonitorDashboard } from "../features/monitoring/components/MonitorDashboard.js";
import { COMMANDS } from "../lib/commands.js";

/**
 * Dashboard/Welcome view
 */
function DashboardView(): React.ReactElement {
  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="cyan">Welcome to PocketBase TUI</Text>
      </Box>
      <Box flexDirection="column">
        <Text color="gray">Quick commands:</Text>
        <Text>  <Text color="yellow">/cols</Text>     - List all collections</Text>
        <Text>  <Text color="yellow">/view @col</Text> - View records in collection</Text>
        <Text>  <Text color="yellow">/logs</Text>     - View server logs</Text>
        <Text>  <Text color="yellow">/monitor</Text>  - View system metrics</Text>
        <Text>  <Text color="yellow">/help</Text>     - Show all commands</Text>
      </Box>
    </Box>
  );
}

/**
 * Help view
 */
function HelpView(): React.ReactElement {
  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="cyan">Available Commands</Text>
      </Box>
      <Box flexDirection="column">
        {COMMANDS.map((cmd) => (
          <Box key={cmd.name} marginBottom={0}>
            <Box width={20}>
              <Text color="yellow">{cmd.name}</Text>
            </Box>
            <Text color="gray">{cmd.description}</Text>
          </Box>
        ))}
      </Box>
      <Box marginTop={1}>
        <Text color="gray">
          Shortcuts: Esc=back, r=refresh, ?=help, Ctrl+C=quit
        </Text>
      </Box>
    </Box>
  );
}

/**
 * Schema view placeholder
 */
function SchemaView({ collection }: { collection: string }): React.ReactElement {
  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="cyan">Schema: {collection}</Text>
      </Box>
      <Text color="gray">Schema view not yet implemented</Text>
    </Box>
  );
}

/**
 * Main ViewRenderer component
 */
export function ViewRenderer(): React.ReactElement {
  const currentView = useAtomValue(currentViewAtom);
  const messages = useAtomValue(messagesAtom);
  
  // Collections
  const collections = useAtomValue(collectionsAtom);
  const isCollectionsLoading = useAtomValue(isCollectionsLoadingAtom);
  const [collectionsSelectedIndex, setCollectionsSelectedIndex] = useAtom(collectionsSelectedIndexAtom);
  
  // Records
  const records = useAtomValue(recordsAtom);
  const isRecordsLoading = useAtomValue(isRecordsLoadingAtom);
  // currentCollection is tracked in command router module
  const currentCollection = "";
  
  // Logs
  const logs = useAtomValue(logsAtom);
  const isLogsLoading = useAtomValue(isLogsLoadingAtom);
  const levelFilter = useAtomValue(logsLevelFilterAtom);
  
  // Monitoring
  const metrics = useAtomValue(monitoringAtom);
  const isMonitoringLoading = useAtomValue(isMonitoringLoadingAtom);

  // Handle keyboard navigation for collections view
  useInput((input, key) => {
    if (currentView === "collections" && !isCollectionsLoading && collections.length > 0) {
      if (key.upArrow) {
        setCollectionsSelectedIndex(Math.max(0, collectionsSelectedIndex - 1));
      } else if (key.downArrow) {
        setCollectionsSelectedIndex(Math.min(collections.length - 1, collectionsSelectedIndex + 1));
      }
    }
  });

  // Show messages
  const latestMessages = messages.slice(-3);

  return (
    <Box flexDirection="column" flexGrow={1}>
      {/* Messages */}
      {latestMessages.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          {latestMessages.map((msg) => (
            <Text 
              key={msg.id} 
              color={
                msg.type === "error" ? "red" : 
                msg.type === "warning" ? "yellow" : 
                msg.type === "success" ? "green" : 
                "gray"
              }
            >
              [{msg.type.toUpperCase()}] {msg.text}
            </Text>
          ))}
        </Box>
      )}
      
      {/* View Content */}
      {currentView === "dashboard" && <DashboardView />}
      
      {currentView === "collections" && (
        isCollectionsLoading ? (
          <Text color="gray">Loading collections...</Text>
        ) : (
          <CollectionsList 
            collections={collections} 
            selectedIndex={collectionsSelectedIndex} 
          />
        )
      )}
      
      {currentView === "records" && (
        isRecordsLoading ? (
          <Text color="gray">Loading records from {currentCollection}...</Text>
        ) : (
          <RecordsTable 
            records={records} 
            selectedIndex={0} 
          />
        )
      )}
      
      {currentView === "schema" && (
        <SchemaView collection={currentCollection || ""} />
      )}
      
      {currentView === "logs" && (
        isLogsLoading ? (
          <Text color="gray">Loading logs...</Text>
        ) : (
          <LogStream 
            logs={logs} 
            levelFilter={levelFilter}
          />
        )
      )}
      
      {currentView === "monitor" && (
        <MonitorDashboard 
          metrics={metrics} 
          isLoading={isMonitoringLoading} 
        />
      )}
      
      {currentView === "help" && <HelpView />}
    </Box>
  );
}
