/**
 * Form State Tests (Task 3.3 + 3.4)
 *
 * TDD: 红灯 → 绿灯
 * Note: React components don't need unit tests per spec
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { createStore } from "jotai";
import {
  formStateAtom,
  enterCreateMode,
  enterEditMode,
  updateFieldValue,
  setFieldError,
  clearFieldError,
  resetFormState,
  computeIsDirty,
  type FormState,
  type EditMode,
} from "../../../src/features/records/store/formStateAtom.js";

describe("Form State Atom (Task 3.4)", () => {
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    store = createStore();
  });

  test("initial state has null mode", () => {
    const state = store.get(formStateAtom);
    
    expect(state.mode).toBeNull();
    expect(state.collection).toBeNull();
    expect(state.recordId).toBeNull();
    expect(state.originalData).toBeNull();
    expect(state.currentData).toEqual({});
    expect(state.errors).toEqual({});
    expect(state.isDirty).toBe(false);
  });

  test("enters create mode with collection", () => {
    const schema = [
      { name: "title", type: "text", required: true },
      { name: "content", type: "text", required: false },
    ];
    
    store.set(formStateAtom, enterCreateMode("posts", schema));
    
    const state = store.get(formStateAtom);
    
    expect(state.mode).toBe("create");
    expect(state.collection).toBe("posts");
    expect(state.recordId).toBeNull();
    expect(state.originalData).toBeNull();
    expect(state.currentData).toEqual({});
    expect(state.isDirty).toBe(false);
  });

  test("enters edit mode with record data", () => {
    const recordData = {
      title: "Existing Post",
      content: "Some content",
      published: true,
    };
    
    store.set(formStateAtom, enterEditMode("posts", "abc123", recordData));
    
    const state = store.get(formStateAtom);
    
    expect(state.mode).toBe("edit");
    expect(state.collection).toBe("posts");
    expect(state.recordId).toBe("abc123");
    expect(state.originalData).toEqual(recordData);
    expect(state.currentData).toEqual(recordData);
    expect(state.isDirty).toBe(false);
  });

  test("tracks currentData changes", () => {
    const recordData = { title: "Original" };
    store.set(formStateAtom, enterEditMode("posts", "abc123", recordData));
    
    // Update a field
    const currentState = store.get(formStateAtom);
    store.set(formStateAtom, updateFieldValue(currentState, "title", "Modified"));
    
    const state = store.get(formStateAtom);
    
    expect(state.currentData.title).toBe("Modified");
    expect(state.originalData?.title).toBe("Original");
  });

  test("computes isDirty correctly - dirty when changed", () => {
    const recordData = { title: "Original", content: "Text" };
    store.set(formStateAtom, enterEditMode("posts", "abc123", recordData));
    
    const currentState = store.get(formStateAtom);
    store.set(formStateAtom, updateFieldValue(currentState, "title", "Changed"));
    
    const state = store.get(formStateAtom);
    
    expect(state.isDirty).toBe(true);
  });

  test("computes isDirty correctly - not dirty when reverted", () => {
    const recordData = { title: "Original" };
    store.set(formStateAtom, enterEditMode("posts", "abc123", recordData));
    
    // Change then revert
    let currentState = store.get(formStateAtom);
    store.set(formStateAtom, updateFieldValue(currentState, "title", "Changed"));
    
    currentState = store.get(formStateAtom);
    store.set(formStateAtom, updateFieldValue(currentState, "title", "Original"));
    
    const state = store.get(formStateAtom);
    
    expect(state.isDirty).toBe(false);
  });

  test("tracks field errors", () => {
    store.set(formStateAtom, enterCreateMode("posts", []));
    
    let currentState = store.get(formStateAtom);
    store.set(formStateAtom, setFieldError(currentState, "title", "Title is required"));
    
    const state = store.get(formStateAtom);
    
    expect(state.errors.title).toBe("Title is required");
  });

  test("clears field errors", () => {
    store.set(formStateAtom, enterCreateMode("posts", []));
    
    let currentState = store.get(formStateAtom);
    store.set(formStateAtom, setFieldError(currentState, "title", "Title is required"));
    
    currentState = store.get(formStateAtom);
    store.set(formStateAtom, clearFieldError(currentState, "title"));
    
    const state = store.get(formStateAtom);
    
    expect(state.errors.title).toBeUndefined();
  });

  test("resets on close", () => {
    store.set(formStateAtom, enterEditMode("posts", "abc123", { title: "Test" }));
    
    store.set(formStateAtom, resetFormState());
    
    const state = store.get(formStateAtom);
    
    expect(state.mode).toBeNull();
    expect(state.collection).toBeNull();
    expect(state.recordId).toBeNull();
    expect(state.currentData).toEqual({});
    expect(state.isDirty).toBe(false);
  });

  test("multiple errors can be tracked", () => {
    store.set(formStateAtom, enterCreateMode("posts", []));
    
    let currentState = store.get(formStateAtom);
    store.set(formStateAtom, setFieldError(currentState, "title", "Required"));
    
    currentState = store.get(formStateAtom);
    store.set(formStateAtom, setFieldError(currentState, "email", "Invalid format"));
    
    const state = store.get(formStateAtom);
    
    expect(state.errors.title).toBe("Required");
    expect(state.errors.email).toBe("Invalid format");
    expect(Object.keys(state.errors)).toHaveLength(2);
  });
});

describe("Form Navigation (Task 3.3)", () => {
  const { 
    createFormNavigation,
    navigateNext,
    navigatePrev,
  } = require("../../../src/features/records/lib/formNavigation.js");

  test("Tab moves to next field", () => {
    const fields = ["title", "content", "published"];
    const nav = createFormNavigation(fields);
    
    expect(nav.currentIndex).toBe(0);
    expect(nav.currentField).toBe("title");
    
    const next = navigateNext(nav);
    
    expect(next.currentIndex).toBe(1);
    expect(next.currentField).toBe("content");
  });

  test("Shift+Tab moves to previous field", () => {
    const fields = ["title", "content", "published"];
    let nav = createFormNavigation(fields);
    nav = navigateNext(nav); // Move to content
    nav = navigateNext(nav); // Move to published
    
    expect(nav.currentIndex).toBe(2);
    
    const prev = navigatePrev(nav);
    
    expect(prev.currentIndex).toBe(1);
    expect(prev.currentField).toBe("content");
  });

  test("Tab on last field cycles to first", () => {
    const fields = ["title", "content", "published"];
    let nav = createFormNavigation(fields);
    nav = navigateNext(nav); // content
    nav = navigateNext(nav); // published
    nav = navigateNext(nav); // should cycle to title
    
    expect(nav.currentIndex).toBe(0);
    expect(nav.currentField).toBe("title");
  });

  test("Shift+Tab on first field cycles to last", () => {
    const fields = ["title", "content", "published"];
    const nav = createFormNavigation(fields);
    
    expect(nav.currentIndex).toBe(0);
    
    const prev = navigatePrev(nav);
    
    expect(prev.currentIndex).toBe(2);
    expect(prev.currentField).toBe("published");
  });

  test("maintains focus index correctly", () => {
    const fields = ["a", "b", "c", "d", "e"];
    let nav = createFormNavigation(fields);
    
    nav = navigateNext(nav); // b
    nav = navigateNext(nav); // c
    nav = navigatePrev(nav); // b
    nav = navigateNext(nav); // c
    nav = navigateNext(nav); // d
    
    expect(nav.currentIndex).toBe(3);
    expect(nav.currentField).toBe("d");
  });

  test("handles single field", () => {
    const fields = ["only"];
    let nav = createFormNavigation(fields);
    
    nav = navigateNext(nav);
    expect(nav.currentIndex).toBe(0);
    
    nav = navigatePrev(nav);
    expect(nav.currentIndex).toBe(0);
  });

  test("handles empty fields array", () => {
    const fields: string[] = [];
    const nav = createFormNavigation(fields);
    
    expect(nav.currentIndex).toBe(-1);
    expect(nav.currentField).toBeNull();
  });
});
