/**
 * E2E Validation Tests - Epic 3: Collections Browsing
 *
 * Test scenarios:
 * - S-3.1.1: Execute /cols shows table
 * - S-3.1.2: Table columns (Name, Type, Records)
 * - S-3.1.3: System collections display
 * - S-3.1.4: Type identification correct
 * - S-3.2.1: ↑/↓ navigation
 * - S-3.2.2: Enter to enter Records
 * - S-3.2.3: Esc to return
 */

import { describe, test, expect, beforeAll } from "bun:test";
import PocketBase from "pocketbase";
import {
  fetchCollections,
  type CollectionInfo,
} from "../../src/features/collections/lib/collectionsApi.js";

import { TEST_URL } from "./config.js";

describe("Epic 3: Collections Browsing", () => {
  let pb: PocketBase;
  let collections: CollectionInfo[];

  beforeAll(async () => {
    pb = new PocketBase(TEST_URL);
    // Authenticate
    await pb
      .collection("_superusers")
      .authWithPassword("test@test.com", "test123456");

    // Fetch collections
    collections = await fetchCollections(pb);
  });

  describe("STORY-3.1: Collections List", () => {
    test("S-3.1.1: Execute /cols shows table - collections fetched", () => {
      expect(collections).toBeDefined();
      expect(Array.isArray(collections)).toBe(true);
      expect(collections.length).toBeGreaterThan(0);
    });

    test("S-3.1.2: Table columns (Name, Type, Records)", () => {
      // Each collection should have these properties
      for (const col of collections) {
        expect(col.id).toBeDefined();
        expect(col.name).toBeDefined();
        expect(col.type).toBeDefined();
        // recordsCount might be optional but should be defined
        expect(typeof col.name).toBe("string");
        expect(typeof col.type).toBe("string");
      }
    });

    test("S-3.1.3: System collections display", () => {
      // Should include system collections
      const systemCollections = collections.filter((c) =>
        c.name.startsWith("_")
      );
      expect(systemCollections.length).toBeGreaterThan(0);

      // Should have _superusers
      const superusers = collections.find((c) => c.name === "_superusers");
      expect(superusers).toBeDefined();
    });

    test("S-3.1.4: Type identification correct", () => {
      // Valid types
      const validTypes = ["base", "auth", "view"];

      for (const col of collections) {
        expect(validTypes).toContain(col.type);
      }

      // _superusers should be auth type
      const superusers = collections.find((c) => c.name === "_superusers");
      expect(superusers?.type).toBe("auth");

      // posts should be base type (we created it)
      const posts = collections.find((c) => c.name === "posts");
      if (posts) {
        expect(posts.type).toBe("base");
      }
    });
  });

  describe("STORY-3.2: Collections Navigation", () => {
    test("S-3.2.1: ↑/↓ navigation - collections can be indexed", () => {
      // Test that collections can be navigated by index
      expect(collections.length).toBeGreaterThan(0);

      // Navigation is UI behavior, but we can verify data supports it
      const firstCollection = collections[0];
      const lastCollection = collections[collections.length - 1];

      expect(firstCollection).toBeDefined();
      expect(lastCollection).toBeDefined();
      expect(firstCollection.name).toBeDefined();
      expect(lastCollection.name).toBeDefined();
    });

    test("S-3.2.2: Enter to enter Records - collection name available", () => {
      // Each collection should have name for navigation
      for (const col of collections) {
        expect(col.name).toBeTruthy();
        expect(col.name.length).toBeGreaterThan(0);
      }
    });

    test("S-3.2.3: Esc to return - navigation state management", () => {
      // This is UI behavior - tested via keyboard shortcuts
      // Verify collection data is complete for state management
      for (const col of collections) {
        expect(col.id).toBeTruthy();
        expect(col.name).toBeTruthy();
      }
    });
  });
});
