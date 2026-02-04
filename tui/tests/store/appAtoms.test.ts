/**
 * Application State Atoms Tests - TDD
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { createStore } from "jotai";
import {
  appStateAtom,
  currentViewAtom,
  messagesAtom,
  addMessageAtom,
  clearMessagesAtom,
  type AppState,
  type ViewType,
  type Message,
} from "../../src/store/appAtoms.js";

describe("appAtoms", () => {
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    store = createStore();
  });

  describe("appStateAtom", () => {
    test("should have initial state as disconnected", () => {
      const state = store.get(appStateAtom);
      expect(state).toBe("disconnected");
    });

    test("should allow setting to connected", () => {
      store.set(appStateAtom, "connected");
      expect(store.get(appStateAtom)).toBe("connected");
    });

    test("should allow setting to error", () => {
      store.set(appStateAtom, "error");
      expect(store.get(appStateAtom)).toBe("error");
    });

    test("should allow setting to connecting", () => {
      store.set(appStateAtom, "connecting");
      expect(store.get(appStateAtom)).toBe("connecting");
    });
  });

  describe("currentViewAtom", () => {
    test("should have initial view as dashboard", () => {
      const view = store.get(currentViewAtom);
      expect(view).toBe("dashboard");
    });

    test("should allow setting to collections", () => {
      store.set(currentViewAtom, "collections");
      expect(store.get(currentViewAtom)).toBe("collections");
    });

    test("should allow setting to records", () => {
      store.set(currentViewAtom, "records");
      expect(store.get(currentViewAtom)).toBe("records");
    });

    test("should allow setting to logs", () => {
      store.set(currentViewAtom, "logs");
      expect(store.get(currentViewAtom)).toBe("logs");
    });

    test("should allow setting to monitor", () => {
      store.set(currentViewAtom, "monitor");
      expect(store.get(currentViewAtom)).toBe("monitor");
    });
  });

  describe("messagesAtom", () => {
    test("should have empty initial messages", () => {
      const messages = store.get(messagesAtom);
      expect(messages).toEqual([]);
    });

    test("should add success message", () => {
      store.set(addMessageAtom, { type: "success", text: "Operation successful" });
      const messages = store.get(messagesAtom);
      expect(messages).toHaveLength(1);
      expect(messages[0].type).toBe("success");
      expect(messages[0].text).toBe("Operation successful");
      expect(messages[0].id).toBeDefined();
    });

    test("should add error message", () => {
      store.set(addMessageAtom, { type: "error", text: "Something went wrong" });
      const messages = store.get(messagesAtom);
      expect(messages[0].type).toBe("error");
    });

    test("should add warning message", () => {
      store.set(addMessageAtom, { type: "warning", text: "Be careful" });
      const messages = store.get(messagesAtom);
      expect(messages[0].type).toBe("warning");
    });

    test("should add multiple messages", () => {
      store.set(addMessageAtom, { type: "success", text: "First" });
      store.set(addMessageAtom, { type: "error", text: "Second" });
      const messages = store.get(messagesAtom);
      expect(messages).toHaveLength(2);
    });

    test("should clear all messages", () => {
      store.set(addMessageAtom, { type: "success", text: "First" });
      store.set(addMessageAtom, { type: "error", text: "Second" });
      store.set(clearMessagesAtom);
      const messages = store.get(messagesAtom);
      expect(messages).toEqual([]);
    });
  });
});
