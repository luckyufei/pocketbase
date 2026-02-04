/**
 * Connection Tests (STORY-8.1)
 *
 * TDD: 🔴 Red Phase
 * Tests for:
 * - T-8.1.1: useConnection test (连接、断开、重试)
 * - T-8.1.2: Connection state management
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
  type ConnectionState,
} from "../../../src/features/connection/store/connectionAtoms.js";
import {
  checkConnection,
  parseCliArgs,
  getEnvConfig,
  type ConnectionConfig,
} from "../../../src/features/connection/lib/connectionApi.js";

// Mock PocketBase health check
const createMockPBClient = (healthy = true) => ({
  health: {
    check: mock(() =>
      healthy
        ? Promise.resolve({ code: 200, message: "API is healthy" })
        : Promise.reject(new Error("Connection failed"))
    ),
  },
  baseURL: "http://127.0.0.1:8090",
});

describe("Connection Atoms", () => {
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    store = createStore();
  });

  describe("connectionStateAtom", () => {
    it("should have 'disconnected' initial state", () => {
      expect(store.get(connectionStateAtom)).toBe("disconnected");
    });

    it("should allow setting to 'connecting'", () => {
      store.set(setConnectionStateAtom, "connecting");
      expect(store.get(connectionStateAtom)).toBe("connecting");
    });

    it("should allow setting to 'connected'", () => {
      store.set(setConnectionStateAtom, "connected");
      expect(store.get(connectionStateAtom)).toBe("connected");
    });

    it("should allow setting to 'error'", () => {
      store.set(setConnectionStateAtom, "error");
      expect(store.get(connectionStateAtom)).toBe("error");
    });
  });

  describe("connectionUrlAtom", () => {
    it("should have default URL", () => {
      expect(store.get(connectionUrlAtom)).toBe("http://127.0.0.1:8090");
    });

    it("should allow setting custom URL", () => {
      store.set(setConnectionUrlAtom, "http://localhost:9000");
      expect(store.get(connectionUrlAtom)).toBe("http://localhost:9000");
    });

    it("should handle HTTPS URLs", () => {
      store.set(setConnectionUrlAtom, "https://api.example.com");
      expect(store.get(connectionUrlAtom)).toBe("https://api.example.com");
    });
  });

  describe("connectionTokenAtom", () => {
    it("should have null initial token", () => {
      expect(store.get(connectionTokenAtom)).toBeNull();
    });

    it("should allow setting token", () => {
      store.set(setConnectionTokenAtom, "my-admin-token");
      expect(store.get(connectionTokenAtom)).toBe("my-admin-token");
    });

    it("should allow clearing token", () => {
      store.set(setConnectionTokenAtom, "some-token");
      store.set(setConnectionTokenAtom, null);
      expect(store.get(connectionTokenAtom)).toBeNull();
    });
  });

  describe("connectionErrorAtom", () => {
    it("should have null initial error", () => {
      expect(store.get(connectionErrorAtom)).toBeNull();
    });

    it("should allow setting error", () => {
      store.set(setConnectionErrorAtom, "Connection refused");
      expect(store.get(connectionErrorAtom)).toBe("Connection refused");
    });
  });

  describe("resetConnectionAtom", () => {
    it("should reset all connection state", () => {
      store.set(setConnectionStateAtom, "connected");
      store.set(setConnectionUrlAtom, "http://custom:8090");
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

describe("Connection API", () => {
  describe("checkConnection (T-8.1.1)", () => {
    it("should return true for healthy connection", async () => {
      const pb = createMockPBClient(true);
      const result = await checkConnection(pb as any);
      expect(result).toBe(true);
    });

    it("should throw error for unhealthy connection", async () => {
      const pb = createMockPBClient(false);
      await expect(checkConnection(pb as any)).rejects.toThrow();
    });

    it("should call health.check()", async () => {
      const pb = createMockPBClient(true);
      await checkConnection(pb as any);
      expect(pb.health.check).toHaveBeenCalled();
    });
  });

  describe("parseCliArgs (T-8.3.1, T-8.3.3)", () => {
    it("should parse --url argument", () => {
      const args = ["--url", "http://localhost:9000"];
      const config = parseCliArgs(args);
      expect(config.url).toBe("http://localhost:9000");
    });

    it("should parse --token argument", () => {
      const args = ["--token", "my-secret-token"];
      const config = parseCliArgs(args);
      expect(config.token).toBe("my-secret-token");
    });

    it("should parse both arguments", () => {
      const args = ["--url", "http://api.com:8090", "--token", "token123"];
      const config = parseCliArgs(args);
      expect(config.url).toBe("http://api.com:8090");
      expect(config.token).toBe("token123");
    });

    it("should return defaults for empty args", () => {
      const config = parseCliArgs([]);
      expect(config.url).toBeUndefined();
      expect(config.token).toBeUndefined();
    });

    it("should handle -u short form for url", () => {
      const args = ["-u", "http://short:8090"];
      const config = parseCliArgs(args);
      expect(config.url).toBe("http://short:8090");
    });

    it("should handle -t short form for token", () => {
      const args = ["-t", "short-token"];
      const config = parseCliArgs(args);
      expect(config.token).toBe("short-token");
    });
  });

  describe("getEnvConfig (T-8.3.5)", () => {
    it("should read POCKETBASE_URL from environment", () => {
      const env = { POCKETBASE_URL: "http://env:8090" };
      const config = getEnvConfig(env);
      expect(config.url).toBe("http://env:8090");
    });

    it("should read POCKETBASE_TOKEN from environment", () => {
      const env = { POCKETBASE_TOKEN: "env-token" };
      const config = getEnvConfig(env);
      expect(config.token).toBe("env-token");
    });

    it("should read both from environment", () => {
      const env = {
        POCKETBASE_URL: "http://env:9000",
        POCKETBASE_TOKEN: "env-token-123",
      };
      const config = getEnvConfig(env);
      expect(config.url).toBe("http://env:9000");
      expect(config.token).toBe("env-token-123");
    });

    it("should return undefined for missing env vars", () => {
      const config = getEnvConfig({});
      expect(config.url).toBeUndefined();
      expect(config.token).toBeUndefined();
    });
  });
});

describe("Connection State Integration", () => {
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    store = createStore();
  });

  it("should transition from disconnected to connecting to connected", async () => {
    const pb = createMockPBClient(true);

    expect(store.get(connectionStateAtom)).toBe("disconnected");

    store.set(setConnectionStateAtom, "connecting");
    expect(store.get(connectionStateAtom)).toBe("connecting");

    await checkConnection(pb as any);
    store.set(setConnectionStateAtom, "connected");

    expect(store.get(connectionStateAtom)).toBe("connected");
  });

  it("should transition to error state on failure", async () => {
    const pb = createMockPBClient(false);

    store.set(setConnectionStateAtom, "connecting");

    try {
      await checkConnection(pb as any);
    } catch (error) {
      store.set(setConnectionStateAtom, "error");
      store.set(setConnectionErrorAtom, (error as Error).message);
    }

    expect(store.get(connectionStateAtom)).toBe("error");
    expect(store.get(connectionErrorAtom)).toBe("Connection failed");
  });

  it("should support retry after error", async () => {
    const pb = createMockPBClient(false);

    // Initial failure
    store.set(setConnectionStateAtom, "connecting");
    try {
      await checkConnection(pb as any);
    } catch {
      store.set(setConnectionStateAtom, "error");
    }

    expect(store.get(connectionStateAtom)).toBe("error");

    // Retry with working connection
    const workingPb = createMockPBClient(true);
    store.set(setConnectionStateAtom, "connecting");
    store.set(setConnectionErrorAtom, null);

    await checkConnection(workingPb as any);
    store.set(setConnectionStateAtom, "connected");

    expect(store.get(connectionStateAtom)).toBe("connected");
    expect(store.get(connectionErrorAtom)).toBeNull();
  });
});
