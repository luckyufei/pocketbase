/**
 * PocketBase SDK Tests - TDD
 */

import { describe, test, expect, beforeEach, mock } from "bun:test";
import {
  createPBClient,
  setAuthToken,
  getAuthToken,
  clearAuthToken,
  isValidUrl,
  type PBClientConfig,
} from "../../src/lib/pb.js";

describe("PocketBase SDK", () => {
  describe("createPBClient", () => {
    test("should create client with URL", () => {
      const client = createPBClient({ url: "http://localhost:8090" });
      expect(client).toBeDefined();
      expect(client.baseURL).toBe("http://localhost:8090");
    });

    test("should create client with trailing slash URL", () => {
      const client = createPBClient({ url: "http://localhost:8090/" });
      expect(client.baseURL).toBe("http://localhost:8090/");
    });

    test("should set auth token when provided", () => {
      const client = createPBClient({
        url: "http://localhost:8090",
        token: "test_token_123",
      });
      expect(client.authStore.token).toBe("test_token_123");
    });

    test("should have empty auth when no token provided", () => {
      const client = createPBClient({ url: "http://localhost:8090" });
      expect(client.authStore.token).toBe("");
    });
  });

  describe("Auth Token Management", () => {
    beforeEach(() => {
      clearAuthToken();
    });

    test("should set and get auth token", () => {
      setAuthToken("my_token");
      expect(getAuthToken()).toBe("my_token");
    });

    test("should return null when no token set", () => {
      expect(getAuthToken()).toBeNull();
    });

    test("should clear auth token", () => {
      setAuthToken("my_token");
      clearAuthToken();
      expect(getAuthToken()).toBeNull();
    });
  });

  describe("isValidUrl", () => {
    test("should return true for valid http URL", () => {
      expect(isValidUrl("http://localhost:8090")).toBe(true);
    });

    test("should return true for valid https URL", () => {
      expect(isValidUrl("https://example.com")).toBe(true);
    });

    test("should return false for invalid URL", () => {
      expect(isValidUrl("not-a-url")).toBe(false);
    });

    test("should return false for empty string", () => {
      expect(isValidUrl("")).toBe(false);
    });

    test("should return false for ftp URL", () => {
      expect(isValidUrl("ftp://example.com")).toBe(false);
    });
  });
});
