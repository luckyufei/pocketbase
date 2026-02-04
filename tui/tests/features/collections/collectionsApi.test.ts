/**
 * useCollections Hook Tests (STORY-4.2)
 * 
 * TDD: Tests for Collections hook functionality
 * - T-4.2.1: useCollections test (get list)
 * - T-4.2.3: getSchema test
 */

import { describe, expect, it, beforeEach, mock, afterEach } from "bun:test";
import { createStore } from "jotai";
import {
  collectionsAtom,
  activeCollectionAtom,
  isCollectionsLoadingAtom,
  collectionsErrorAtom,
  setCollectionsAtom,
  setActiveCollectionAtom,
  type CollectionInfo,
} from "../../../src/features/collections/store/collectionsAtoms.js";
import {
  fetchCollections,
  getCollectionSchema,
  findCollectionByName,
  type CollectionSchema,
  type SchemaField,
} from "../../../src/features/collections/lib/collectionsApi.js";

// Mock PocketBase client
const createMockPBClient = (collections: any[] = []) => ({
  collections: {
    getFullList: mock(() => Promise.resolve(collections)),
    getOne: mock((name: string) => {
      const col = collections.find(c => c.name === name);
      if (!col) throw new Error("Collection not found");
      return Promise.resolve(col);
    }),
  },
});

describe("Collections API", () => {
  describe("fetchCollections (T-4.2.1, T-4.2.2)", () => {
    it("should fetch collections list", async () => {
      const mockCollections = [
        { id: "1", name: "users", type: "auth", schema: [] },
        { id: "2", name: "posts", type: "base", schema: [] },
      ];
      const pb = createMockPBClient(mockCollections);

      const result = await fetchCollections(pb as any);

      expect(result.length).toBe(2);
      expect(result[0].name).toBe("users");
      expect(result[1].name).toBe("posts");
    });

    it("should transform collection response to CollectionInfo", async () => {
      const mockCollections = [
        { 
          id: "1", 
          name: "users", 
          type: "auth",
          schema: [
            { name: "email", type: "email" },
            { name: "name", type: "text" },
          ]
        },
      ];
      const pb = createMockPBClient(mockCollections);

      const result = await fetchCollections(pb as any);

      expect(result[0]).toHaveProperty("id");
      expect(result[0]).toHaveProperty("name");
      expect(result[0]).toHaveProperty("type");
    });

    it("should handle empty collections", async () => {
      const pb = createMockPBClient([]);

      const result = await fetchCollections(pb as any);

      expect(result).toEqual([]);
    });

    it("should handle network error", async () => {
      const pb = {
        collections: {
          getFullList: mock(() => Promise.reject(new Error("Network error"))),
        },
      };

      await expect(fetchCollections(pb as any)).rejects.toThrow("Network error");
    });
  });

  describe("getCollectionSchema (T-4.2.3, T-4.2.4)", () => {
    it("should fetch collection schema", async () => {
      const mockCollections = [
        {
          id: "1",
          name: "users",
          type: "auth",
          schema: [
            { name: "email", type: "email", required: true, unique: true },
            { name: "name", type: "text", required: true, unique: false },
            { name: "age", type: "number", required: false, unique: false },
          ],
          listRule: "@request.auth.id != ''",
          viewRule: "@request.auth.id != ''",
          createRule: null,
          updateRule: "@request.auth.id = id",
          deleteRule: null,
        },
      ];
      const pb = createMockPBClient(mockCollections);

      const result = await getCollectionSchema(pb as any, "users");

      expect(result.name).toBe("users");
      expect(result.type).toBe("auth");
      expect(result.fields.length).toBe(3);
    });

    it("should include field properties", async () => {
      const mockCollections = [
        {
          id: "1",
          name: "posts",
          type: "base",
          schema: [
            { 
              name: "title", 
              type: "text", 
              required: true, 
              unique: false,
              options: { min: 1, max: 200 }
            },
            { 
              name: "published", 
              type: "bool", 
              required: false, 
              unique: false 
            },
          ],
        },
      ];
      const pb = createMockPBClient(mockCollections);

      const result = await getCollectionSchema(pb as any, "posts");
      const titleField = result.fields.find(f => f.name === "title");

      expect(titleField?.type).toBe("text");
      expect(titleField?.required).toBe(true);
      expect(titleField?.unique).toBe(false);
    });

    it("should include API rules", async () => {
      const mockCollections = [
        {
          id: "1",
          name: "users",
          type: "auth",
          schema: [],
          listRule: "@request.auth.id != ''",
          viewRule: "@request.auth.id != ''",
          createRule: "",
          updateRule: "@request.auth.id = id",
          deleteRule: null,
        },
      ];
      const pb = createMockPBClient(mockCollections);

      const result = await getCollectionSchema(pb as any, "users");

      expect(result.rules).toBeDefined();
      expect(result.rules?.list).toBe("@request.auth.id != ''");
      expect(result.rules?.view).toBe("@request.auth.id != ''");
      expect(result.rules?.create).toBe("");
      expect(result.rules?.update).toBe("@request.auth.id = id");
      expect(result.rules?.delete).toBeNull();
    });

    it("should handle collection not found", async () => {
      const pb = createMockPBClient([]);

      await expect(getCollectionSchema(pb as any, "nonexistent")).rejects.toThrow();
    });
  });

  describe("findCollectionByName", () => {
    it("should find collection by exact name", () => {
      const collections: CollectionInfo[] = [
        { id: "1", name: "users", type: "auth", recordsCount: 100 },
        { id: "2", name: "posts", type: "base", recordsCount: 50 },
      ];

      const result = findCollectionByName(collections, "users");

      expect(result?.name).toBe("users");
      expect(result?.id).toBe("1");
    });

    it("should return undefined for non-existent collection", () => {
      const collections: CollectionInfo[] = [
        { id: "1", name: "users", type: "auth", recordsCount: 100 },
      ];

      const result = findCollectionByName(collections, "posts");

      expect(result).toBeUndefined();
    });

    it("should be case-sensitive", () => {
      const collections: CollectionInfo[] = [
        { id: "1", name: "users", type: "auth", recordsCount: 100 },
      ];

      const result = findCollectionByName(collections, "USERS");

      expect(result).toBeUndefined();
    });
  });
});

describe("Collections State Integration", () => {
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    store = createStore();
  });

  it("should integrate fetched collections with store", async () => {
    const mockCollections = [
      { id: "1", name: "users", type: "auth", schema: [] },
      { id: "2", name: "posts", type: "base", schema: [] },
    ];
    const pb = createMockPBClient(mockCollections);

    const fetched = await fetchCollections(pb as any);
    store.set(setCollectionsAtom, fetched);

    const storedCollections = store.get(collectionsAtom);
    expect(storedCollections.length).toBe(2);
  });

  it("should set active collection from store", async () => {
    const mockCollections = [
      { id: "1", name: "users", type: "auth", schema: [] },
    ];
    const pb = createMockPBClient(mockCollections);

    const fetched = await fetchCollections(pb as any);
    store.set(setCollectionsAtom, fetched);
    store.set(setActiveCollectionAtom, fetched[0]);

    const active = store.get(activeCollectionAtom);
    expect(active?.name).toBe("users");
  });
});
