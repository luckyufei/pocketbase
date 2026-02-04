/**
 * Command Router Hook
 * 
 * Routes parsed commands to appropriate handlers and updates app state
 */

import { useCallback, useRef } from "react";
import { useSetAtom, useAtomValue } from "jotai";
import type PocketBase from "pocketbase";
import { parseCommand, type ParsedCommand } from "../../../lib/parser.js";
import { getCommand } from "../../../lib/commands.js";
import { currentViewAtom, addMessageAtom, type ViewType } from "../../../store/appAtoms.js";
import { 
  setCollectionsAtom, 
  setLoadingAtom as setCollectionsLoadingAtom, 
  setErrorAtom as setCollectionsErrorAtom, 
  setActiveCollectionAtom,
  collectionsAtom,
  type CollectionInfo 
} from "../../collections/store/collectionsAtoms.js";
import { 
  setRecordsAtom, 
  setLoadingAtom as setRecordsLoadingAtom, 
  setErrorAtom as setRecordsErrorAtom,
  recordsFilterAtom,
  setFilterAtom 
} from "../../records/store/recordsAtoms.js";
import { setLogsAtom, setLoadingAtom as setLogsLoadingAtom, setLevelFilterAtom } from "../../logs/store/logsAtoms.js";
import { setMonitoringAtom, setMonitoringLoadingAtom } from "../../monitoring/store/monitoringAtoms.js";
import { fetchCollections } from "../../collections/lib/collectionsApi.js";
import { fetchRecords } from "../../records/lib/recordsApi.js";
import { fetchLogs } from "../../logs/lib/logsApi.js";
import { fetchMetrics } from "../../monitoring/lib/monitoringApi.js";
import type { LogLevel } from "../../logs/store/logsAtoms.js";

export interface UseCommandRouterResult {
  executeCommand: (input: string, pb: PocketBase) => Promise<boolean>;
  shouldQuit: boolean;
}

// Track current collection name for records
let currentCollectionName = "";

/**
 * Hook for routing commands to handlers
 */
export function useCommandRouter(): UseCommandRouterResult {
  const setCurrentView = useSetAtom(currentViewAtom);
  const addMessage = useSetAtom(addMessageAtom);
  
  // Collections state
  const setCollections = useSetAtom(setCollectionsAtom);
  const setCollectionsLoading = useSetAtom(setCollectionsLoadingAtom);
  const setActiveCollection = useSetAtom(setActiveCollectionAtom);
  const collections = useAtomValue(collectionsAtom);
  
  // Records state
  const setRecords = useSetAtom(setRecordsAtom);
  const setRecordsLoading = useSetAtom(setRecordsLoadingAtom);
  
  // Logs state
  const setLogs = useSetAtom(setLogsAtom);
  const setLogsLoading = useSetAtom(setLogsLoadingAtom);
  const setLevelFilter = useSetAtom(setLevelFilterAtom);
  
  // Monitoring state
  const setMonitoring = useSetAtom(setMonitoringAtom);
  const setMonitoringLoading = useSetAtom(setMonitoringLoadingAtom);

  const shouldQuitRef = useRef(false);

  const executeCommand = useCallback(async (input: string, pb: PocketBase): Promise<boolean> => {
    const parsed = parseCommand(input);
    
    if (!parsed.command) {
      return false;
    }
    
    const cmd = getCommand(parsed.command);
    if (!cmd) {
      addMessage({ type: "error", text: `Unknown command: ${parsed.command}` });
      return false;
    }
    
    try {
      switch (cmd.name) {
        case "/cols": {
          setCollectionsLoading(true);
          const result = await fetchCollections(pb);
          setCollections(result);
          setCollectionsLoading(false);
          setCurrentView("collections");
          return true;
        }
        
        case "/view": {
          if (!parsed.resource?.collection) {
            addMessage({ type: "error", text: "Usage: /view @collection" });
            return false;
          }
          setRecordsLoading(true);
          currentCollectionName = parsed.resource.collection;
          const result = await fetchRecords(pb, parsed.resource.collection, {
            filter: parsed.args.filter,
            sort: parsed.args.sort,
            page: parsed.args.page ? parseInt(parsed.args.page) : 1,
            perPage: parsed.args.perPage ? parseInt(parsed.args.perPage) : 20,
          });
          setRecords(result.records);
          setRecordsLoading(false);
          setCurrentView("records");
          return true;
        }
        
        case "/schema": {
          if (!parsed.resource?.collection) {
            addMessage({ type: "error", text: "Usage: /schema @collection" });
            return false;
          }
          // Find collection in list
          const col = collections.find(c => c.name === parsed.resource?.collection);
          if (col) {
            setActiveCollection(col);
          }
          currentCollectionName = parsed.resource.collection;
          setCurrentView("schema");
          return true;
        }
        
        case "/get": {
          if (!parsed.resource?.collection || !parsed.resource?.id) {
            addMessage({ type: "error", text: "Usage: /get @collection:id" });
            return false;
          }
          currentCollectionName = parsed.resource.collection;
          try {
            const record = await pb.collection(parsed.resource.collection).getOne(parsed.resource.id);
            setRecords([{
              id: record.id,
              created: record.created,
              updated: record.updated,
              collectionId: record.collectionId,
              collectionName: record.collectionName,
              data: record,
            }]);
            setCurrentView("records");
          } catch (e) {
            addMessage({ type: "error", text: `Record not found: ${parsed.resource.id}` });
            return false;
          }
          return true;
        }
        
        case "/logs": {
          setLogsLoading(true);
          if (parsed.args.level) {
            setLevelFilter(parsed.args.level as LogLevel);
          }
          const result = await fetchLogs(pb, {
            page: 1,
            perPage: 100,
          });
          setLogs(result.logs);
          setLogsLoading(false);
          setCurrentView("logs");
          return true;
        }
        
        case "/monitor": {
          setMonitoringLoading(true);
          const metrics = await fetchMetrics(pb);
          setMonitoring(metrics);
          setMonitoringLoading(false);
          setCurrentView("monitor");
          return true;
        }
        
        case "/health": {
          try {
            const health = await pb.health.check();
            addMessage({ 
              type: "success", 
              text: `Server healthy: ${health.message} (code: ${health.code})` 
            });
          } catch (e) {
            addMessage({ type: "error", text: `Health check failed: ${(e as Error).message}` });
          }
          return true;
        }
        
        case "/help": {
          setCurrentView("help");
          return true;
        }
        
        case "/clear": {
          // Clear is handled by the App component
          return true;
        }
        
        case "/quit": {
          shouldQuitRef.current = true;
          return true;
        }
        
        default:
          addMessage({ type: "warning", text: `Command not implemented: ${cmd.name}` });
          return false;
      }
    } catch (error) {
      addMessage({ type: "error", text: `Error: ${(error as Error).message}` });
      return false;
    }
  }, [
    setCurrentView, addMessage,
    setCollections, setCollectionsLoading, setActiveCollection, collections,
    setRecords, setRecordsLoading,
    setLogs, setLogsLoading, setLevelFilter,
    setMonitoring, setMonitoringLoading,
  ]);

  return {
    executeCommand,
    shouldQuit: shouldQuitRef.current,
  };
}

/**
 * Get current collection name (for display purposes)
 */
export function getCurrentCollectionName(): string {
  return currentCollectionName;
}
