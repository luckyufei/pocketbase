/**
 * Command Executor for Non-Interactive Mode
 * 
 * This module provides AI-friendly command execution:
 * - Direct command execution without React/Jotai
 * - Structured JSON output for machine parsing
 * - Suitable for MCP Tool Definition integration
 * 
 * Corresponds to Spec Section 11.1 (AI Integration)
 */

import PocketBase from "pocketbase";
import { parseCommand, type ParsedCommand } from "./parser.js";
import { getCommand, COMMANDS, type Command } from "./commands.js";
import { fetchCollections, getCollectionSchema } from "../features/collections/lib/collectionsApi.js";
import { fetchRecords, getRecord, createRecord, updateRecord, deleteRecord } from "../features/records/lib/recordsApi.js";
import { fetchLogs } from "../features/logs/lib/logsApi.js";
import { fetchMetrics } from "../features/monitoring/lib/monitoringApi.js";

/**
 * Execution result types
 */
export interface ExecutionSuccess<T = unknown> {
  success: true;
  command: string;
  data: T;
  message?: string;
}

export interface ExecutionError {
  success: false;
  command: string;
  error: string;
  code?: string;
}

export type ExecutionResult<T = unknown> = ExecutionSuccess<T> | ExecutionError;

/**
 * Collections list result
 */
export interface CollectionsResult {
  collections: Array<{
    id: string;
    name: string;
    type: string;
    recordsCount: number;
  }>;
  total: number;
}

/**
 * Records list result
 */
export interface RecordsResult {
  collection: string;
  records: Array<Record<string, unknown>>;
  page: number;
  perPage: number;
  totalItems: number;
  totalPages: number;
}

/**
 * Single record result
 */
export interface RecordResult {
  collection: string;
  record: Record<string, unknown>;
}

/**
 * Schema result
 */
export interface SchemaResult {
  collection: string;
  id: string;
  type: string;
  fields: Array<{
    name: string;
    type: string;
    required: boolean;
    unique: boolean;
    options?: Record<string, unknown>;
  }>;
  rules?: {
    list: string | null;
    view: string | null;
    create: string | null;
    update: string | null;
    delete: string | null;
  };
}

/**
 * Logs result
 */
export interface LogsResult {
  logs: Array<{
    id: string;
    level: string;
    message: string;
    created: string;
    data?: Record<string, unknown>;
  }>;
  page: number;
  perPage: number;
  totalItems: number;
  totalPages: number;
}

/**
 * Monitor result
 */
export interface MonitorResult {
  cpu: number;
  memory: number;
  goroutines: number;
  uptime: number;
  activeConnections: number;
  timestamp: string;
}

/**
 * Health result
 */
export interface HealthResult {
  healthy: boolean;
  code: number;
  message: string;
}

/**
 * Help result
 */
export interface HelpResult {
  commands: Array<{
    name: string;
    description: string;
    aliases?: string[];
    args?: Array<{
      name: string;
      type: string;
      required: boolean;
      description: string;
    }>;
    examples?: string[];
  }>;
  specificCommand?: Command;
}

/**
 * Create result
 */
export interface CreateResult {
  collection: string;
  record: Record<string, unknown>;
  message: string;
}

/**
 * Update result
 */
export interface UpdateResult {
  collection: string;
  record: Record<string, unknown>;
  message: string;
}

/**
 * Delete result
 */
export interface DeleteResult {
  collection: string;
  id: string;
  message: string;
}

/**
 * Execute a command in non-interactive mode
 * Returns structured data suitable for AI consumption
 */
