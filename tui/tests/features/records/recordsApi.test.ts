/**
 * Records API Tests (STORY-5.2)
 * 
 * Tests for Records API functionality
 */

import { describe, expect, it, beforeEach, mock } from "bun:test";
import { createStore } from "jotai";
import {
  fetchRecords,
  getRecord,
  type FetchRecordsOptions,
  type FetchRecordsResult,
} from "../../../src/features/records/lib/recordsApi.js";

// Mock PocketBase client
const createMockPBClient = (records: any[] = []) => ({
  collection: (name: string) => ({
    getList: mock((page: number, perPage: number, options?: any) => {
      const start = (page - 1) * perPage;
      const end = start + perPage;
      const items = records.slice(start, end);
      return Promise.resolve({
        page,
        perPage,
        totalItems: records.length,
        totalPages: Math.ceil(records.length / perPage),
        items,
      });
    }),
    getOne: mock((id: string) => {
      const record = records.find(r => r.id === id);
      if (!record) throw new Error("Record not found");
      return Promise.resolve(record);
    }),
  }),
});

describe("Records API", () => {
  describe("fetchRecords (T-5.2.1, T-5.2.2)", () => {
    it("should fetch records list", async () => {
      const mockRecords = [
        { id: "1", created: "2024-01-01", updated: "2024-01-01", name: "Record 1" },
        { id: "2", created: "2024-01-02", updated: "2024-01-02", name: "Record 2" },
      ];
      const pb = createMockPBClient(mockRecords);

      const result = await fetchRecords(pb as any, "users", {});

      expect(result.records.length).toBe(2);
      expect(result.totalItems).toBe(2);
    });

    it("should support pagination", async () => {
      const mockRecords = Array.from({ length: 50 }, (_, i) => ({
        id: String(i + 1),
        created: "2024-01-01",
        updated: "2024-01-01",
        name: `Record ${i + 1}`,
      }));
      const pb = createMockPBClient(mockRecords);

      const result = await fetchRecords(pb as any, "users", { page: 2, perPage: 10 });

      expect(result.records.length).toBe(10);
      expect(result.page).toBe(2);
      expect(result.totalPages).toBe(5);
    });

    it("should support filter option", async () => {
      const getListMock = mock(() => Promise.resolve({
        page: 1,
        perPage: 20,
        totalItems: 0,
        totalPages: 0,
        items: [],
      }));
      const pb = {
        collection: () => ({
          getList: getListMock,
        }),
      };
      
      await fetchRecords(pb as any, "users", { filter: "verified=true" });

      expect(getListMock).toHaveBeenCalled();
    });

    it("should support sort option", async () => {
      const getListMock = mock(() => Promise.resolve({
        page: 1,
        perPage: 20,
        totalItems: 0,
        totalPages: 0,
        items: [],
      }));
      const pb = {
        collection: () => ({
          getList: getListMock,
        }),
      };
      
      await fetchRecords(pb as any, "users", { sort: "-created" });

      expect(getListMock).toHaveBeenCalled();
    });

    it("should transform records to RecordData format", async () => {
      const mockRecords = [
        { 
          id: "abc123", 
          created: "2024-01-01T00:00:00Z",
          updated: "2024-01-02T00:00:00Z",
          collectionId: "col123",
          collectionName: "users",
          email: "test@example.com",
          name: "Test User",
        },
      ];
      const pb = createMockPBClient(mockRecords);

      const result = await fetchRecords(pb as any, "users", {});

      expect(result.records[0].id).toBe("abc123");
      expect(result.records[0].data).toHaveProperty("email");
      expect(result.records[0].data).toHaveProperty("name");
    });

    it("should handle empty results", async () => {
      const pb = createMockPBClient([]);

      const result = await fetchRecords(pb as any, "users", {});

      expect(result.records).toEqual([]);
      expect(result.totalItems).toBe(0);
    });

    it("should handle network error", async () => {
      const pb = {
        collection: () => ({
          getList: mock(() => Promise.reject(new Error("Network error"))),
        }),
      };

      await expect(fetchRecords(pb as any, "users", {})).rejects.toThrow("Network error");
    });
  });

  describe("getRecord (T-5.2.3, T-5.2.4)", () => {
    it("should fetch single record by ID", async () => {
      const mockRecords = [
        { 
          id: "abc123", 
          created: "2024-01-01T00:00:00Z",
          updated: "2024-01-02T00:00:00Z",
          email: "test@example.com",
          name: "Test User",
        },
      ];
      const pb = createMockPBClient(mockRecords);

      const result = await getRecord(pb as any, "users", "abc123");

      expect(result.id).toBe("abc123");
      expect(result.data.email).toBe("test@example.com");
    });

    it("should throw error for non-existent record", async () => {
      const pb = createMockPBClient([]);

      await expect(getRecord(pb as any, "users", "nonexistent")).rejects.toThrow();
    });

    it("should include all record fields", async () => {
      const mockRecords = [
        { 
          id: "1", 
          created: "2024-01-01",
          updated: "2024-01-02",
          collectionId: "col1",
          collectionName: "posts",
          title: "Test Post",
          content: "Test content",
          published: true,
          tags: ["test", "demo"],
        },
      ];
      const pb = createMockPBClient(mockRecords);

      const result = await getRecord(pb as any, "posts", "1");

      expect(result.data.title).toBe("Test Post");
      expect(result.data.content).toBe("Test content");
      expect(result.data.published).toBe(true);
      expect(result.data.tags).toEqual(["test", "demo"]);
    });
  });

  describe("Filter expressions", () => {
    const createFilterTestClient = () => {
      const getListMock = mock(() => Promise.resolve({
        page: 1,
        perPage: 20,
        totalItems: 0,
        totalPages: 0,
        items: [],
      }));
      return {
        pb: { collection: () => ({ getList: getListMock }) },
        mock: getListMock,
      };
    };

    it("should handle equality filter", async () => {
      const { pb, mock: getListMock } = createFilterTestClient();
      
      await fetchRecords(pb as any, "users", { filter: "verified=true" });
      
      expect(getListMock).toHaveBeenCalled();
    });

    it("should handle comparison filter", async () => {
      const { pb, mock: getListMock } = createFilterTestClient();
      
      await fetchRecords(pb as any, "users", { filter: "created>'2024-01-01'" });
      
      expect(getListMock).toHaveBeenCalled();
    });

    it("should handle AND filter", async () => {
      const { pb, mock: getListMock } = createFilterTestClient();
      
      await fetchRecords(pb as any, "users", { 
        filter: "verified=true && role='admin'" 
      });
      
      expect(getListMock).toHaveBeenCalled();
    });

    it("should handle LIKE filter", async () => {
      const { pb, mock: getListMock } = createFilterTestClient();
      
      await fetchRecords(pb as any, "users", { 
        filter: "email~'@gmail.com'" 
      });
      
      expect(getListMock).toHaveBeenCalled();
    });
  });

  describe("Pagination calculations", () => {
    it("should calculate correct total pages", async () => {
      const mockRecords = Array.from({ length: 55 }, (_, i) => ({
        id: String(i + 1),
        created: "2024-01-01",
        updated: "2024-01-01",
      }));
      const pb = createMockPBClient(mockRecords);

      const result = await fetchRecords(pb as any, "users", { perPage: 10 });

      expect(result.totalPages).toBe(6); // 55/10 = 5.5, rounded up = 6
    });

    it("should return correct items for last page", async () => {
      const mockRecords = Array.from({ length: 25 }, (_, i) => ({
        id: String(i + 1),
        created: "2024-01-01",
        updated: "2024-01-01",
      }));
      const pb = createMockPBClient(mockRecords);

      const result = await fetchRecords(pb as any, "users", { page: 3, perPage: 10 });

      expect(result.records.length).toBe(5); // Last 5 records
    });
  });
});
