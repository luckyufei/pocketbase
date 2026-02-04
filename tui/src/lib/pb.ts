/**
 * PocketBase Client Wrapper
 * 
 * Encapsulates PocketBase SDK initialization and auth management
 * Corresponds to webui/src/lib/ApiClient.ts
 */

import PocketBase from "pocketbase";

/**
 * Configuration for creating a PocketBase client
 */
export interface PBClientConfig {
  url: string;
  token?: string;
}

/**
 * Global auth token storage
 */
let globalAuthToken: string | null = null;

/**
 * Create a new PocketBase client instance
 */
export function createPBClient(config: PBClientConfig): PocketBase {
  const client = new PocketBase(config.url);
  
  if (config.token) {
    // Set the token directly in authStore
    client.authStore.save(config.token, null);
  }
  
  return client;
}

/**
 * Set the global auth token
 */
export function setAuthToken(token: string): void {
  globalAuthToken = token;
}

/**
 * Get the global auth token
 */
export function getAuthToken(): string | null {
  return globalAuthToken;
}

/**
 * Clear the global auth token
 */
export function clearAuthToken(): void {
  globalAuthToken = null;
}

/**
 * Validate if a string is a valid HTTP/HTTPS URL
 */
export function isValidUrl(url: string): boolean {
  if (!url) return false;
  
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Check if the PocketBase server is healthy
 */
export async function checkHealth(client: PocketBase): Promise<boolean> {
  try {
    const health = await client.health.check();
    return health.code === 200;
  } catch {
    return false;
  }
}

/**
 * Default PocketBase URL
 */
export const DEFAULT_PB_URL = "http://127.0.0.1:8090";
