/**
 * Commands API
 * 
 * Implementation for general commands (/quit, /help, /clear, /health)
 * Corresponds to EPIC-9: 通用命令
 */

import type PocketBase from "pocketbase";
import { COMMANDS, getCommand, type Command } from "../../../lib/commands";

// Result types
export interface QuitResult {
  type: "quit";
  shouldQuit: boolean;
  message: string;
}

export interface HelpResult {
  type: "help";
  commands: Command[];
  specificCommand?: Command;
  error?: string;
}

export interface ClearResult {
  type: "clear";
  shouldClear: boolean;
  clearSequence: string;
}

export interface HealthResult {
  type: "health";
  healthy: boolean;
  code?: number;
  message?: string;
  responseTime?: number;
  serverUrl?: string;
  error?: string;
}

export type CommandResult = QuitResult | HelpResult | ClearResult | HealthResult;

/**
 * Execute /quit command
 * T-9.1.1, T-9.1.2
 */
export function executeQuitCommand(): QuitResult {
  return {
    type: "quit",
    shouldQuit: true,
    message: "Goodbye! Exiting pbtui...",
  };
}

/**
 * Execute /help command
 * T-9.1.3, T-9.1.4
 */
export function executeHelpCommand(commandName?: string): HelpResult {
  // If no command specified, return all commands
  if (!commandName) {
    return {
      type: "help",
      commands: COMMANDS,
    };
  }
  
  // Normalize command name (add / if missing)
  const normalized = commandName.startsWith("/") ? commandName : `/${commandName}`;
  
  // Find the specific command
  const command = getCommand(normalized);
  
  if (!command) {
    return {
      type: "help",
      commands: COMMANDS,
      error: `Command "${commandName}" is unknown. Available commands listed above.`,
    };
  }
  
  return {
    type: "help",
    commands: COMMANDS,
    specificCommand: command,
  };
}

/**
 * Execute /clear command
 * T-9.1.5, T-9.1.6
 */
export function executeClearCommand(): ClearResult {
  // ANSI escape sequences:
  // \x1b[2J - Clear entire screen
  // \x1b[H - Move cursor to home position (top-left)
  const clearSequence = "\x1b[2J\x1b[H";
  
  return {
    type: "clear",
    shouldClear: true,
    clearSequence,
  };
}

/**
 * Execute /health command
 * T-9.1.7, T-9.1.8
 */
export async function executeHealthCommand(pb: PocketBase): Promise<HealthResult> {
  const startTime = performance.now();
  const serverUrl = pb.baseUrl;
  
  try {
    const response = await pb.health.check();
    const responseTime = performance.now() - startTime;
    
    const healthy = response.code === 200;
    
    return {
      type: "health",
      healthy,
      code: response.code,
      message: response.message,
      responseTime,
      serverUrl,
    };
  } catch (error) {
    const responseTime = performance.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    return {
      type: "health",
      healthy: false,
      responseTime,
      serverUrl,
      error: errorMessage,
    };
  }
}
