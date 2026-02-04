/**
 * E2E Validation Tests - Epic 12: CRUD Operations
 *
 * Spec: 026-tui-crud
 * Test scenarios:
 * - S-12.1.1 ~ S-12.1.6: Create Record
 * - S-12.2.1 ~ S-12.2.6: Edit Record
 * - S-12.3.1 ~ S-12.3.5: Delete Record
 * - S-12.4.1 ~ S-12.4.4: Form UX
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
import { parseDeleteCommand } from "../../src/features/records/lib/deleteCommand.js";
import {
  enterCreateMode,
  enterEditMode,
  updateFieldValue,
  computeIsDirty,
  setFieldError,
  clearFieldError,
  resetFormState,
} from "../../src/features/records/store/formStateAtom.js";
import {
  openDeleteConfirm,
  closeDeleteConfirm,
} from "../../src/features/records/store/deleteConfirmAtom.js";
import { navigateField } from "../../src/features/records/lib/formNavigation.js";
import {
  validateRequired,
  validateEmail,
  validateForm,
} from "../../src/features/records/lib/fieldValidation.js";
import { shouldConfirmExit } from "../../src/features/records/lib/exitConfirmation.js";
import { getCommand } from "../../src/lib/commands.js";
import {
  parseFieldValue,
  formatFieldValue,
} from "../../src/features/records/lib/fieldTypes.js";

import { TEST_URL } from "./config.js";
let pb: PocketBase;
let testRecordIds: string[] = [];

beforeAll(async () => {
  pb = new PocketBase(TEST_URL);
  try {
    await pb
      .collection("_superusers")
      .authWithPassword("test@test.com", "test123456");
  } catch {
    // Ignore auth errors - will fail individual tests
  }
});

afterAll(async () => {
  // Cleanup test records created during tests
  for (const id of testRecordIds) {
    try {
      await pb.collection("posts").delete(id);
    } catch {
      // Ignore cleanup errors
    }
  }
});

describe("Epic 12: CRUD Operations", () => {
  describe("STORY-12.1: Create Record (创建记录)", () => {
    test("S-12.1.1 /create @collection - API creates new record", async () => {
      const result = await createRecord(pb, "posts", {
        title: "E2E Create Test",
        content: "Created via E2E test",
      });

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.data.title).toBe("E2E Create Test");
      expect(result.data.content).toBe("Created via E2E test");

      testRecordIds.push(result.id);
    });

    test("S-12.1.2 Create form state initialization", () => {
      const state = enterCreateMode("posts", [
        { name: "title", type: "text", required: true },
        { name: "content", type: "text", required: false },
        { name: "published", type: "bool", required: false },
      ]);

      expect(state.mode).toBe("create");
      expect(state.collection).toBe("posts");
      expect(state.currentData).toEqual({});
      expect(state.isDirty).toBe(false);
      expect(state.schema).toHaveLength(3);
      expect(state.schema[0].required).toBe(true);
    });

    test("S-12.1.3 Field value update tracks dirty state", () => {
      let state = enterCreateMode("posts", [
        { name: "title", type: "text", required: true },
      ]);

      expect(state.isDirty).toBe(false);

      state = updateFieldValue(state, "title", "New Title");

      expect(state.currentData.title).toBe("New Title");
      expect(state.isDirty).toBe(true);
    });

    test("S-12.1.4 Create with all field types", async () => {
      const result = await createRecord(pb, "posts", {
        title: "Type Test",
        content: "Content text",
        published: true,
      });

      expect(result.data.title).toBe("Type Test");
      expect(result.data.published).toBe(true);

      testRecordIds.push(result.id);
    });

    test("S-12.1.5 Create form reset on cancel", () => {
      let state = enterCreateMode("posts", []);
      state = updateFieldValue(state, "title", "Unsaved");

      const resetState = resetFormState();

      expect(resetState.mode).toBeNull();
      expect(resetState.currentData).toEqual({});
      expect(resetState.isDirty).toBe(false);
    });

    test("S-12.1.6 Create validation - required fields", () => {
      const result = validateRequired("", true);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("required");

      const validResult = validateRequired("Some Value", true);
      expect(validResult.valid).toBe(true);
    });
  });

  describe("STORY-12.2: Edit Record (编辑记录)", () => {
    let editTestRecordId: string;

    beforeAll(async () => {
      const created = await createRecord(pb, "posts", {
        title: "Edit Test Original",
        content: "Original content",
      });
      editTestRecordId = created.id;
      testRecordIds.push(editTestRecordId);
    });

    test("S-12.2.1 /edit @collection:id - fetch and display record", async () => {
      const record = await getRecord(pb, "posts", editTestRecordId);

      expect(record).toBeDefined();
      expect(record.id).toBe(editTestRecordId);
      expect(record.data.title).toBe("Edit Test Original");
    });

    test("S-12.2.2 Edit form prefilled with current values", () => {
      const state = enterEditMode("posts", editTestRecordId, {
        title: "Edit Test Original",
        content: "Original content",
      });

      expect(state.mode).toBe("edit");
      expect(state.recordId).toBe(editTestRecordId);
      expect(state.currentData.title).toBe("Edit Test Original");
      expect(state.originalData).toEqual({
        title: "Edit Test Original",
        content: "Original content",
      });
    });

    test("S-12.2.3 Edit tracks dirty state correctly", () => {
      let state = enterEditMode("posts", editTestRecordId, {
        title: "Original",
      });

      expect(state.isDirty).toBe(false);

      state = updateFieldValue(state, "title", "Modified");

      expect(state.isDirty).toBe(true);
      expect(state.currentData.title).toBe("Modified");
    });

    test("S-12.2.4 Update record via API (PATCH)", async () => {
      const result = await updateRecord(pb, "posts", editTestRecordId, {
        title: "E2E Updated Title",
      });

      expect(result.data.title).toBe("E2E Updated Title");

      // Verify by fetching again
      const fetched = await getRecord(pb, "posts", editTestRecordId);
      expect(fetched.data.title).toBe("E2E Updated Title");
    });

    test("S-12.2.5 Edit non-existent record returns error", async () => {
      await expect(
        getRecord(pb, "posts", "nonexistent_record_id_xyz")
      ).rejects.toThrow();
    });

    test("S-12.2.6 Exit confirmation for dirty form", () => {
      expect(shouldConfirmExit(true)).toBe(true);
      expect(shouldConfirmExit(false)).toBe(false);
    });
  });

  describe("STORY-12.3: Delete Record (删除记录)", () => {
    test("S-12.3.1 Delete confirm dialog state", () => {
      const state = openDeleteConfirm({
        collection: "posts",
        recordIds: ["test-id"],
        recordInfo: { title: "Test Record" },
      });

      expect(state.isOpen).toBe(true);
      expect(state.collection).toBe("posts");
      expect(state.recordIds).toEqual(["test-id"]);
      expect(state.recordInfo?.title).toBe("Test Record");

      const closedState = closeDeleteConfirm();
      expect(closedState.isOpen).toBe(false);
    });

    test("S-12.3.2 Delete single record via API", async () => {
      // Create a record to delete
      const created = await createRecord(pb, "posts", {
        title: "To Be Deleted",
      });

      // Delete it
      await deleteRecord(pb, "posts", created.id);

      // Verify it's gone
      await expect(getRecord(pb, "posts", created.id)).rejects.toThrow();
    });

    test("S-12.3.3 Delete batch records", async () => {
      // Create records to batch delete
      const r1 = await createRecord(pb, "posts", { title: "Batch Delete 1" });
      const r2 = await createRecord(pb, "posts", { title: "Batch Delete 2" });

      const result = await deleteRecords(pb, "posts", [r1.id, r2.id]);

      expect(result.success).toHaveLength(2);
      expect(result.failed).toHaveLength(0);
    });

    test("S-12.3.4 Delete with partial failures", async () => {
      const created = await createRecord(pb, "posts", {
        title: "Valid Delete",
      });

      const result = await deleteRecords(pb, "posts", [
        created.id,
        "nonexistent_1",
        "nonexistent_2",
      ]);

      expect(result.success).toHaveLength(1);
      expect(result.failed).toHaveLength(2);
    });

    test("S-12.3.5 Parse /delete command with -f flag", () => {
      const result = parseDeleteCommand("/delete @posts:abc123 -f");

      expect(result).not.toBeNull();
      expect(result?.collection).toBe("posts");
      expect(result?.recordIds).toEqual(["abc123"]);
      expect(result?.force).toBe(true);
    });
  });

  describe("STORY-12.4: Form Navigation & UX", () => {
    test("S-12.4.1 Tab navigation forward", () => {
      expect(navigateField(0, 5, "next")).toBe(1);
      expect(navigateField(1, 5, "next")).toBe(2);
      expect(navigateField(4, 5, "next")).toBe(0); // Wrap around
    });

    test("S-12.4.2 Shift+Tab navigation backward", () => {
      expect(navigateField(2, 5, "previous")).toBe(1);
      expect(navigateField(1, 5, "previous")).toBe(0);
      expect(navigateField(0, 5, "previous")).toBe(4); // Wrap around
    });

    test("S-12.4.3 Form error state management", () => {
      let state = enterCreateMode("posts", []);

      state = setFieldError(state, "title", "Title is required");
      expect(state.errors.title).toBe("Title is required");

      state = setFieldError(state, "email", "Invalid email format");
      expect(state.errors.email).toBe("Invalid email format");

      state = clearFieldError(state, "title");
      expect(state.errors.title).toBeUndefined();
      expect(state.errors.email).toBe("Invalid email format");
    });

    test("S-12.4.4 Dirty state computation", () => {
      expect(
        computeIsDirty({ title: "Original" }, { title: "Original" })
      ).toBe(false);

      expect(
        computeIsDirty({ title: "Original" }, { title: "Changed" })
      ).toBe(true);

      expect(
        computeIsDirty(
          { title: "A", content: "B" },
          { title: "A", content: "C" }
        )
      ).toBe(true);
    });
  });

  describe("STORY-12.5: Field Types Parsing", () => {
    test("S-12.5.1 Text field parsing", () => {
      expect(parseFieldValue("text", "Hello World")).toBe("Hello World");
      expect(parseFieldValue("text", "  trimmed  ")).toBe("  trimmed  ");
    });

    test("S-12.5.2 Number field parsing", () => {
      expect(parseFieldValue("number", "42")).toBe(42);
      expect(parseFieldValue("number", "3.14")).toBe(3.14);
      expect(parseFieldValue("number", "invalid")).toBe(0);
    });

    test("S-12.5.3 Boolean field parsing", () => {
      expect(parseFieldValue("bool", "true")).toBe(true);
      expect(parseFieldValue("bool", "false")).toBe(false);
      expect(parseFieldValue("bool", "1")).toBe(true);
      expect(parseFieldValue("bool", "0")).toBe(false);
    });

    test("S-12.5.4 JSON field parsing", () => {
      expect(parseFieldValue("json", '{"key":"value"}')).toEqual({
        key: "value",
      });
      expect(parseFieldValue("json", "[1,2,3]")).toEqual([1, 2, 3]);
    });

    test("S-12.5.5 Field value formatting", () => {
      expect(formatFieldValue("text", "Hello")).toBe("Hello");
      expect(formatFieldValue("number", 42)).toBe("42");
      expect(formatFieldValue("bool", true)).toBe("true");
      expect(formatFieldValue("bool", false)).toBe("false");
    });
  });

  describe("STORY-12.6: Form Validation", () => {
    test("S-12.6.1 Required field validation", () => {
      const emptyResult = validateRequired("", true);
      expect(emptyResult.valid).toBe(false);

      const filledResult = validateRequired("Some value", true);
      expect(filledResult.valid).toBe(true);

      const optionalResult = validateRequired("", false);
      expect(optionalResult.valid).toBe(true);
    });

    test("S-12.6.2 Email field validation", () => {
      const invalidResult = validateEmail("not-an-email");
      expect(invalidResult.valid).toBe(false);

      const validResult = validateEmail("test@example.com");
      expect(validResult.valid).toBe(true);
    });

    test("S-12.6.3 Form-level validation", () => {
      const schema = [
        { name: "title", type: "text", required: true },
        { name: "email", type: "email", required: true },
        { name: "content", type: "text", required: false },
      ];

      const invalidData = { title: "", email: "invalid" };
      // validateForm(schema, data) - schema first, data second
      const invalidResult = validateForm(schema, invalidData);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors.title).toBeDefined();
      expect(invalidResult.errors.email).toBeDefined();

      const validData = { title: "Test", email: "test@test.com" };
      const validResult = validateForm(schema, validData);
      expect(validResult.valid).toBe(true);
      expect(Object.keys(validResult.errors)).toHaveLength(0);
    });
  });

  describe("STORY-12.7: Command Registration", () => {
    test("S-12.7.1 /create command registered", () => {
      const cmd = getCommand("/create");
      expect(cmd).toBeDefined();
      expect(cmd?.name).toBe("/create");
      expect(cmd?.description).toContain("Create");
      expect(cmd?.args?.find((a) => a.name === "collection")).toBeDefined();
    });

    test("S-12.7.2 /edit command registered", () => {
      const cmd = getCommand("/edit");
      expect(cmd).toBeDefined();
      expect(cmd?.name).toBe("/edit");
      expect(cmd?.description).toContain("Edit");
      expect(cmd?.args?.find((a) => a.name === "resource")).toBeDefined();
    });

    test("S-12.7.3 /delete command registered with -f flag", () => {
      const cmd = getCommand("/delete");
      expect(cmd).toBeDefined();
      expect(cmd?.name).toBe("/delete");
      expect(cmd?.description).toContain("Delete");
      expect(cmd?.args?.find((a) => a.name === "resource")).toBeDefined();
      expect(cmd?.args?.find((a) => a.name === "-f")).toBeDefined();
    });

    test("S-12.7.4 Command examples are defined", () => {
      const createCmd = getCommand("/create");
      const editCmd = getCommand("/edit");
      const deleteCmd = getCommand("/delete");

      expect(createCmd?.examples?.length).toBeGreaterThan(0);
      expect(editCmd?.examples?.length).toBeGreaterThan(0);
      expect(deleteCmd?.examples?.length).toBeGreaterThan(0);
    });
  });
});