export async function executeCommandDirect(
  input: string,
  pb: PocketBase
): Promise<ExecutionResult> {
  const parsed = parseCommand(input);
  
  if (!parsed.command) {
    return {
      success: false,
      command: input,
      error: "Invalid command format. Commands must start with /",
      code: "INVALID_FORMAT",
    };
  }
  
  const cmd = getCommand(parsed.command);
  if (!cmd) {
    return {
      success: false,
      command: parsed.command,
      error: `Unknown command: ${parsed.command}. Use /help to see available commands.`,
      code: "UNKNOWN_COMMAND",
    };
  }
  
  try {
    switch (cmd.name) {
      case "/cols": {
        const collections = await fetchCollections(pb);
        const result: CollectionsResult = {
          collections: collections.map(c => ({
            id: c.id,
            name: c.name,
            type: c.type,
            recordsCount: c.recordsCount,
          })),
          total: collections.length,
        };
        return {
          success: true,
          command: "/cols",
          data: result,
        };
      }
      
      case "/view": {
        if (!parsed.resource?.collection) {
          return {
            success: false,
            command: "/view",
            error: "Missing collection. Usage: /view @collection [filter=\"...\"] [sort=\"...\"] [page=N] [perPage=N]",
            code: "MISSING_COLLECTION",
          };
        }
        const fetchResult = await fetchRecords(pb, parsed.resource.collection, {
          filter: parsed.args.filter,
          sort: parsed.args.sort,
          page: parsed.args.page ? parseInt(parsed.args.page) : 1,
          perPage: parsed.args.perPage ? parseInt(parsed.args.perPage) : 20,
        });
        const result: RecordsResult = {
          collection: parsed.resource.collection,
          records: fetchResult.records.map(r => r.data),
          page: fetchResult.page,
          perPage: fetchResult.perPage,
          totalItems: fetchResult.totalItems,
          totalPages: fetchResult.totalPages,
        };
        return {
          success: true,
          command: "/view",
          data: result,
        };
      }
      
      case "/get": {
        if (!parsed.resource?.collection || !parsed.resource?.id) {
          return {
            success: false,
            command: "/get",
            error: "Missing collection or ID. Usage: /get @collection:id",
            code: "MISSING_RESOURCE",
          };
        }
        try {
          const record = await getRecord(pb, parsed.resource.collection, parsed.resource.id);
          const result: RecordResult = {
            collection: parsed.resource.collection,
            record: record.data,
          };
          return {
            success: true,
            command: "/get",
            data: result,
          };
        } catch {
          return {
            success: false,
            command: "/get",
            error: `Record not found: ${parsed.resource.id}`,
            code: "NOT_FOUND",
          };
        }
      }
      
      case "/schema": {
        if (!parsed.resource?.collection) {
          return {
            success: false,
            command: "/schema",
            error: "Missing collection. Usage: /schema @collection",
            code: "MISSING_COLLECTION",
          };
        }
        try {
          const schema = await getCollectionSchema(pb, parsed.resource.collection);
          const result: SchemaResult = {
            collection: schema.name,
            id: schema.id,
            type: schema.type,
            fields: schema.fields,
            rules: schema.rules,
          };
          return {
            success: true,
            command: "/schema",
            data: result,
          };
        } catch {
          return {
            success: false,
            command: "/schema",
            error: `Collection not found: ${parsed.resource.collection}`,
            code: "NOT_FOUND",
          };
        }
      }
      
      case "/logs": {
        // Build filter for level if provided
        let filter = parsed.args.filter || "";
        if (parsed.args.level) {
          // Map level to numeric for PocketBase filter
          const levelMap: Record<string, number> = { error: 8, warn: 4, info: 0 };
          const levelNum = levelMap[parsed.args.level] ?? 0;
          filter = filter ? `${filter} && level=${levelNum}` : `level=${levelNum}`;
        }
        const fetchResult = await fetchLogs(pb, {
          page: parsed.args.page ? parseInt(parsed.args.page) : 1,
          perPage: parsed.args.perPage ? parseInt(parsed.args.perPage) : 100,
          filter,
        });
        const result: LogsResult = {
          logs: fetchResult.logs.map(l => ({
            id: l.id,
            level: l.level,
            message: l.message,
            created: l.timestamp,
            data: l.data,
          })),
          page: fetchResult.page,
          perPage: fetchResult.perPage,
          totalItems: fetchResult.totalItems,
          totalPages: fetchResult.totalPages,
        };
        return {
          success: true,
          command: "/logs",
          data: result,
        };
      }
      
      case "/monitor": {
        const metrics = await fetchMetrics(pb);
        const result: MonitorResult = {
          cpu: metrics.cpu,
          memory: metrics.memory,
          goroutines: metrics.goroutines,
          uptime: metrics.uptime,
          activeConnections: metrics.activeConnections,
          timestamp: metrics.timestamp,
        };
        return {
          success: true,
          command: "/monitor",
          data: result,
        };
      }
      
      case "/health": {
        try {
          const health = await pb.health.check();
          const result: HealthResult = {
            healthy: true,
            code: health.code,
            message: health.message,
          };
          return {
            success: true,
            command: "/health",
            data: result,
          };
        } catch (e) {
          return {
            success: false,
            command: "/health",
            error: `Health check failed: ${(e as Error).message}`,
            code: "HEALTH_CHECK_FAILED",
          };
        }
      }
      
      case "/help": {
        const commandName = parsed.args.command || (parsed.raw.replace("/help", "").trim());
        let specificCommand: Command | undefined;
        
        if (commandName) {
          const normalized = commandName.startsWith("/") ? commandName : `/${commandName}`;
          specificCommand = getCommand(normalized);
        }
        
        const result: HelpResult = {
          commands: COMMANDS.map(c => ({
            name: c.name,
            description: c.description,
            aliases: c.aliases,
            args: c.args,
            examples: c.examples,
          })),
          specificCommand,
        };
        return {
          success: true,
          command: "/help",
          data: result,
        };
      }
      
      case "/create": {
        if (!parsed.resource?.collection) {
          return {
            success: false,
            command: "/create",
            error: "Missing collection. Usage: /create @collection [field=value ...]",
            code: "MISSING_COLLECTION",
          };
        }
        // Parse field values from args
        const data: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(parsed.args)) {
          if (key !== "collection") {
            data[key] = value;
          }
        }
        try {
          const record = await createRecord(pb, parsed.resource.collection, data);
          const result: CreateResult = {
            collection: parsed.resource.collection,
            record: record.data,
            message: `Record created with ID: ${record.id}`,
          };
          return {
            success: true,
            command: "/create",
            data: result,
          };
        } catch (e) {
          return {
            success: false,
            command: "/create",
            error: `Failed to create record: ${(e as Error).message}`,
            code: "CREATE_FAILED",
          };
        }
      }
      
      case "/edit": {
        if (!parsed.resource?.collection || !parsed.resource?.id) {
          return {
            success: false,
            command: "/edit",
            error: "Missing collection or ID. Usage: /edit @collection:id [field=value ...]",
            code: "MISSING_RESOURCE",
          };
        }
        // Parse field values from args
        const data: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(parsed.args)) {
          data[key] = value;
        }
        try {
          const record = await updateRecord(pb, parsed.resource.collection, parsed.resource.id, data);
          const result: UpdateResult = {
            collection: parsed.resource.collection,
            record: record.data,
            message: `Record ${parsed.resource.id} updated`,
          };
          return {
            success: true,
            command: "/edit",
            data: result,
          };
        } catch (e) {
          return {
            success: false,
            command: "/edit",
            error: `Failed to update record: ${(e as Error).message}`,
            code: "UPDATE_FAILED",
          };
        }
      }
      
      case "/delete": {
        if (!parsed.resource?.collection || !parsed.resource?.id) {
          return {
            success: false,
            command: "/delete",
            error: "Missing collection or ID. Usage: /delete @collection:id [-f]",
            code: "MISSING_RESOURCE",
          };
        }
        try {
          await deleteRecord(pb, parsed.resource.collection, parsed.resource.id);
          const result: DeleteResult = {
            collection: parsed.resource.collection,
            id: parsed.resource.id,
            message: `Record ${parsed.resource.id} deleted`,
          };
          return {
            success: true,
            command: "/delete",
            data: result,
          };
        } catch (e) {
          return {
            success: false,
            command: "/delete",
            error: `Failed to delete record: ${(e as Error).message}`,
            code: "DELETE_FAILED",
          };
        }
      }
      
      case "/clear":
      case "/quit": {
        // These commands don't make sense in non-interactive mode
        return {
          success: false,
          command: cmd.name,
          error: `Command ${cmd.name} is only available in interactive mode`,
          code: "INTERACTIVE_ONLY",
        };
      }
      
      default:
        return {
          success: false,
          command: cmd.name,
          error: `Command not implemented: ${cmd.name}`,
          code: "NOT_IMPLEMENTED",
        };
    }
  } catch (error) {
    return {
      success: false,
      command: parsed.command,
      error: (error as Error).message,
      code: "EXECUTION_ERROR",
    };
  }
}

