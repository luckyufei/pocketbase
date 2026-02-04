/**
 * Records CRUD API Tests (Task 1.1)
 *
 * TDD: 红灯 → 绿灯
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import PocketBase from "pocketbase";
import {
  createRecord,
  updateRecord,
  deleteRecord,
  deleteRecords,
} from "../../../src/features/records/lib/recordsApi.js";

const TEST_URL = "http://127.0.0.1:8090";
let pb: PocketBase;
let testRecordIds: string[] = [];

beforeAll(async () => {
  pb = new PocketBase(TEST_URL);

  // Authenticate as superuser
  try {
    await pb
      .collection("_superusers")
      .authWithPassword("test@test.com", "test123456");
  } catch {
    // May already be authenticated or test user doesn't exist
  }
});

afterAll(async () => {
  // Cleanup: delete any test records created during tests
  for (const id of testRecordIds) {
    try {
      await pb.collection("posts").delete(id);
    } catch {
      // Ignore cleanup errors
    }
  }
});

describe("Records CRUD API", () => {
  describe("createRecord", () => {
    test("creates record with valid data", async () => {
      const data = {
        title: "Test Create Post",
        content: "Content for test",
        published: true,
      };

      const result = await createRecord(pb, "posts", data);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(typeof result.id).toBe("string");
      expect(result.data.title).toBe("Test Create Post");
      expect(result.data.content).toBe("Content for test");
      expect(result.data.published).toBe(true);

      // Save for cleanup
      testRecordIds.push(result.id);
    });

    test("creates record with minimal required data", async () => {
      const data = {
        title: "Minimal Post",
      };

      const result = await createRecord(pb, "posts", data);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.data.title).toBe("Minimal Post");

      testRecordIds.push(result.id);
    });

    test("throws on invalid collection", async () => {
      const data = { title: "Test" };

      await expect(createRecord(pb, "nonexistent_collection", data)).rejects.toThrow();
    });

    test("throws on missing required field", async () => {
      // posts.title is required
      const data = {
        content: "No title provided",
      };

      await expect(createRecord(pb, "posts", data)).rejects.toThrow();
    });
  });

  describe("updateRecord", () => {
    let existingRecordId: string;

    beforeAll(async () => {
      // Create a record to update
      const created = await pb.collection("posts").create({
        title: "Original Title",
        content: "Original Content",
        published: false,
      });
      existingRecordId = created.id;
      testRecordIds.push(existingRecordId);
    });

    test("updates existing record", async () => {
      const updates = {
        title: "Updated Title",
        published: true,
      };

      const result = await updateRecord(pb, "posts", existingRecordId, updates);

      expect(result).toBeDefined();
      expect(result.id).toBe(existingRecordId);
      expect(result.data.title).toBe("Updated Title");
      expect(result.data.published).toBe(true);
    });

    test("partial update preserves other fields", async () => {
      const updates = {
        content: "New Content Only",
      };

      const result = await updateRecord(pb, "posts", existingRecordId, updates);

      expect(result.data.content).toBe("New Content Only");
      // Title should remain from previous test
      expect(result.data.title).toBe("Updated Title");
    });

    test("throws on record not found", async () => {
      const updates = { title: "Test" };

      await expect(
        updateRecord(pb, "posts", "nonexistent_id_12345", updates)
      ).rejects.toThrow();
    });

    test("throws on invalid collection", async () => {
      const updates = { title: "Test" };

      await expect(
        updateRecord(pb, "nonexistent_collection", "someid", updates)
      ).rejects.toThrow();
    });
  });

  describe("deleteRecord", () => {
    test("deletes existing record", async () => {
      // Create a record to delete
      const created = await pb.collection("posts").create({
        title: "To Be Deleted",
      });

      // Should not throw
      await expect(deleteRecord(pb, "posts", created.id)).resolves.toBeUndefined();

      // Verify it's gone
      await expect(pb.collection("posts").getOne(created.id)).rejects.toThrow();
    });

    test("throws on record not found", async () => {
      await expect(
        deleteRecord(pb, "posts", "nonexistent_id_12345")
      ).rejects.toThrow();
    });

    test("throws on invalid collection", async () => {
      await expect(
        deleteRecord(pb, "nonexistent_collection", "someid")
      ).rejects.toThrow();
    });
  });

  describe("deleteRecords (batch)", () => {
    test("deletes multiple records", async () => {
      // Create records to delete
      const created1 = await pb.collection("posts").create({ title: "Batch Delete 1" });
      const created2 = await pb.collection("posts").create({ title: "Batch Delete 2" });
      const created3 = await pb.collection("posts").create({ title: "Batch Delete 3" });

      const result = await deleteRecords(pb, "posts", [
        created1.id,
        created2.id,
        created3.id,
      ]);

      expect(result.success).toHaveLength(3);
      expect(result.failed).toHaveLength(0);
      expect(result.success).toContain(created1.id);
      expect(result.success).toContain(created2.id);
      expect(result.success).toContain(created3.id);
    });

    test("returns partial success on mixed results", async () => {
      // Create one valid record
      const created = await pb.collection("posts").create({ title: "Valid Record" });

      const result = await deleteRecords(pb, "posts", [
        created.id,
        "invalid_id_1",
        "invalid_id_2",
      ]);

      expect(result.success).toHaveLength(1);
      expect(result.success).toContain(created.id);
      expect(result.failed).toHaveLength(2);
      expect(result.failed).toContain("invalid_id_1");
      expect(result.failed).toContain("invalid_id_2");
    });

    test("handles empty array", async () => {
      const result = await deleteRecords(pb, "posts", []);

      expect(result.success).toHaveLength(0);
      expect(result.failed).toHaveLength(0);
    });
  });
});
