/**
 * Collections Atoms Tests (STORY-4.1)
 * 
 * TDD: 🔴 Red Phase - Writing tests first
 * Tests for:
 * - T-4.1.1: collectionsAtom (Collections list)
 * - T-4.1.3: activeCollectionAtom (Current selected)
 * - T-4.1.5: isCollectionsLoadingAtom (Loading state)
 */

import { describe, expect, it, beforeEach } from "bun:test";
import { createStore } from "jotai";
import {
  collectionsAtom,
  activeCollectionAtom,
  isCollectionsLoadingAtom,
  collectionsErrorAtom,
  setCollectionsAtom,
  setActiveCollectionAtom,
  setLoadingAtom,
  setErrorAtom,
  clearCollectionsAtom,
  type CollectionInfo,
} from "../../../src/features/collections/store/collectionsAtoms.js";

describe("Collections Atoms", () => {
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    store = createStore();
  });

  describe("collectionsAtom (T-4.1.1, T-4.1.2)", () => {
    it("should have empty initial collections", () => {
      const collections = store.get(collectionsAtom);
      expect(collections).toEqual([]);
    });

    it("should allow setting collections", () => {
      const mockCollections: CollectionInfo[] = [
        { id: "1", name: "users", type: "auth", recordsCount: 100 },
        { id: "2", name: "posts", type: "base", recordsCount: 50 },
      ];

      store.set(setCollectionsAtom, mockCollections);
      const collections = store.get(collectionsAtom);

      expect(collections.length).toBe(2);
      expect(collections[0].name).toBe("users");
      expect(collections[1].name).toBe("posts");
    });

    it("should store collection type (base, auth, view)", () => {
      const mockCollections: CollectionInfo[] = [
        { id: "1", name: "users", type: "auth", recordsCount: 10 },
        { id: "2", name: "posts", type: "base", recordsCount: 20 },
        { id: "3", name: "stats", type: "view", recordsCount: 0 },
      ];

      store.set(setCollectionsAtom, mockCollections);
      const collections = store.get(collectionsAtom);

      expect(collections.find(c => c.name === "users")?.type).toBe("auth");
      expect(collections.find(c => c.name === "posts")?.type).toBe("base");
      expect(collections.find(c => c.name === "stats")?.type).toBe("view");
    });

    it("should store records count", () => {
      const mockCollections: CollectionInfo[] = [
        { id: "1", name: "users", type: "auth", recordsCount: 1000 },
      ];

      store.set(setCollectionsAtom, mockCollections);
      const collections = store.get(collectionsAtom);

      expect(collections[0].recordsCount).toBe(1000);
    });
  });

  describe("activeCollectionAtom (T-4.1.3, T-4.1.4)", () => {
    it("should have null initial active collection", () => {
      const active = store.get(activeCollectionAtom);
      expect(active).toBeNull();
    });

    it("should allow setting active collection", () => {
      const collection: CollectionInfo = { 
        id: "1", 
        name: "users", 
        type: "auth", 
        recordsCount: 100 
      };

      store.set(setActiveCollectionAtom, collection);
      const active = store.get(activeCollectionAtom);

      expect(active?.name).toBe("users");
      expect(active?.id).toBe("1");
    });

    it("should allow setting active collection by name", () => {
      const mockCollections: CollectionInfo[] = [
        { id: "1", name: "users", type: "auth", recordsCount: 100 },
        { id: "2", name: "posts", type: "base", recordsCount: 50 },
      ];

      store.set(setCollectionsAtom, mockCollections);
      store.set(setActiveCollectionAtom, mockCollections[1]);

      const active = store.get(activeCollectionAtom);
      expect(active?.name).toBe("posts");
    });

    it("should allow clearing active collection", () => {
      const collection: CollectionInfo = { 
        id: "1", 
        name: "users", 
        type: "auth", 
        recordsCount: 100 
      };

      store.set(setActiveCollectionAtom, collection);
      store.set(setActiveCollectionAtom, null);

      const active = store.get(activeCollectionAtom);
      expect(active).toBeNull();
    });
  });

  describe("isCollectionsLoadingAtom (T-4.1.5, T-4.1.6)", () => {
    it("should have false initial loading state", () => {
      const isLoading = store.get(isCollectionsLoadingAtom);
      expect(isLoading).toBe(false);
    });

    it("should allow setting loading to true", () => {
      store.set(setLoadingAtom, true);
      expect(store.get(isCollectionsLoadingAtom)).toBe(true);
    });

    it("should allow setting loading to false", () => {
      store.set(setLoadingAtom, true);
      store.set(setLoadingAtom, false);
      expect(store.get(isCollectionsLoadingAtom)).toBe(false);
    });
  });

  describe("collectionsErrorAtom", () => {
    it("should have null initial error", () => {
      const error = store.get(collectionsErrorAtom);
      expect(error).toBeNull();
    });

    it("should allow setting error message", () => {
      store.set(setErrorAtom, "Failed to fetch collections");
      expect(store.get(collectionsErrorAtom)).toBe("Failed to fetch collections");
    });

    it("should allow clearing error", () => {
      store.set(setErrorAtom, "Some error");
      store.set(setErrorAtom, null);
      expect(store.get(collectionsErrorAtom)).toBeNull();
    });
  });

  describe("clearCollectionsAtom", () => {
    it("should clear all collections state", () => {
      // Set some state
      store.set(setCollectionsAtom, [
        { id: "1", name: "users", type: "auth", recordsCount: 100 },
      ]);
      store.set(setActiveCollectionAtom, { 
        id: "1", 
        name: "users", 
        type: "auth", 
        recordsCount: 100 
      });
      store.set(setLoadingAtom, true);
      store.set(setErrorAtom, "Some error");

      // Clear all
      store.set(clearCollectionsAtom);

      expect(store.get(collectionsAtom)).toEqual([]);
      expect(store.get(activeCollectionAtom)).toBeNull();
      expect(store.get(isCollectionsLoadingAtom)).toBe(false);
      expect(store.get(collectionsErrorAtom)).toBeNull();
    });
  });

  describe("Collection filtering and search", () => {
    it("should filter collections by name", () => {
      const mockCollections: CollectionInfo[] = [
        { id: "1", name: "users", type: "auth", recordsCount: 100 },
        { id: "2", name: "user_profiles", type: "base", recordsCount: 50 },
        { id: "3", name: "posts", type: "base", recordsCount: 200 },
      ];

      store.set(setCollectionsAtom, mockCollections);
      const collections = store.get(collectionsAtom);

      const filtered = collections.filter(c => c.name.includes("user"));
      expect(filtered.length).toBe(2);
      expect(filtered.map(c => c.name)).toContain("users");
      expect(filtered.map(c => c.name)).toContain("user_profiles");
    });

    it("should filter collections by type", () => {
      const mockCollections: CollectionInfo[] = [
        { id: "1", name: "users", type: "auth", recordsCount: 100 },
        { id: "2", name: "admins", type: "auth", recordsCount: 5 },
        { id: "3", name: "posts", type: "base", recordsCount: 200 },
      ];

      store.set(setCollectionsAtom, mockCollections);
      const collections = store.get(collectionsAtom);

      const authCollections = collections.filter(c => c.type === "auth");
      expect(authCollections.length).toBe(2);
    });
  });
});
