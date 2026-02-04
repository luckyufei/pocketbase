#!/usr/bin/env bun
/**
 * PocketBase TUI - CLI Entry Point
 * 
 * Usage:
 *   pbtui                              # Connect to default http://127.0.0.1:8090
 *   pbtui --url http://localhost:8090  # Specify server URL
 *   pbtui --token "admin_token"        # Use admin token
 */

import { Command } from "commander";
import { render } from "ink";
import React from "react";
import { App } from "./app.js";

// Package version
const VERSION = "0.1.0";

/**
 * CLI configuration interface
 */
export interface CLIOptions {
  url: string;
  token?: string;
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
    .parse(args);

  const opts = program.opts();
  return {
    url: opts.url,
    token: opts.token,
  };
}

/**
 * Main entry point
 */
export function main(args: string[] = process.argv): void {
  const options = parseArgs(args);
  
  render(<App url={options.url} token={options.token} />);
}

// Run if executed directly
if (import.meta.main) {
  main();
}
