/**
 * Records Atoms Tests (STORY-5.1)
 * 
 * TDD: 🔴 Red Phase
 * Tests for:
 * - T-5.1.1: recordsAtom (Records list)
 * - T-5.1.3: activeRecordAtom (Current selected)
 * - T-5.1.5: recordsFilterAtom (Filter conditions)
 * - T-5.1.7: recordsPaginationAtom (Pagination state)
 */

import { describe, expect, it, beforeEach } from "bun:test";
import { createStore } from "jotai";
import {
  recordsAtom,
  activeRecordAtom,
  recordsFilterAtom,
  recordsPaginationAtom,
  isRecordsLoadingAtom,
  recordsErrorAtom,
  setRecordsAtom,
  setActiveRecordAtom,
  setFilterAtom,
  setPaginationAtom,
  setLoadingAtom,
  setErrorAtom,
  clearRecordsAtom,
  type RecordData,
  type RecordsFilter,
  type Pagination,
} from "../../../src/features/records/store/recordsAtoms.js";

describe("Records Atoms", () => {
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    store = createStore();
  });

  describe("recordsAtom (T-5.1.1, T-5.1.2)", () => {
    it("should have empty initial records", () => {
      const records = store.get(recordsAtom);
      expect(records).toEqual([]);
    });

    it("should allow setting records", () => {
      const mockRecords: RecordData[] = [
        { id: "rec1", created: "2024-01-01", updated: "2024-01-01", data: { name: "John" } },
        { id: "rec2", created: "2024-01-02", updated: "2024-01-02", data: { name: "Jane" } },
      ];

      store.set(setRecordsAtom, mockRecords);
      const records = store.get(recordsAtom);

      expect(records.length).toBe(2);
      expect(records[0].id).toBe("rec1");
      expect(records[1].data.name).toBe("Jane");
    });

    it("should store record with all fields", () => {
      const record: RecordData = {
        id: "abc123",
        created: "2024-01-01T00:00:00Z",
        updated: "2024-01-02T00:00:00Z",
        collectionId: "col123",
        collectionName: "users",
        data: {
          email: "test@example.com",
          name: "Test User",
          verified: true,
        },
      };

      store.set(setRecordsAtom, [record]);
      const records = store.get(recordsAtom);

      expect(records[0].id).toBe("abc123");
      expect(records[0].collectionName).toBe("users");
      expect(records[0].data.email).toBe("test@example.com");
    });
  });

  describe("activeRecordAtom (T-5.1.3, T-5.1.4)", () => {
    it("should have null initial active record", () => {
      const active = store.get(activeRecordAtom);
      expect(active).toBeNull();
    });

    it("should allow setting active record", () => {
      const record: RecordData = {
        id: "rec1",
        created: "2024-01-01",
        updated: "2024-01-01",
        data: { name: "John" },
      };

      store.set(setActiveRecordAtom, record);
      const active = store.get(activeRecordAtom);

      expect(active?.id).toBe("rec1");
    });

    it("should allow clearing active record", () => {
      const record: RecordData = {
        id: "rec1",
        created: "2024-01-01",
        updated: "2024-01-01",
        data: {},
      };

      store.set(setActiveRecordAtom, record);
      store.set(setActiveRecordAtom, null);

      expect(store.get(activeRecordAtom)).toBeNull();
    });
  });

  describe("recordsFilterAtom (T-5.1.5, T-5.1.6)", () => {
    it("should have default filter state", () => {
      const filter = store.get(recordsFilterAtom);
      
      expect(filter.filter).toBe("");
      expect(filter.sort).toBe("");
    });

    it("should allow setting filter expression", () => {
      store.set(setFilterAtom, { filter: "verified=true" });
      
      const filter = store.get(recordsFilterAtom);
      expect(filter.filter).toBe("verified=true");
    });

    it("should allow setting sort", () => {
      store.set(setFilterAtom, { sort: "-created" });
      
      const filter = store.get(recordsFilterAtom);
      expect(filter.sort).toBe("-created");
    });

    it("should allow setting multiple filter options", () => {
      store.set(setFilterAtom, { 
        filter: "status='active'", 
        sort: "created" 
      });
      
      const filter = store.get(recordsFilterAtom);
      expect(filter.filter).toBe("status='active'");
      expect(filter.sort).toBe("created");
    });

    it("should support complex filter expressions", () => {
      const complexFilter = "created>'2024-01-01' && published=true && category~'news'";
      store.set(setFilterAtom, { filter: complexFilter });
      
      expect(store.get(recordsFilterAtom).filter).toBe(complexFilter);
    });
  });

  describe("recordsPaginationAtom (T-5.1.7, T-5.1.8)", () => {
    it("should have default pagination state", () => {
      const pagination = store.get(recordsPaginationAtom);
      
      expect(pagination.page).toBe(1);
      expect(pagination.perPage).toBe(20);
      expect(pagination.totalItems).toBe(0);
      expect(pagination.totalPages).toBe(0);
    });

    it("should allow setting page", () => {
      store.set(setPaginationAtom, { page: 2 });
      
      expect(store.get(recordsPaginationAtom).page).toBe(2);
    });

    it("should allow setting perPage", () => {
      store.set(setPaginationAtom, { perPage: 50 });
      
      expect(store.get(recordsPaginationAtom).perPage).toBe(50);
    });

    it("should allow setting total items and pages", () => {
      store.set(setPaginationAtom, { 
        totalItems: 100, 
        totalPages: 5 
      });
      
      const pagination = store.get(recordsPaginationAtom);
      expect(pagination.totalItems).toBe(100);
      expect(pagination.totalPages).toBe(5);
    });

    it("should support full pagination update", () => {
      store.set(setPaginationAtom, {
        page: 3,
        perPage: 25,
        totalItems: 250,
        totalPages: 10,
      });
      
      const pagination = store.get(recordsPaginationAtom);
      expect(pagination.page).toBe(3);
      expect(pagination.perPage).toBe(25);
      expect(pagination.totalItems).toBe(250);
      expect(pagination.totalPages).toBe(10);
    });
  });

  describe("isRecordsLoadingAtom", () => {
    it("should have false initial loading state", () => {
      expect(store.get(isRecordsLoadingAtom)).toBe(false);
    });

    it("should allow setting loading state", () => {
      store.set(setLoadingAtom, true);
      expect(store.get(isRecordsLoadingAtom)).toBe(true);
      
      store.set(setLoadingAtom, false);
      expect(store.get(isRecordsLoadingAtom)).toBe(false);
    });
  });

  describe("recordsErrorAtom", () => {
    it("should have null initial error", () => {
      expect(store.get(recordsErrorAtom)).toBeNull();
    });

    it("should allow setting error message", () => {
      store.set(setErrorAtom, "Failed to fetch records");
      expect(store.get(recordsErrorAtom)).toBe("Failed to fetch records");
    });

    it("should allow clearing error", () => {
      store.set(setErrorAtom, "Some error");
      store.set(setErrorAtom, null);
      expect(store.get(recordsErrorAtom)).toBeNull();
    });
  });

  describe("clearRecordsAtom", () => {
    it("should clear all records state", () => {
      // Set some state
      store.set(setRecordsAtom, [
        { id: "rec1", created: "", updated: "", data: {} },
      ]);
      store.set(setActiveRecordAtom, { id: "rec1", created: "", updated: "", data: {} });
      store.set(setFilterAtom, { filter: "test" });
      store.set(setPaginationAtom, { page: 5, totalItems: 100 });
      store.set(setLoadingAtom, true);
      store.set(setErrorAtom, "Some error");

      // Clear all
      store.set(clearRecordsAtom);

      expect(store.get(recordsAtom)).toEqual([]);
      expect(store.get(activeRecordAtom)).toBeNull();
      expect(store.get(recordsFilterAtom).filter).toBe("");
      expect(store.get(recordsPaginationAtom).page).toBe(1);
      expect(store.get(isRecordsLoadingAtom)).toBe(false);
      expect(store.get(recordsErrorAtom)).toBeNull();
    });
  });
});
