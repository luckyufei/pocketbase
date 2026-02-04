#!/usr/bin/env bun
/**
 * PocketBase TUI - CLI Entry Point
 * 
 * Usage:
 *   pbtui                              # Connect to default http://127.0.0.1:8090
 *   pbtui --url http://localhost:8090  # Specify server URL
 *   pbtui --token "admin_token"        # Use admin token
 *   pbtui --email admin@example.com --password secret  # Login with credentials
 * 
 * AI/Non-Interactive Mode:
 *   pbtui --exec "/cols"               # Execute command and exit
 *   pbtui --exec "/view @users" --json # Execute and output JSON
 *   pbtui --exec "/schema @posts"      # Get collection schema
 */

import { Command } from "commander";
import { render } from "ink";
import React from "react";
import { App } from "./app.js";
import { 
  executeCommandDirect, 
  createPocketBaseClient, 
  formatResultAsJson, 
  formatResultAsText 
} from "./lib/executor.js";

// Package version
const VERSION = "0.1.0";

/**
 * CLI configuration interface
 */
export interface CLIOptions {
  url: string;
  token?: string;
  email?: string;
  password?: string;
  exec?: string;
  json?: boolean;
}

/**
 * Parse CLI arguments and return options
 */
export function parseArgs(args: string[] = process.argv): CLIOptions {
  const program = new Command();

  program
    .name("pbtui")
    .description("Terminal User Interface for PocketBase")
    .version(VERSION, "-v, --version", "Output the current version")
    .option(
      "-u, --url <url>",
      "PocketBase server URL",
      process.env.POCKETBASE_URL || "http://127.0.0.1:8090"
    )
    .option(
      "-t, --token <token>",
      "Admin authentication token",
      process.env.POCKETBASE_TOKEN
    )
    .option(
      "-e, --email <email>",
      "Admin email for authentication",
      process.env.POCKETBASE_EMAIL
    )
    .option(
      "-p, --password <password>",
      "Admin password for authentication",
      process.env.POCKETBASE_PASSWORD
    )
    .option(
      "-x, --exec <command>",
      "Execute a command directly and exit (non-interactive mode)"
    )
    .option(
      "-j, --json",
      "Output results in JSON format (for AI/script consumption)",
      false
    )
    .parse(args);

  const opts = program.opts();
  return {
    url: opts.url,
    token: opts.token,
    email: opts.email,
    password: opts.password,
    exec: opts.exec,
    json: opts.json,
  };
}

/**
 * Execute command in non-interactive mode
 */
async function executeNonInteractive(options: CLIOptions): Promise<void> {
  if (!options.exec) return;
  
  try {
    // Create PocketBase client
    const pb = await createPocketBaseClient(options.url, {
      token: options.token,
      email: options.email,
      password: options.password,
    });
    
    // Execute the command
    const result = await executeCommandDirect(options.exec, pb);
    
    // Output result
    if (options.json) {
      console.log(formatResultAsJson(result));
    } else {
      console.log(formatResultAsText(result));
    }
    
    // Exit with appropriate code
    process.exit(result.success ? 0 : 1);
  } catch (error) {
    const errorResult = {
      success: false,
      command: options.exec,
      error: (error as Error).message,
      code: "CONNECTION_ERROR",
    };
    
    if (options.json) {
      console.log(JSON.stringify(errorResult, null, 2));
    } else {
      console.error(`Error: ${(error as Error).message}`);
    }
    process.exit(1);
  }
}

/**
 * Main entry point
 */
export async function main(args: string[] = process.argv): Promise<void> {
  const options = parseArgs(args);
  
  // Non-interactive mode: execute command and exit
  if (options.exec) {
    await executeNonInteractive(options);
    return;
  }
  
  // Interactive mode: render TUI
  render(<App url={options.url} token={options.token} email={options.email} password={options.password} />);
}

// Run if executed directly
if (import.meta.main) {
  main();
}
