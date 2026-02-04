/**
 * E2E Validation Tests - Epic 4: Schema View
 *
 * Test scenarios:
 * - S-4.1.1: /schema @users execution
 * - S-4.1.2: Field list display
 * - S-4.1.3: System collection schema
 * - S-4.1.4: Non-existent collection error
 * - S-4.2.1: Rules information display
 * - S-4.2.2: Empty rules handling
 */

import { describe, test, expect, beforeAll } from "bun:test";
import PocketBase from "pocketbase";
import type { CollectionModel } from "pocketbase";

import { TEST_URL } from "./config.js";

describe("Epic 4: Schema View", () => {
  let pb: PocketBase;

  beforeAll(async () => {
    pb = new PocketBase(TEST_URL);
    await pb
      .collection("_superusers")
      .authWithPassword("test@test.com", "test123456");
  });

  describe("STORY-4.1: Schema Display", () => {
    test("S-4.1.1: /schema @users execution - collection schema fetched", async () => {
      const collection = await pb.collections.getOne("users");

      expect(collection).toBeDefined();
      expect(collection.name).toBe("users");
      expect(collection.fields).toBeDefined();
      expect(Array.isArray(collection.fields)).toBe(true);
    });

    test("S-4.1.2: Field list display - fields have required properties", async () => {
      const collection = await pb.collections.getOne("posts");

      expect(collection.fields.length).toBeGreaterThan(0);

      for (const field of collection.fields) {
        expect(field.name).toBeDefined();
        expect(field.type).toBeDefined();
        expect(typeof field.name).toBe("string");
        expect(typeof field.type).toBe("string");
      }

      // Should have our custom fields
      const fieldNames = collection.fields.map((f) => f.name);
      expect(fieldNames).toContain("title");
      expect(fieldNames).toContain("content");
      expect(fieldNames).toContain("published");
    });

    test("S-4.1.3: System collection schema", async () => {
      const superusers = await pb.collections.getOne("_superusers");

      expect(superusers).toBeDefined();
      expect(superusers.type).toBe("auth");
      expect(superusers.fields.length).toBeGreaterThan(0);

      // Auth collections should have email field
      const fieldNames = superusers.fields.map((f) => f.name);
      expect(fieldNames).toContain("email");
    });

    test("S-4.1.4: Non-existent collection error", async () => {
      try {
        await pb.collections.getOne("nonexistent_collection_xyz");
        expect(false).toBe(true); // Should not reach here
      } catch (error: unknown) {
        expect(error).toBeDefined();
        const err = error as { status?: number };
        expect(err.status).toBe(404);
      }
    });
  });

  describe("STORY-4.2: API Rules Display", () => {
    test("S-4.2.1: Rules information display", async () => {
      const collection = await pb.collections.getOne("posts");

      // Rules should be defined (may be empty strings)
      expect("listRule" in collection).toBe(true);
      expect("viewRule" in collection).toBe(true);
      expect("createRule" in collection).toBe(true);
      expect("updateRule" in collection).toBe(true);
      expect("deleteRule" in collection).toBe(true);
    });

    test("S-4.2.2: Empty rules handling - null/empty rules allowed", async () => {
      const collection = await pb.collections.getOne("posts");

      // Rules can be null (unrestricted) or string (restricted)
      const ruleTypes = [
        typeof collection.listRule,
        typeof collection.viewRule,
        typeof collection.createRule,
        typeof collection.updateRule,
        typeof collection.deleteRule,
      ];

      for (const ruleType of ruleTypes) {
        // Rules should be null (any access), string (rule expression), or undefined
        expect(["string", "object"].includes(ruleType)).toBe(true);
      }
    });
  });
});
