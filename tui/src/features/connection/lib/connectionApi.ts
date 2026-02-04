/**
 * Connection API (STORY-8.1)
 *
 * 连接管理 API
 * - T-8.1.1: checkConnection
 * - T-8.3.1~T-8.3.6: CLI args and env config
 */

import type PocketBase from "pocketbase";

/**
 * Connection configuration
 */
export interface ConnectionConfig {
  url?: string;
  token?: string;
}

/**
 * Check if PocketBase server is reachable
 */
export async function checkConnection(pb: PocketBase): Promise<boolean> {
  await pb.health.check();
  return true;
}

/**
 * Parse CLI arguments for connection config
 */
export function parseCliArgs(args: string[]): ConnectionConfig {
  const config: ConnectionConfig = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    if ((arg === "--url" || arg === "-u") && nextArg) {
      config.url = nextArg;
      i++;
    } else if ((arg === "--token" || arg === "-t") && nextArg) {
      config.token = nextArg;
      i++;
    }
  }

  return config;
}

/**
 * Get connection config from environment variables
 */
export function getEnvConfig(
  env: Record<string, string | undefined>
): ConnectionConfig {
  const config: ConnectionConfig = {};

  if (env.POCKETBASE_URL) {
    config.url = env.POCKETBASE_URL;
  }

  if (env.POCKETBASE_TOKEN) {
    config.token = env.POCKETBASE_TOKEN;
  }

  return config;
}

/**
 * Merge configs with priority: CLI > ENV > defaults
 */
export function mergeConfigs(
  cliConfig: ConnectionConfig,
  envConfig: ConnectionConfig,
  defaults: ConnectionConfig = { url: "http://127.0.0.1:8090" }
): ConnectionConfig {
  return {
    url: cliConfig.url ?? envConfig.url ?? defaults.url,
    token: cliConfig.token ?? envConfig.token ?? defaults.token,
  };
}
