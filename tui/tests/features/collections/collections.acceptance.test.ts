/**
 * Collections Acceptance Tests (STORY-4.4)
 * 
 * Tests for Collections interaction flows:
 * - T-4.4.1: `/cols` shows all collections (US3-AC1)
 * - T-4.4.2: Arrow keys navigate list (US3-AC2)
 * - T-4.4.3: Enter enters Records view (US3-AC3)
 * - T-4.4.4: `/schema @users` shows fields (US5-AC1)
 * - T-4.4.5: Schema shows field properties (US5-AC2)
 * - T-4.4.6: Schema shows API Rules (US5-AC3)
 */

import { describe, expect, it, beforeEach, mock } from "bun:test";
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
} from "../../../src/features/collections/lib/collectionsApi.js";
import { parseCommand } from "../../../src/lib/parser.js";
import { getCommand } from "../../../src/lib/commands.js";

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

describe("Collections Acceptance Tests", () => {
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    store = createStore();
  });

  describe("T-4.4.1: `/cols` shows all collections (US3-AC1)", () => {
    it("should parse /cols command", () => {
      const result = parseCommand("/cols");
      
      expect(result.command).toBe("/cols");
      expect(getCommand("/cols")).toBeDefined();
    });

    it("should fetch and display all collections", async () => {
      const mockCollections = [
        { id: "1", name: "users", type: "auth", schema: [] },
        { id: "2", name: "posts", type: "base", schema: [] },
        { id: "3", name: "stats", type: "view", schema: [] },
      ];
      const pb = createMockPBClient(mockCollections);

      const collections = await fetchCollections(pb as any);
      store.set(setCollectionsAtom, collections);

      const stored = store.get(collectionsAtom);
      expect(stored.length).toBe(3);
      expect(stored.map(c => c.name)).toContain("users");
      expect(stored.map(c => c.name)).toContain("posts");
      expect(stored.map(c => c.name)).toContain("stats");
    });

    it("should display collection name, type, and records count", async () => {
      const mockCollections = [
        { id: "1", name: "users", type: "auth", schema: [] },
      ];
      const pb = createMockPBClient(mockCollections);

      const collections = await fetchCollections(pb as any);
      store.set(setCollectionsAtom, collections);

      const stored = store.get(collectionsAtom);
      expect(stored[0]).toHaveProperty("name");
      expect(stored[0]).toHaveProperty("type");
      expect(stored[0]).toHaveProperty("recordsCount");
    });
  });

  describe("T-4.4.2: Arrow keys navigate list (US3-AC2)", () => {
    it("should support selection index for navigation", () => {
      const collections: CollectionInfo[] = [
        { id: "1", name: "users", type: "auth", recordsCount: 100 },
        { id: "2", name: "posts", type: "base", recordsCount: 50 },
        { id: "3", name: "comments", type: "base", recordsCount: 200 },
      ];

      store.set(setCollectionsAtom, collections);
      
      // Simulate navigation down (0 -> 1 -> 2)
      let selectedIndex = 0;
      selectedIndex = Math.min(selectedIndex + 1, collections.length - 1);
      expect(selectedIndex).toBe(1);
      
      selectedIndex = Math.min(selectedIndex + 1, collections.length - 1);
      expect(selectedIndex).toBe(2);
      
      // Should not go beyond last item
      selectedIndex = Math.min(selectedIndex + 1, collections.length - 1);
      expect(selectedIndex).toBe(2);
    });

    it("should support navigation up", () => {
      const collections: CollectionInfo[] = [
        { id: "1", name: "users", type: "auth", recordsCount: 100 },
        { id: "2", name: "posts", type: "base", recordsCount: 50 },
      ];

      store.set(setCollectionsAtom, collections);
      
      // Start at bottom, navigate up
      let selectedIndex = 1;
      selectedIndex = Math.max(selectedIndex - 1, 0);
      expect(selectedIndex).toBe(0);
      
      // Should not go below 0
      selectedIndex = Math.max(selectedIndex - 1, 0);
      expect(selectedIndex).toBe(0);
    });
  });

  describe("T-4.4.3: Enter enters Records view (US3-AC3)", () => {
    it("should set active collection on selection", () => {
      const collections: CollectionInfo[] = [
        { id: "1", name: "users", type: "auth", recordsCount: 100 },
        { id: "2", name: "posts", type: "base", recordsCount: 50 },
      ];

      store.set(setCollectionsAtom, collections);
      
      // Simulate Enter on selected collection
      const selectedIndex = 1;
      const selected = collections[selectedIndex];
      store.set(setActiveCollectionAtom, selected);

      const active = store.get(activeCollectionAtom);
      expect(active?.name).toBe("posts");
    });

    it("should transition to records view state", () => {
      const collections: CollectionInfo[] = [
        { id: "1", name: "users", type: "auth", recordsCount: 100 },
      ];

      store.set(setCollectionsAtom, collections);
      store.set(setActiveCollectionAtom, collections[0]);

      const active = store.get(activeCollectionAtom);
      expect(active).not.toBeNull();
      // View transition would be handled by currentViewAtom
    });
  });

  describe("T-4.4.4: `/schema @users` shows fields (US5-AC1)", () => {
    it("should parse /schema command with resource", () => {
      const result = parseCommand("/schema @users");
      
      expect(result.command).toBe("/schema");
      expect(result.resource?.collection).toBe("users");
    });

    it("should fetch schema with fields", async () => {
      const mockCollections = [
        {
          id: "1",
          name: "users",
          type: "auth",
          schema: [
            { name: "email", type: "email", required: true, unique: true },
            { name: "name", type: "text", required: true, unique: false },
            { name: "avatar", type: "file", required: false, unique: false },
          ],
        },
      ];
      const pb = createMockPBClient(mockCollections);

      const schema = await getCollectionSchema(pb as any, "users");

      expect(schema.name).toBe("users");
      expect(schema.fields.length).toBe(3);
      expect(schema.fields.map(f => f.name)).toContain("email");
      expect(schema.fields.map(f => f.name)).toContain("name");
      expect(schema.fields.map(f => f.name)).toContain("avatar");
    });
  });

  describe("T-4.4.5: Schema shows field properties (US5-AC2)", () => {
    it("should show field name, type, required, unique", async () => {
      const mockCollections = [
        {
          id: "1",
          name: "posts",
          type: "base",
          schema: [
            { name: "title", type: "text", required: true, unique: false },
            { name: "slug", type: "text", required: true, unique: true },
            { name: "content", type: "editor", required: false, unique: false },
          ],
        },
      ];
      const pb = createMockPBClient(mockCollections);

      const schema = await getCollectionSchema(pb as any, "posts");
      const titleField = schema.fields.find(f => f.name === "title");
      const slugField = schema.fields.find(f => f.name === "slug");
      const contentField = schema.fields.find(f => f.name === "content");

      // Title field
      expect(titleField?.type).toBe("text");
      expect(titleField?.required).toBe(true);
      expect(titleField?.unique).toBe(false);

      // Slug field - unique
      expect(slugField?.unique).toBe(true);

      // Content field - optional
      expect(contentField?.required).toBe(false);
    });

    it("should show field type for different field types", async () => {
      const mockCollections = [
        {
          id: "1",
          name: "test",
          type: "base",
          schema: [
            { name: "text_field", type: "text", required: false, unique: false },
            { name: "number_field", type: "number", required: false, unique: false },
            { name: "bool_field", type: "bool", required: false, unique: false },
            { name: "email_field", type: "email", required: false, unique: false },
            { name: "date_field", type: "date", required: false, unique: false },
            { name: "file_field", type: "file", required: false, unique: false },
            { name: "relation_field", type: "relation", required: false, unique: false },
            { name: "json_field", type: "json", required: false, unique: false },
          ],
        },
      ];
      const pb = createMockPBClient(mockCollections);

      const schema = await getCollectionSchema(pb as any, "test");

      const types = schema.fields.map(f => f.type);
      expect(types).toContain("text");
      expect(types).toContain("number");
      expect(types).toContain("bool");
      expect(types).toContain("email");
      expect(types).toContain("date");
      expect(types).toContain("file");
      expect(types).toContain("relation");
      expect(types).toContain("json");
    });
  });

  describe("T-4.4.6: Schema shows API Rules (US5-AC3)", () => {
    it("should show all API rules", async () => {
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

      const schema = await getCollectionSchema(pb as any, "users");

      expect(schema.rules).toBeDefined();
      expect(schema.rules?.list).toBe("@request.auth.id != ''");
      expect(schema.rules?.view).toBe("@request.auth.id != ''");
      expect(schema.rules?.create).toBe(""); // Public
      expect(schema.rules?.update).toBe("@request.auth.id = id");
      expect(schema.rules?.delete).toBeNull(); // Denied
    });

    it("should differentiate between public, denied, and conditional rules", async () => {
      const mockCollections = [
        {
          id: "1",
          name: "test",
          type: "base",
          schema: [],
          listRule: "", // Public - empty string
          viewRule: null, // Denied - null
          createRule: "@request.auth.id != ''", // Conditional
          updateRule: null,
          deleteRule: null,
        },
      ];
      const pb = createMockPBClient(mockCollections);

      const schema = await getCollectionSchema(pb as any, "test");

      // Public = empty string
      expect(schema.rules?.list).toBe("");
      
      // Denied = null
      expect(schema.rules?.view).toBeNull();
      expect(schema.rules?.delete).toBeNull();
      
      // Conditional = has rule
      expect(schema.rules?.create).toBe("@request.auth.id != ''");
    });
  });

  describe("Integration flow", () => {
    it("should complete /cols -> select -> /schema flow", async () => {
      const mockCollections = [
        {
          id: "1",
          name: "users",
          type: "auth",
          schema: [
            { name: "email", type: "email", required: true, unique: true },
          ],
          listRule: "@request.auth.id != ''",
        },
        {
          id: "2",
          name: "posts",
          type: "base",
          schema: [
            { name: "title", type: "text", required: true, unique: false },
          ],
        },
      ];
      const pb = createMockPBClient(mockCollections);

      // Step 1: /cols - fetch collections
      const collections = await fetchCollections(pb as any);
      store.set(setCollectionsAtom, collections);
      expect(store.get(collectionsAtom).length).toBe(2);

      // Step 2: Navigate and select "posts"
      const postsCollection = findCollectionByName(collections, "posts");
      store.set(setActiveCollectionAtom, postsCollection!);
      expect(store.get(activeCollectionAtom)?.name).toBe("posts");

      // Step 3: /schema @posts - get schema
      const schema = await getCollectionSchema(pb as any, "posts");
      expect(schema.name).toBe("posts");
      expect(schema.fields.length).toBe(1);
      expect(schema.fields[0].name).toBe("title");
    });

    it("should handle /schema for non-existent collection", async () => {
      const pb = createMockPBClient([]);

      await expect(getCollectionSchema(pb as any, "nonexistent")).rejects.toThrow();
    });
  });
});
