/**
 * Connection Acceptance Tests (STORY-8.4)
 *
 * TDD: Tests for:
 * - T-8.4.1: --url 连接成功 (US9-AC1)
 * - T-8.4.2: 默认连接 127.0.0.1:8090 (US9-AC2)
 * - T-8.4.3: 服务器不可达显示错误并允许重试 (US9-AC3)
 */

import { describe, expect, it, beforeEach, mock } from "bun:test";
import { createStore } from "jotai";
import {
  connectionStateAtom,
  connectionUrlAtom,
  connectionTokenAtom,
  connectionErrorAtom,
  setConnectionStateAtom,
  setConnectionUrlAtom,
  setConnectionTokenAtom,
  setConnectionErrorAtom,
  resetConnectionAtom,
} from "../../../src/features/connection/store/connectionAtoms.js";
import {
  checkConnection,
  parseCliArgs,
  getEnvConfig,
  mergeConfigs,
} from "../../../src/features/connection/lib/connectionApi.js";

// Mock PocketBase
const createMockPBClient = (healthy = true) => ({
  health: {
    check: mock(() =>
      healthy
        ? Promise.resolve({ code: 200, message: "API is healthy" })
        : Promise.reject(new Error("Connection refused"))
    ),
  },
});

describe("Connection Acceptance Tests (STORY-8.4)", () => {
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    store = createStore();
  });

  describe("US9-AC1: --url 连接成功 (T-8.4.1)", () => {
    it("should parse --url http://localhost:8090", () => {
      const args = ["--url", "http://localhost:8090"];
      const config = parseCliArgs(args);

      expect(config.url).toBe("http://localhost:8090");
    });

    it("should connect to specified URL", async () => {
      const pb = createMockPBClient(true);
      const args = ["--url", "http://custom:9000"];
      const config = parseCliArgs(args);

      store.set(setConnectionUrlAtom, config.url!);
      store.set(setConnectionStateAtom, "connecting");

      const connected = await checkConnection(pb as any);
      if (connected) {
        store.set(setConnectionStateAtom, "connected");
      }

      expect(store.get(connectionStateAtom)).toBe("connected");
      expect(store.get(connectionUrlAtom)).toBe("http://custom:9000");
    });

    it("should support HTTPS URLs", async () => {
      const pb = createMockPBClient(true);
      const args = ["--url", "https://secure.example.com"];
      const config = parseCliArgs(args);

      store.set(setConnectionUrlAtom, config.url!);
      expect(store.get(connectionUrlAtom)).toBe("https://secure.example.com");
    });

    it("should parse --token for authentication", () => {
      const args = ["--url", "http://localhost:8090", "--token", "admin-token"];
      const config = parseCliArgs(args);

      expect(config.url).toBe("http://localhost:8090");
      expect(config.token).toBe("admin-token");
    });

    it("should set token in store", () => {
      const args = ["--token", "my-secret"];
      const config = parseCliArgs(args);

      store.set(setConnectionTokenAtom, config.token!);
      expect(store.get(connectionTokenAtom)).toBe("my-secret");
    });
  });

  describe("US9-AC2: 默认连接 127.0.0.1:8090 (T-8.4.2)", () => {
    it("should have default URL of http://127.0.0.1:8090", () => {
      expect(store.get(connectionUrlAtom)).toBe("http://127.0.0.1:8090");
    });

    it("should use default when no --url provided", () => {
      const args: string[] = [];
      const cliConfig = parseCliArgs(args);
      const envConfig = getEnvConfig({});
      const config = mergeConfigs(cliConfig, envConfig);

      expect(config.url).toBe("http://127.0.0.1:8090");
    });

    it("should connect to default URL without arguments", async () => {
      const pb = createMockPBClient(true);

      store.set(setConnectionStateAtom, "connecting");
      const connected = await checkConnection(pb as any);
      if (connected) {
        store.set(setConnectionStateAtom, "connected");
      }

      expect(store.get(connectionStateAtom)).toBe("connected");
      expect(store.get(connectionUrlAtom)).toBe("http://127.0.0.1:8090");
    });

    it("should prioritize CLI over ENV", () => {
      const cliConfig = parseCliArgs(["--url", "http://cli:8090"]);
      const envConfig = getEnvConfig({ POCKETBASE_URL: "http://env:8090" });
      const config = mergeConfigs(cliConfig, envConfig);

      expect(config.url).toBe("http://cli:8090");
    });

    it("should use ENV when CLI not provided", () => {
      const cliConfig = parseCliArgs([]);
      const envConfig = getEnvConfig({ POCKETBASE_URL: "http://env:8090" });
      const config = mergeConfigs(cliConfig, envConfig);

      expect(config.url).toBe("http://env:8090");
    });
  });

  describe("US9-AC3: 服务器不可达显示错误并允许重试 (T-8.4.3)", () => {
    it("should show error when connection fails", async () => {
      const pb = createMockPBClient(false);

      store.set(setConnectionStateAtom, "connecting");

      try {
        await checkConnection(pb as any);
      } catch (error) {
        store.set(setConnectionStateAtom, "error");
        store.set(setConnectionErrorAtom, (error as Error).message);
      }

      expect(store.get(connectionStateAtom)).toBe("error");
      expect(store.get(connectionErrorAtom)).toBe("Connection refused");
    });

    it("should allow retry after error", async () => {
      const failingPb = createMockPBClient(false);

      // First attempt fails
      store.set(setConnectionStateAtom, "connecting");
      try {
        await checkConnection(failingPb as any);
      } catch (error) {
        store.set(setConnectionStateAtom, "error");
        store.set(setConnectionErrorAtom, (error as Error).message);
      }

      expect(store.get(connectionStateAtom)).toBe("error");

      // Retry succeeds
      const workingPb = createMockPBClient(true);
      store.set(setConnectionStateAtom, "connecting");
      store.set(setConnectionErrorAtom, null);

      const connected = await checkConnection(workingPb as any);
      if (connected) {
        store.set(setConnectionStateAtom, "connected");
      }

      expect(store.get(connectionStateAtom)).toBe("connected");
      expect(store.get(connectionErrorAtom)).toBeNull();
    });

    it("should clear error on successful retry", async () => {
      const pb = createMockPBClient(true);

      // Set initial error state
      store.set(setConnectionStateAtom, "error");
      store.set(setConnectionErrorAtom, "Previous error");

      // Retry
      store.set(setConnectionStateAtom, "connecting");
      store.set(setConnectionErrorAtom, null);

      const connected = await checkConnection(pb as any);
      if (connected) {
        store.set(setConnectionStateAtom, "connected");
      }

      expect(store.get(connectionErrorAtom)).toBeNull();
    });

    it("should preserve URL on error", async () => {
      const pb = createMockPBClient(false);
      const customUrl = "http://custom:9000";

      store.set(setConnectionUrlAtom, customUrl);
      store.set(setConnectionStateAtom, "connecting");

      try {
        await checkConnection(pb as any);
      } catch (error) {
        store.set(setConnectionStateAtom, "error");
      }

      // URL should still be the custom one
      expect(store.get(connectionUrlAtom)).toBe(customUrl);
    });
  });

  describe("Environment Variables (T-8.3.5, T-8.3.6)", () => {
    it("should read POCKETBASE_URL from environment", () => {
      const env = { POCKETBASE_URL: "http://from-env:8090" };
      const config = getEnvConfig(env);

      expect(config.url).toBe("http://from-env:8090");
    });

    it("should read POCKETBASE_TOKEN from environment", () => {
      const env = { POCKETBASE_TOKEN: "env-token-123" };
      const config = getEnvConfig(env);

      expect(config.token).toBe("env-token-123");
    });

    it("should apply env config when CLI args empty", () => {
      const cliConfig = parseCliArgs([]);
      const envConfig = getEnvConfig({
        POCKETBASE_URL: "http://env:8090",
        POCKETBASE_TOKEN: "env-token",
      });
      const config = mergeConfigs(cliConfig, envConfig);

      expect(config.url).toBe("http://env:8090");
      expect(config.token).toBe("env-token");
    });
  });

  describe("Reset Connection", () => {
    it("should reset to initial state", () => {
      store.set(setConnectionStateAtom, "connected");
      store.set(setConnectionUrlAtom, "http://custom:9000");
      store.set(setConnectionTokenAtom, "token");
      store.set(setConnectionErrorAtom, "error");

      store.set(resetConnectionAtom);

      expect(store.get(connectionStateAtom)).toBe("disconnected");
      expect(store.get(connectionUrlAtom)).toBe("http://127.0.0.1:8090");
      expect(store.get(connectionTokenAtom)).toBeNull();
      expect(store.get(connectionErrorAtom)).toBeNull();
    });
  });
});
