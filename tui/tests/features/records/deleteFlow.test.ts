/**
 * Delete Flow Tests (Task 2.1-2.3)
 *
 * TDD: 红灯 → 绿灯
 * Note: React components don't need unit tests per spec
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { createStore } from "jotai";
import {
  deleteConfirmAtom,
  openDeleteConfirm,
  closeDeleteConfirm,
  type DeleteConfirmState,
} from "../../../src/features/records/store/deleteConfirmAtom.js";

describe("Delete Confirm State (Task 2.2)", () => {
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    store = createStore();
  });

  test("initial state is closed", () => {
    const state = store.get(deleteConfirmAtom);
    
    expect(state.isOpen).toBe(false);
    expect(state.collection).toBeNull();
    expect(state.recordIds).toHaveLength(0);
    expect(state.recordInfo).toBeNull();
  });

  test("opens with single record info", () => {
    const recordInfo = { id: "abc123", title: "Test Post" };
    
    store.set(deleteConfirmAtom, openDeleteConfirm({
      collection: "posts",
      recordIds: ["abc123"],
      recordInfo,
    }));
    
    const state = store.get(deleteConfirmAtom);
    
    expect(state.isOpen).toBe(true);
    expect(state.collection).toBe("posts");
    expect(state.recordIds).toEqual(["abc123"]);
    expect(state.recordInfo).toEqual(recordInfo);
  });

  test("opens with multiple record IDs", () => {
    store.set(deleteConfirmAtom, openDeleteConfirm({
      collection: "posts",
      recordIds: ["id1", "id2", "id3"],
      recordInfo: null,
    }));
    
    const state = store.get(deleteConfirmAtom);
    
    expect(state.isOpen).toBe(true);
    expect(state.recordIds).toHaveLength(3);
    expect(state.recordIds).toContain("id1");
    expect(state.recordIds).toContain("id2");
    expect(state.recordIds).toContain("id3");
  });

  test("closes and resets state", () => {
    // First open
    store.set(deleteConfirmAtom, openDeleteConfirm({
      collection: "posts",
      recordIds: ["abc123"],
      recordInfo: { id: "abc123" },
    }));
    
    // Then close
    store.set(deleteConfirmAtom, closeDeleteConfirm());
    
    const state = store.get(deleteConfirmAtom);
    
    expect(state.isOpen).toBe(false);
    expect(state.collection).toBeNull();
    expect(state.recordIds).toHaveLength(0);
    expect(state.recordInfo).toBeNull();
  });

  test("supports batch delete display", () => {
    store.set(deleteConfirmAtom, openDeleteConfirm({
      collection: "posts",
      recordIds: ["id1", "id2", "id3", "id4", "id5"],
      recordInfo: null,
    }));
    
    const state = store.get(deleteConfirmAtom);
    
    expect(state.isOpen).toBe(true);
    expect(state.recordIds).toHaveLength(5);
    // recordInfo is null for batch deletes
    expect(state.recordInfo).toBeNull();
  });
});

describe("/delete Command Parsing (Task 2.3)", () => {
  // Import the parser functions
  const { parseDeleteCommand } = require("../../../src/features/records/lib/deleteCommand.js");

  test("parses @collection:id format", () => {
    const result = parseDeleteCommand("/delete @posts:abc123");
    
    expect(result.collection).toBe("posts");
    expect(result.recordIds).toEqual(["abc123"]);
    expect(result.force).toBe(false);
  });

  test("parses multiple IDs: @col:id1,id2,id3", () => {
    const result = parseDeleteCommand("/delete @posts:id1,id2,id3");
    
    expect(result.collection).toBe("posts");
    expect(result.recordIds).toEqual(["id1", "id2", "id3"]);
    expect(result.force).toBe(false);
  });

  test("detects -f flag for force delete", () => {
    const result = parseDeleteCommand("/delete @posts:abc123 -f");
    
    expect(result.collection).toBe("posts");
    expect(result.recordIds).toEqual(["abc123"]);
    expect(result.force).toBe(true);
  });

  test("-f flag works with multiple IDs", () => {
    const result = parseDeleteCommand("/delete @posts:id1,id2 -f");
    
    expect(result.collection).toBe("posts");
    expect(result.recordIds).toEqual(["id1", "id2"]);
    expect(result.force).toBe(true);
  });

  test("returns null for invalid format", () => {
    const result = parseDeleteCommand("/delete invalid");
    
    expect(result).toBeNull();
  });

  test("returns null for missing collection", () => {
    const result = parseDeleteCommand("/delete :abc123");
    
    expect(result).toBeNull();
  });

  test("returns null for missing record ID", () => {
    const result = parseDeleteCommand("/delete @posts");
    
    expect(result).toBeNull();
  });

  test("handles spaces around -f flag", () => {
    const result = parseDeleteCommand("/delete @posts:abc123  -f");
    
    expect(result.force).toBe(true);
  });

  test("handles --force long flag", () => {
    const result = parseDeleteCommand("/delete @posts:abc123 --force");
    
    expect(result.force).toBe(true);
  });
});
