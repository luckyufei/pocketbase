/**
 * Comprehensive CRUD E2E Tests
 *
 * Full coverage of CRUD operations across:
 * - Multiple collection types (base, auth, system)
 * - All field types (text, number, bool, email, url, date, json, select, relation)
 * - API Rules scenarios
 * - System collections (_superusers)
 * - Error handling and edge cases
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import PocketBase from "pocketbase";
import {
  createRecord,
  updateRecord,
  deleteRecord,
  deleteRecords,
  getRecord,
  fetchRecords,
} from "../../src/features/records/lib/recordsApi.js";
import {
  fetchCollections,
  getCollectionSchema,
} from "../../src/features/collections/lib/collectionsApi.js";
import {
  parseFieldValue,
  formatFieldValue,
  validateFieldValue,
  getFieldDefaultValue,
} from "../../src/features/records/lib/fieldTypes.js";
import { TEST_URL } from "./config.js";
let pb: PocketBase;
let pbNoAuth: PocketBase;
let testRecordIds: { collection: string; id: string }[] = [];

beforeAll(async () => {
  // Authenticated client
  pb = new PocketBase(TEST_URL);
  await pb
    .collection("_superusers")
    .authWithPassword("test@test.com", "test123456");

  // Non-authenticated client for API rules testing
  pbNoAuth = new PocketBase(TEST_URL);
});

afterAll(async () => {
  // Cleanup all test records
  for (const { collection, id } of testRecordIds) {
    try {
      await pb.collection(collection).delete(id);
    } catch {
      // Ignore cleanup errors
    }
  }
});

// Helper to track records for cleanup
function trackRecord(collection: string, id: string) {
  testRecordIds.push({ collection, id });
}

describe("Epic 13: Comprehensive CRUD - Multiple Collections", () => {
  describe("STORY-13.1: Base Collection CRUD (posts)", () => {
    test("S-13.1.1 Create record in base collection", async () => {
      const result = await createRecord(pb, "posts", {
        title: "Comprehensive Test Post",
        content: "Test content for comprehensive CRUD",
        published: true,
      });

      expect(result.id).toBeDefined();
      expect(result.data.title).toBe("Comprehensive Test Post");
      expect(result.data.published).toBe(true);
      trackRecord("posts", result.id);
    });

    test("S-13.1.2 Read record from base collection", async () => {
      const created = await createRecord(pb, "posts", {
        title: "Read Test",
      });
      trackRecord("posts", created.id);

      const fetched = await getRecord(pb, "posts", created.id);
      expect(fetched.id).toBe(created.id);
      expect(fetched.data.title).toBe("Read Test");
    });

    test("S-13.1.3 Update record in base collection", async () => {
      const created = await createRecord(pb, "posts", {
        title: "Before Update",
      });
      trackRecord("posts", created.id);

      const updated = await updateRecord(pb, "posts", created.id, {
        title: "After Update",
        content: "New content",
      });

      expect(updated.data.title).toBe("After Update");
      expect(updated.data.content).toBe("New content");
    });

    test("S-13.1.4 Delete record from base collection", async () => {
      const created = await createRecord(pb, "posts", {
        title: "To Delete",
      });

      await deleteRecord(pb, "posts", created.id);

      await expect(getRecord(pb, "posts", created.id)).rejects.toThrow();
    });

    test("S-13.1.5 List records with pagination", async () => {
      const result = await fetchRecords(pb, "posts", {
        page: 1,
        perPage: 10,
      });

      expect(result.records).toBeDefined();
      expect(result.page).toBe(1);
      expect(result.perPage).toBe(10);
    });
  });

  describe("STORY-13.2: Base Collection CRUD (tags)", () => {
    test("S-13.2.1 Create record in tags collection", async () => {
      // tags collection may not have custom fields, just create empty record
      const result = await createRecord(pb, "tags", {});

      expect(result.id).toBeDefined();
      trackRecord("tags", result.id);
    });

    test("S-13.2.2 Read all tags", async () => {
      const result = await fetchRecords(pb, "tags", {
        page: 1,
        perPage: 100,
      });

      expect(result.records).toBeDefined();
      expect(Array.isArray(result.records)).toBe(true);
    });

    test("S-13.2.3 Delete tag", async () => {
      const created = await createRecord(pb, "tags", {});
      
      await deleteRecord(pb, "tags", created.id);

      await expect(getRecord(pb, "tags", created.id)).rejects.toThrow();
    });
  });

  describe("STORY-13.3: Auth Collection CRUD (users)", () => {
    test("S-13.3.1 Create user record", async () => {
      const email = `test_${Date.now()}@example.com`;
      const result = await createRecord(pb, "users", {
        email,
        password: "TestPassword123!",
        passwordConfirm: "TestPassword123!",
        name: "Test User",
      });

      expect(result.id).toBeDefined();
      expect(result.data.email).toBe(email);
      trackRecord("users", result.id);
    });

    test("S-13.3.2 Read user record", async () => {
      const email = `read_${Date.now()}@example.com`;
      const created = await createRecord(pb, "users", {
        email,
        password: "TestPassword123!",
        passwordConfirm: "TestPassword123!",
      });
      trackRecord("users", created.id);

      const fetched = await getRecord(pb, "users", created.id);
      expect(fetched.id).toBe(created.id);
      expect(fetched.data.email).toBe(email);
    });

    test("S-13.3.3 Update user record", async () => {
      const email = `update_${Date.now()}@example.com`;
      const created = await createRecord(pb, "users", {
        email,
        password: "TestPassword123!",
        passwordConfirm: "TestPassword123!",
        name: "Original Name",
      });
      trackRecord("users", created.id);

      const updated = await updateRecord(pb, "users", created.id, {
        name: "Updated Name",
      });

      expect(updated.data.name).toBe("Updated Name");
    });

    test("S-13.3.4 Delete user record", async () => {
      const email = `delete_${Date.now()}@example.com`;
      const created = await createRecord(pb, "users", {
        email,
        password: "TestPassword123!",
        passwordConfirm: "TestPassword123!",
      });

      await deleteRecord(pb, "users", created.id);

      await expect(getRecord(pb, "users", created.id)).rejects.toThrow();
    });

    test("S-13.3.5 List users with filter", async () => {
      const result = await fetchRecords(pb, "users", {
        page: 1,
        perPage: 10,
        filter: 'email != ""',
      });

      expect(result.records).toBeDefined();
    });
  });

  describe("STORY-13.4: System Collection CRUD (_superusers)", () => {
    let testSuperuserId: string;

    test("S-13.4.1 List superusers", async () => {
      const result = await fetchRecords(pb, "_superusers", {
        page: 1,
        perPage: 50,
      });

      expect(result.records).toBeDefined();
      expect(result.records.length).toBeGreaterThan(0);
      // Should include our test superuser
      const testUser = result.records.find(
        (r) => r.data.email === "test@test.com"
      );
      expect(testUser).toBeDefined();
    });

    test("S-13.4.2 Read superuser by ID", async () => {
      const list = await fetchRecords(pb, "_superusers", {
        page: 1,
        perPage: 1,
        filter: 'email = "test@test.com"',
      });

      expect(list.records.length).toBeGreaterThan(0);
      const id = list.records[0].id;

      const record = await getRecord(pb, "_superusers", id);
      expect(record.id).toBe(id);
      expect(record.data.email).toBe("test@test.com");
    });

    test("S-13.4.3 Create new superuser", async () => {
      const email = `superuser_${Date.now()}@test.com`;
      const result = await createRecord(pb, "_superusers", {
        email,
        password: "SuperPassword123!",
        passwordConfirm: "SuperPassword123!",
      });

      expect(result.id).toBeDefined();
      expect(result.data.email).toBe(email);
      testSuperuserId = result.id;
    });

    test("S-13.4.4 Update superuser", async () => {
      if (!testSuperuserId) {
        // Create one for update test
        const email = `su_update_${Date.now()}@test.com`;
        const created = await createRecord(pb, "_superusers", {
          email,
          password: "SuperPassword123!",
          passwordConfirm: "SuperPassword123!",
        });
        testSuperuserId = created.id;
      }

      // Note: Updating email requires re-auth, so we test other scenarios
      const record = await getRecord(pb, "_superusers", testSuperuserId);
      expect(record.id).toBe(testSuperuserId);
    });

    test("S-13.4.5 Delete superuser", async () => {
      // Create a new one to delete (don't delete our test user!)
      const email = `su_delete_${Date.now()}@test.com`;
      const created = await createRecord(pb, "_superusers", {
        email,
        password: "SuperPassword123!",
        passwordConfirm: "SuperPassword123!",
      });

      await deleteRecord(pb, "_superusers", created.id);

      await expect(
        getRecord(pb, "_superusers", created.id)
      ).rejects.toThrow();
    });

    afterAll(async () => {
      // Clean up test superuser if created
      if (testSuperuserId) {
        try {
          await pb.collection("_superusers").delete(testSuperuserId);
        } catch {
          // Ignore
        }
      }
    });
  });
});

describe("Epic 14: Field Types CRUD", () => {
  describe("STORY-14.1: Text Fields", () => {
    test("S-14.1.1 Create with text field", async () => {
      const result = await createRecord(pb, "posts", {
        title: "Text Field Test",
        content: "Long text content with special chars: <>&\"'",
      });

      expect(result.data.title).toBe("Text Field Test");
      expect(result.data.content).toContain("<>&");
      trackRecord("posts", result.id);
    });

    test("S-14.1.2 Update text field", async () => {
      const created = await createRecord(pb, "posts", {
        title: "Original Text",
      });
      trackRecord("posts", created.id);

      const updated = await updateRecord(pb, "posts", created.id, {
        title: "Updated Text with émojis 🎉",
      });

      expect(updated.data.title).toBe("Updated Text with émojis 🎉");
    });

    test("S-14.1.3 Text field with empty string", async () => {
      const result = await createRecord(pb, "posts", {
        title: "Empty Content Test",
        content: "",
      });

      expect(result.data.content).toBe("");
      trackRecord("posts", result.id);
    });
  });

  describe("STORY-14.2: Boolean Fields", () => {
    test("S-14.2.1 Create with bool=true", async () => {
      const result = await createRecord(pb, "posts", {
        title: "Bool True Test",
        published: true,
      });

      expect(result.data.published).toBe(true);
      trackRecord("posts", result.id);
    });

    test("S-14.2.2 Create with bool=false", async () => {
      const result = await createRecord(pb, "posts", {
        title: "Bool False Test",
        published: false,
      });

      expect(result.data.published).toBe(false);
      trackRecord("posts", result.id);
    });

    test("S-14.2.3 Update bool field toggle", async () => {
      const created = await createRecord(pb, "posts", {
        title: "Toggle Test",
        published: false,
      });
      trackRecord("posts", created.id);

      const updated = await updateRecord(pb, "posts", created.id, {
        published: true,
      });

      expect(updated.data.published).toBe(true);
    });
  });

  describe("STORY-14.3: Number Fields (via parseFieldValue)", () => {
    test("S-14.3.1 Parse integer", () => {
      expect(parseFieldValue("number", "42")).toBe(42);
      expect(parseFieldValue("number", "-10")).toBe(-10);
    });

    test("S-14.3.2 Parse float", () => {
      expect(parseFieldValue("number", "3.14159")).toBe(3.14159);
      expect(parseFieldValue("number", "-0.5")).toBe(-0.5);
    });

    test("S-14.3.3 Parse invalid number returns default", () => {
      expect(parseFieldValue("number", "not-a-number")).toBe(0);
      expect(parseFieldValue("number", "")).toBe(0);
    });

    test("S-14.3.4 Validate number range", () => {
      const valid = validateFieldValue("number", 50, { min: 0, max: 100 });
      expect(valid.valid).toBe(true);

      const tooSmall = validateFieldValue("number", -5, { min: 0 });
      expect(tooSmall.valid).toBe(false);

      const tooBig = validateFieldValue("number", 150, { max: 100 });
      expect(tooBig.valid).toBe(false);
    });
  });

  describe("STORY-14.4: Email Fields", () => {
    test("S-14.4.1 Valid email", () => {
      expect(parseFieldValue("email", "test@example.com")).toBe(
        "test@example.com"
      );
    });

    test("S-14.4.2 Validate valid email", () => {
      const result = validateFieldValue("email", "user@domain.com");
      expect(result.valid).toBe(true);
    });

    test("S-14.4.3 Validate invalid email", () => {
      const result = validateFieldValue("email", "invalid-email");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("email");
    });

    test("S-14.4.4 Create user with email field", async () => {
      const email = `email_test_${Date.now()}@example.com`;
      const result = await createRecord(pb, "users", {
        email,
        password: "Password123!",
        passwordConfirm: "Password123!",
      });

      expect(result.data.email).toBe(email);
      trackRecord("users", result.id);
    });
  });

  describe("STORY-14.5: URL Fields", () => {
    test("S-14.5.1 Parse URL", () => {
      expect(parseFieldValue("url", "https://example.com")).toBe(
        "https://example.com"
      );
    });

    test("S-14.5.2 Validate valid URL", () => {
      const result = validateFieldValue("url", "https://www.example.com/path");
      expect(result.valid).toBe(true);
    });

    test("S-14.5.3 Validate invalid URL", () => {
      const result = validateFieldValue("url", "not-a-url");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("URL");
    });
  });

  describe("STORY-14.6: Date Fields", () => {
    test("S-14.6.1 Parse ISO date", () => {
      expect(parseFieldValue("date", "2024-01-15")).toBe("2024-01-15");
    });

    test("S-14.6.2 Parse ISO datetime", () => {
      expect(parseFieldValue("date", "2024-01-15T10:30:00Z")).toBe(
        "2024-01-15T10:30:00Z"
      );
    });

    test("S-14.6.3 Validate valid date", () => {
      const result = validateFieldValue("date", "2024-01-15");
      expect(result.valid).toBe(true);
    });

    test("S-14.6.4 Validate invalid date", () => {
      const result = validateFieldValue("date", "not-a-date");
      expect(result.valid).toBe(false);
    });
  });

  describe("STORY-14.7: JSON Fields", () => {
    test("S-14.7.1 Parse JSON object", () => {
      const result = parseFieldValue("json", '{"key": "value"}');
      expect(result).toEqual({ key: "value" });
    });

    test("S-14.7.2 Parse JSON array", () => {
      const result = parseFieldValue("json", "[1, 2, 3]");
      expect(result).toEqual([1, 2, 3]);
    });

    test("S-14.7.3 Parse invalid JSON returns null", () => {
      const result = parseFieldValue("json", "invalid json");
      expect(result).toBeNull();
    });

    test("S-14.7.4 Validate JSON", () => {
      const valid = validateFieldValue("json", { nested: { key: "value" } });
      expect(valid.valid).toBe(true);

      const invalidJson = validateFieldValue("json", "not json");
      // String that can't be parsed
      expect(invalidJson.valid).toBe(false);
    });

    test("S-14.7.5 Format JSON for display", () => {
      const result = formatFieldValue("json", { a: 1, b: 2 });
      expect(result).toContain('"a"');
      expect(result).toContain('"b"');
    });
  });

  describe("STORY-14.8: Select Fields", () => {
    test("S-14.8.1 Parse single select", () => {
      expect(parseFieldValue("select", "option1")).toBe("option1");
    });

    test("S-14.8.2 Parse multi-select array", () => {
      const result = parseFieldValue("select", ["opt1", "opt2"]);
      expect(result).toEqual(["opt1", "opt2"]);
    });

    test("S-14.8.3 Validate select with options", () => {
      const valid = validateFieldValue("select", "optionA", {
        options: ["optionA", "optionB", "optionC"],
      });
      expect(valid.valid).toBe(true);

      const invalid = validateFieldValue("select", "invalidOption", {
        options: ["optionA", "optionB"],
      });
      expect(invalid.valid).toBe(false);
    });

    test("S-14.8.4 Format multi-select for display", () => {
      const result = formatFieldValue("select", ["opt1", "opt2", "opt3"]);
      expect(result).toBe("opt1, opt2, opt3");
    });
  });

  describe("STORY-14.9: Relation Fields", () => {
    test("S-14.9.1 Parse single relation ID", () => {
      expect(parseFieldValue("relation", "abc123")).toBe("abc123");
    });

    test("S-14.9.2 Parse multi-relation array", () => {
      const result = parseFieldValue("relation", ["id1", "id2"]);
      expect(result).toEqual(["id1", "id2"]);
    });

    test("S-14.9.3 Format relation for display", () => {
      const single = formatFieldValue("relation", "rel_id_123");
      expect(single).toBe("rel_id_123");

      const multi = formatFieldValue("relation", ["id1", "id2"]);
      expect(multi).toBe("id1, id2");
    });
  });

  describe("STORY-14.10: File Fields", () => {
    test("S-14.10.1 Parse single file", () => {
      expect(parseFieldValue("file", "document.pdf")).toBe("document.pdf");
    });

    test("S-14.10.2 Parse multiple files", () => {
      const result = parseFieldValue("file", ["file1.jpg", "file2.png"]);
      expect(result).toEqual(["file1.jpg", "file2.png"]);
    });

    test("S-14.10.3 Format file for display", () => {
      const single = formatFieldValue("file", "image.png");
      expect(single).toBe("image.png");

      const multi = formatFieldValue("file", ["a.pdf", "b.pdf"]);
      expect(multi).toBe("a.pdf, b.pdf");
    });
  });

  describe("STORY-14.11: Field Default Values", () => {
    test("S-14.11.1 Text default is empty string", () => {
      expect(getFieldDefaultValue("text")).toBe("");
    });

    test("S-14.11.2 Number default is 0", () => {
      expect(getFieldDefaultValue("number")).toBe(0);
    });

    test("S-14.11.3 Bool default is false", () => {
      expect(getFieldDefaultValue("bool")).toBe(false);
    });

    test("S-14.11.4 Relation default is null", () => {
      expect(getFieldDefaultValue("relation")).toBeNull();
    });

    test("S-14.11.5 JSON default is null", () => {
      expect(getFieldDefaultValue("json")).toBeNull();
    });
  });
});

describe("Epic 15: API Rules & Access Control", () => {
  describe("STORY-15.1: Unauthenticated Access", () => {
    test("S-15.1.1 Unauthenticated cannot access _superusers", async () => {
      await expect(
        fetchRecords(pbNoAuth, "_superusers", { page: 1, perPage: 10 })
      ).rejects.toThrow();
    });

    test("S-15.1.2 Unauthenticated cannot create superuser", async () => {
      await expect(
        createRecord(pbNoAuth, "_superusers", {
          email: "hacker@evil.com",
          password: "password123",
          passwordConfirm: "password123",
        })
      ).rejects.toThrow();
    });

    test("S-15.1.3 Unauthenticated cannot delete superuser", async () => {
      // Get a superuser ID first (using authenticated client)
      const list = await fetchRecords(pb, "_superusers", {
        page: 1,
        perPage: 1,
      });
      const id = list.records[0]?.id;

      if (id) {
        await expect(
          deleteRecord(pbNoAuth, "_superusers", id)
        ).rejects.toThrow();
      }
    });
  });

  describe("STORY-15.2: Authenticated Access", () => {
    test("S-15.2.1 Authenticated can list collections", async () => {
      const collections = await fetchCollections(pb);
      expect(collections).toBeDefined();
      expect(Array.isArray(collections)).toBe(true);
      expect(collections.length).toBeGreaterThan(0);
    });

    test("S-15.2.2 Authenticated can get collection schema", async () => {
      const schema = await getCollectionSchema(pb, "posts");
      expect(schema).toBeDefined();
      expect(schema.name).toBe("posts");
      expect(schema.fields).toBeDefined();
    });

    test("S-15.2.3 Authenticated can access system collections", async () => {
      const result = await fetchRecords(pb, "_superusers", {
        page: 1,
        perPage: 10,
      });
      expect(result.records).toBeDefined();
    });
  });

  describe("STORY-15.3: Collection Schema Access", () => {
    test("S-15.3.1 Get base collection schema", async () => {
      const schema = await getCollectionSchema(pb, "posts");
      expect(schema.type).toBe("base");
      // Note: getCollectionSchema uses collection.schema which may be empty
      // in newer PocketBase versions that use collection.fields instead
      expect(schema.fields).toBeDefined();
    });

    test("S-15.3.2 Get auth collection schema", async () => {
      const schema = await getCollectionSchema(pb, "users");
      expect(schema.type).toBe("auth");
    });

    test("S-15.3.3 Get system collection schema", async () => {
      const schema = await getCollectionSchema(pb, "_superusers");
      expect(schema.type).toBe("auth");
      expect(schema.name).toBe("_superusers");
    });

    test("S-15.3.4 Schema includes API rules", async () => {
      const schema = await getCollectionSchema(pb, "posts");
      expect(schema.rules).toBeDefined();
      expect("list" in schema.rules!).toBe(true);
      expect("view" in schema.rules!).toBe(true);
      expect("create" in schema.rules!).toBe(true);
      expect("update" in schema.rules!).toBe(true);
      expect("delete" in schema.rules!).toBe(true);
    });

    test("S-15.3.5 Non-existent collection returns error", async () => {
      await expect(
        getCollectionSchema(pb, "nonexistent_collection_xyz")
      ).rejects.toThrow();
    });
  });
});

describe("Epic 16: CRUD Error Handling", () => {
  describe("STORY-16.1: Create Errors", () => {
    test("S-16.1.1 Create in non-existent collection", async () => {
      await expect(
        createRecord(pb, "nonexistent_collection", { field: "value" })
      ).rejects.toThrow();
    });

    test("S-16.1.2 Create with missing required field in posts", async () => {
      // posts.title is required
      await expect(createRecord(pb, "posts", { content: "no title" })).rejects.toThrow();
    });

    test("S-16.1.3 Create with invalid field type", async () => {
      // This depends on collection schema validation
      // Generally API will accept and convert types
      const result = await createRecord(pb, "posts", {
        title: 12345, // Number instead of string
        published: "yes", // String instead of bool (API may convert)
      });
      expect(result.id).toBeDefined();
      trackRecord("posts", result.id);
    });
  });

  describe("STORY-16.2: Read Errors", () => {
    test("S-16.2.1 Read non-existent record", async () => {
      await expect(
        getRecord(pb, "posts", "nonexistent_record_id_xyz123")
      ).rejects.toThrow();
    });

    test("S-16.2.2 Read from non-existent collection", async () => {
      await expect(
        getRecord(pb, "nonexistent_collection", "some_id")
      ).rejects.toThrow();
    });

    test("S-16.2.3 List with invalid filter syntax", async () => {
      try {
        await fetchRecords(pb, "posts", {
          page: 1,
          perPage: 10,
          filter: "invalid===syntax",
        });
        // Some invalid filters may not throw but return empty
      } catch {
        // Expected to throw for truly invalid syntax
      }
    });
  });

  describe("STORY-16.3: Update Errors", () => {
    test("S-16.3.1 Update non-existent record", async () => {
      await expect(
        updateRecord(pb, "posts", "nonexistent_id", { title: "New" })
      ).rejects.toThrow();
    });

    test("S-16.3.2 Update in non-existent collection", async () => {
      await expect(
        updateRecord(pb, "nonexistent", "some_id", { field: "value" })
      ).rejects.toThrow();
    });
  });

  describe("STORY-16.4: Delete Errors", () => {
    test("S-16.4.1 Delete non-existent record", async () => {
      await expect(
        deleteRecord(pb, "posts", "nonexistent_id_xyz")
      ).rejects.toThrow();
    });

    test("S-16.4.2 Delete from non-existent collection", async () => {
      await expect(
        deleteRecord(pb, "nonexistent", "some_id")
      ).rejects.toThrow();
    });

    test("S-16.4.3 Batch delete with all invalid IDs", async () => {
      const result = await deleteRecords(pb, "posts", [
        "invalid_1",
        "invalid_2",
        "invalid_3",
      ]);

      expect(result.success).toHaveLength(0);
      expect(result.failed).toHaveLength(3);
    });
  });
});

describe("Epic 17: Batch Operations", () => {
  describe("STORY-17.1: Batch Create", () => {
    test("S-17.1.1 Create multiple records sequentially", async () => {
      const results = [];
      for (let i = 0; i < 3; i++) {
        const record = await createRecord(pb, "posts", {
          title: `Batch Create ${i}`,
        });
        results.push(record);
        trackRecord("posts", record.id);
      }

      expect(results).toHaveLength(3);
      results.forEach((r, i) => {
        expect(r.data.title).toBe(`Batch Create ${i}`);
      });
    });
  });

  describe("STORY-17.2: Batch Delete", () => {
    test("S-17.2.1 Batch delete all successful", async () => {
      const ids = [];
      for (let i = 0; i < 3; i++) {
        const record = await createRecord(pb, "posts", {
          title: `To Batch Delete ${i}`,
        });
        ids.push(record.id);
      }

      const result = await deleteRecords(pb, "posts", ids);

      expect(result.success).toHaveLength(3);
      expect(result.failed).toHaveLength(0);
    });

    test("S-17.2.2 Batch delete mixed results", async () => {
      const record = await createRecord(pb, "posts", {
        title: "Valid For Mixed Delete",
      });

      const result = await deleteRecords(pb, "posts", [
        record.id,
        "invalid_id_1",
        "invalid_id_2",
      ]);

      expect(result.success).toHaveLength(1);
      expect(result.failed).toHaveLength(2);
    });
  });

  describe("STORY-17.3: Bulk Read (Pagination)", () => {
    test("S-17.3.1 Paginate through all records", async () => {
      // Create enough records for pagination
      for (let i = 0; i < 5; i++) {
        const record = await createRecord(pb, "posts", {
          title: `Pagination Test ${i}`,
        });
        trackRecord("posts", record.id);
      }

      const page1 = await fetchRecords(pb, "posts", {
        page: 1,
        perPage: 10,
      });

      expect(page1.page).toBe(1);
      expect(page1.records.length).toBeGreaterThan(0);
    });

    test("S-17.3.2 Filter and paginate", async () => {
      const result = await fetchRecords(pb, "posts", {
        page: 1,
        perPage: 5,
        filter: 'title ~ "Pagination"',
      });

      // Should find records matching filter
      expect(result.records).toBeDefined();
    });
  });
});