/**
 * Create a configured PocketBase client
 */
export async function createPocketBaseClient(
  url: string,
  options?: {
    token?: string;
    email?: string;
    password?: string;
  }
): Promise<PocketBase> {
  const pb = new PocketBase(url);
  
  if (options?.token) {
    pb.authStore.save(options.token, null);
  } else if (options?.email && options?.password) {
    await pb.collection("_superusers").authWithPassword(options.email, options.password);
  }
  
  return pb;
}

/**
 * Format execution result as JSON string
 */
export function formatResultAsJson(result: ExecutionResult): string {
  return JSON.stringify(result, null, 2);
}

/**
 * Format execution result as human-readable text
 */
export function formatResultAsText(result: ExecutionResult): string {
  if (!result.success) {
    return `Error: ${result.error}`;
  }
  
  // Format based on command type
  const data = result.data;
  
  if (isCollectionsResult(data)) {
    const lines = [`Collections (${data.total}):`];
    for (const col of data.collections) {
      lines.push(`  ${col.name} (${col.type}) - ${col.recordsCount} records`);
    }
    return lines.join("\n");
  }
  
  if (isRecordsResult(data)) {
    const lines = [`Records in ${data.collection} (${data.totalItems} total, page ${data.page}/${data.totalPages}):`];
    for (const record of data.records) {
      lines.push(`  ${JSON.stringify(record)}`);
    }
    return lines.join("\n");
  }
  
  if (isRecordResult(data)) {
    return `Record from ${data.collection}:\n${JSON.stringify(data.record, null, 2)}`;
  }
  
  if (isSchemaResult(data)) {
    const lines = [`Schema for ${data.collection} (${data.type}):`];
    lines.push("Fields:");
    for (const field of data.fields) {
      const flags = [];
      if (field.required) flags.push("required");
      if (field.unique) flags.push("unique");
      lines.push(`  ${field.name}: ${field.type}${flags.length ? ` (${flags.join(", ")})` : ""}`);
    }
    if (data.rules) {
      lines.push("Rules:");
      for (const [rule, value] of Object.entries(data.rules)) {
        lines.push(`  ${rule}: ${value ?? "(none)"}`);
      }
    }
    return lines.join("\n");
  }
  
  if (isHealthResult(data)) {
    return `Health: ${data.healthy ? "OK" : "FAIL"} (code: ${data.code}, message: ${data.message})`;
  }
  
  if (isMonitorResult(data)) {
    return [
      "System Monitor:",
      `  CPU: ${data.cpu}%`,
      `  Memory: ${data.memory} MB`,
      `  Goroutines: ${data.goroutines}`,
      `  Active Connections: ${data.activeConnections}`,
      `  Uptime: ${data.uptime}s`,
      `  Timestamp: ${data.timestamp}`,
    ].filter(Boolean).join("\n");
  }
  
  if (isHelpResult(data)) {
    const lines: string[] = [];
    
    // If specific command requested
    if (data.specificCommand) {
      const cmd = data.specificCommand;
      lines.push(`Command: ${cmd.name}`);
      lines.push(`Description: ${cmd.description}`);
      if (cmd.aliases?.length) {
        lines.push(`Aliases: ${cmd.aliases.join(", ")}`);
      }
      if (cmd.args?.length) {
        lines.push("Arguments:");
        for (const arg of cmd.args) {
          lines.push(`  ${arg.name} (${arg.type}${arg.required ? ", required" : ""}) - ${arg.description}`);
        }
      }
      if (cmd.examples?.length) {
        lines.push("Examples:");
        for (const ex of cmd.examples) {
          lines.push(`  ${ex}`);
        }
      }
    } else {
      // List all commands
      lines.push("Available Commands:");
      for (const cmd of data.commands) {
        lines.push(`  ${cmd.name.padEnd(12)} ${cmd.description}`);
      }
      lines.push("");
      lines.push("Use '/help <command>' for more details on a specific command.");
    }
    
    return lines.join("\n");
  }
  
  if (isLogsResult(data)) {
    const lines = [`Logs (${data.totalItems} total, page ${data.page}/${data.totalPages}):`];
    for (const log of data.logs) {
      const level = log.level.toUpperCase().padEnd(5);
      lines.push(`  [${log.created}] ${level} ${log.message}`);
    }
    return lines.join("\n");
  }
  
  // Default: JSON output
  return JSON.stringify(data, null, 2);
}

// Type guards
function isCollectionsResult(data: unknown): data is CollectionsResult {
  return typeof data === "object" && data !== null && "collections" in data && "total" in data;
}

function isRecordsResult(data: unknown): data is RecordsResult {
  return typeof data === "object" && data !== null && "collection" in data && "records" in data && "totalItems" in data;
}

function isRecordResult(data: unknown): data is RecordResult {
  return typeof data === "object" && data !== null && "collection" in data && "record" in data && !("records" in data);
}

function isSchemaResult(data: unknown): data is SchemaResult {
  return typeof data === "object" && data !== null && "collection" in data && "fields" in data;
}

function isHealthResult(data: unknown): data is HealthResult {
  return typeof data === "object" && data !== null && "healthy" in data && "code" in data;
}

function isMonitorResult(data: unknown): data is MonitorResult {
  return typeof data === "object" && data !== null && "cpu" in data && "memory" in data && "goroutines" in data;
}

function isHelpResult(data: unknown): data is HelpResult {
  return typeof data === "object" && data !== null && "commands" in data && Array.isArray((data as HelpResult).commands);
}

function isLogsResult(data: unknown): data is LogsResult {
  return typeof data === "object" && data !== null && "logs" in data && "totalItems" in data;
}
