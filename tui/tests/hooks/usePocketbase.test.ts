/**
 * usePocketbase Hook Tests - TDD
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { createStore, Provider } from "jotai";
import { pbClientAtom, pbUrlAtom } from "../../src/hooks/usePocketbase.js";

describe("usePocketbase atoms", () => {
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    store = createStore();
  });

  describe("pbUrlAtom", () => {
    test("should have default URL", () => {
      const url = store.get(pbUrlAtom);
      expect(url).toBe("http://127.0.0.1:8090");
    });

    test("should allow setting URL", () => {
      store.set(pbUrlAtom, "http://example.com:8090");
      expect(store.get(pbUrlAtom)).toBe("http://example.com:8090");
    });
  });

  describe("pbClientAtom", () => {
    test("should create client with default URL", () => {
      const client = store.get(pbClientAtom);
      expect(client).toBeDefined();
      expect(client.baseURL).toBe("http://127.0.0.1:8090");
    });

    test("should create client with custom URL", () => {
      store.set(pbUrlAtom, "http://custom.example.com:9090");
      const client = store.get(pbClientAtom);
      expect(client.baseURL).toBe("http://custom.example.com:9090");
    });
  });
});
