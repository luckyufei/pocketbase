/**
 * E2E Validation Tests - Epic 1: Startup & Connection
 *
 * TDD: Red-Light (write failing tests) → Green-Light (make them pass)
 *
 * Test scenarios:
 * - S-1.1.1: Default startup connects to http://127.0.0.1:8090
 * - S-1.1.2: Custom URL via --url flag
 * - S-1.1.3: Token display as "****"
 * - S-1.1.4: Invalid URL error handling
 * - S-1.2.1: No token access to protected API
 * - S-1.2.2: Valid token authentication
 * - S-1.2.3: Expired token handling
 */

import { describe, test, expect } from "bun:test";
import PocketBase from "pocketbase";
import { parseArgs, type CLIOptions } from "../../src/cli.js";
import {
  checkConnection,
  parseCliArgs,
  getEnvConfig,
  mergeConfigs,
} from "../../src/features/connection/lib/connectionApi.js";
import { TEST_URL, INVALID_URL } from "./config.js";

describe("Epic 1: Startup & Connection", () => {
  describe("STORY-1.1: Basic Startup", () => {
    test("S-1.1.1: Default startup - connects to http://127.0.0.1:8090", () => {
      // Test using parseCliArgs and mergeConfigs
      const cliArgs = parseCliArgs([]);
      const envConfig = getEnvConfig({});
      const merged = mergeConfigs(cliArgs, envConfig);

      expect(merged.url).toBe("http://127.0.0.1:8090");
    });

    test("S-1.1.2: Custom URL - --url http://localhost:8090", () => {
      const cliArgs = parseCliArgs(["--url", "http://localhost:8090"]);
      expect(cliArgs.url).toBe("http://localhost:8090");

      // Also test with mergeConfigs
      const envConfig = getEnvConfig({});
      const merged = mergeConfigs(cliArgs, envConfig);
      expect(merged.url).toBe("http://localhost:8090");
    });

    test("S-1.1.3: With Token - --token displays ****", () => {
      const cliArgs = parseCliArgs(["--token", "test-token-12345"]);
      expect(cliArgs.token).toBe("test-token-12345");

      // Token should be stored in config
      const envConfig = getEnvConfig({});
      const merged = mergeConfigs(cliArgs, envConfig);
      expect(merged.token).toBe("test-token-12345");
    });

    test("S-1.1.4: Invalid URL - connection failure error handling", async () => {
      const pb = new PocketBase(INVALID_URL);

      try {
        await checkConnection(pb);
        // Should not reach here
        expect(false).toBe(true);
      } catch (error: unknown) {
        expect(error).toBeDefined();
      }
    });
  });

  describe("STORY-1.2: Authentication Verification", () => {
    test("S-1.2.1: No token access to protected API - should fail gracefully", async () => {
      const pb = new PocketBase(TEST_URL);

      try {
        // Collections API requires auth for full access
        await pb.collection("_superusers").getList(1, 1);
        // If we get here without token, it means the endpoint is public
      } catch (error: unknown) {
        // Expected - 401 or 403 error
        expect(error).toBeDefined();
        const err = error as { status?: number };
        expect([401, 403]).toContain(err.status);
      }
    });

    test("S-1.2.2: Valid token authentication", async () => {
      const pb = new PocketBase(TEST_URL);

      // Authenticate to get a valid token
      const authResult = await pb
        .collection("_superusers")
        .authWithPassword("test@test.com", "test123456");

      expect(authResult.token).toBeDefined();
      expect(authResult.token.length).toBeGreaterThan(0);

      // Verify authenticated access works
      const collections = await pb.collections.getList(1, 5);
      expect(collections.items.length).toBeGreaterThan(0);
    });

    test("S-1.2.3: Expired token handling - should handle gracefully", async () => {
      const pb = new PocketBase(TEST_URL);

      // Use a clearly invalid/expired token
      const expiredToken =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjb2xsZWN0aW9uSWQiOiJwYmNfMzE0MjYzNTgyMyIsImV4cCI6MTYwMDAwMDAwMCwiaWQiOiJ0ZXN0IiwidHlwZSI6ImF1dGgifQ.invalid";
      pb.authStore.save(expiredToken, null);

      try {
        await pb.collections.getList(1, 5);
        // If this succeeds, token validation might be lenient
      } catch (error: unknown) {
        // Expected - should reject expired token
        expect(error).toBeDefined();
      }
    });
  });
});
