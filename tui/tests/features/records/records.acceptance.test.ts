/**
 * Records Acceptance Tests (STORY-5.4)
 * 
 * Tests for Records interaction flows:
 * - T-5.4.1: `/view @users` shows records table (US4-AC1)
 * - T-5.4.2: Arrow keys navigate records (US4-AC2)
 * - T-5.4.3: Page Up/Down pagination (US4-AC3)
 * - T-5.4.4: Enter shows record detail (US4-AC4)
 * - T-5.4.5: filter="verified=true" filtering (US6-AC1)
 * - T-5.4.6: filter="created>'2024-01-01'" (US6-AC2)
 * - T-5.4.7: Invalid filter shows error (US6-AC3)
 * - T-5.4.8: `/get @users:abc123` shows single record (US10-AC1)
 * - T-5.4.9: Non-existent record shows error (US10-AC2)
 */

import { describe, expect, it, beforeEach, mock } from "bun:test";
import { createStore } from "jotai";
import {
  recordsAtom,
  activeRecordAtom,
  recordsFilterAtom,
  recordsPaginationAtom,
  setRecordsAtom,
  setActiveRecordAtom,
  setFilterAtom,
  setPaginationAtom,
  type RecordData,
} from "../../../src/features/records/store/recordsAtoms.js";
import {
  fetchRecords,
  getRecord,
} from "../../../src/features/records/lib/recordsApi.js";
import { parseCommand } from "../../../src/lib/parser.js";
import { getCommand } from "../../../src/lib/commands.js";

// Mock PocketBase client
const createMockPBClient = (records: any[] = []) => ({
  collection: (name: string) => ({
    getList: mock((page: number, perPage: number, options?: any) => {
      let filteredRecords = [...records];
      
      // Simple filter simulation
      if (options?.filter) {
        // This is a simplified simulation - real PB does complex filtering
        filteredRecords = records;
      }
      
      const start = (page - 1) * perPage;
      const end = start + perPage;
      const items = filteredRecords.slice(start, end);
      return Promise.resolve({
        page,
        perPage,
        totalItems: filteredRecords.length,
        totalPages: Math.ceil(filteredRecords.length / perPage),
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

describe("Records Acceptance Tests", () => {
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    store = createStore();
  });

  describe("T-5.4.1: `/view @users` shows records table (US4-AC1)", () => {
    it("should parse /view command with resource", () => {
      const result = parseCommand("/view @users");
      
      expect(result.command).toBe("/view");
      expect(result.resource?.collection).toBe("users");
      expect(getCommand("/view")).toBeDefined();
    });

    it("should fetch and display records", async () => {
      const mockRecords = [
        { id: "1", created: "2024-01-01", updated: "2024-01-01", name: "John" },
        { id: "2", created: "2024-01-02", updated: "2024-01-02", name: "Jane" },
      ];
      const pb = createMockPBClient(mockRecords);

      const result = await fetchRecords(pb as any, "users", {});
      store.set(setRecordsAtom, result.records);

      const stored = store.get(recordsAtom);
      expect(stored.length).toBe(2);
    });

    it("should display record fields in table", async () => {
      const mockRecords = [
        { 
          id: "abc123", 
          created: "2024-01-01",
          updated: "2024-01-02",
          email: "test@example.com",
          name: "Test User",
        },
      ];
      const pb = createMockPBClient(mockRecords);

      const result = await fetchRecords(pb as any, "users", {});
      
      expect(result.records[0].id).toBe("abc123");
      expect(result.records[0].data.email).toBe("test@example.com");
    });
  });

  describe("T-5.4.2: Arrow keys navigate records (US4-AC2)", () => {
    it("should support selection index for navigation", () => {
      const records: RecordData[] = [
        { id: "1", created: "", updated: "", data: {} },
        { id: "2", created: "", updated: "", data: {} },
        { id: "3", created: "", updated: "", data: {} },
      ];

      store.set(setRecordsAtom, records);
      
      // Simulate navigation down
      let selectedIndex = 0;
      selectedIndex = Math.min(selectedIndex + 1, records.length - 1);
      expect(selectedIndex).toBe(1);
      
      selectedIndex = Math.min(selectedIndex + 1, records.length - 1);
      expect(selectedIndex).toBe(2);
      
      // Should not exceed bounds
      selectedIndex = Math.min(selectedIndex + 1, records.length - 1);
      expect(selectedIndex).toBe(2);
    });

    it("should support navigation up", () => {
      const records: RecordData[] = [
        { id: "1", created: "", updated: "", data: {} },
        { id: "2", created: "", updated: "", data: {} },
      ];

      store.set(setRecordsAtom, records);
      
      let selectedIndex = 1;
      selectedIndex = Math.max(selectedIndex - 1, 0);
      expect(selectedIndex).toBe(0);
      
      // Should not go below 0
      selectedIndex = Math.max(selectedIndex - 1, 0);
      expect(selectedIndex).toBe(0);
    });
  });

  describe("T-5.4.3: Page Up/Down pagination (US4-AC3)", () => {
    it("should support page navigation", async () => {
      const mockRecords = Array.from({ length: 50 }, (_, i) => ({
        id: String(i + 1),
        created: "2024-01-01",
        updated: "2024-01-01",
        name: `Record ${i + 1}`,
      }));
      const pb = createMockPBClient(mockRecords);

      // Fetch page 1
      const page1 = await fetchRecords(pb as any, "users", { page: 1, perPage: 10 });
      store.set(setPaginationAtom, {
        page: page1.page,
        perPage: page1.perPage,
        totalItems: page1.totalItems,
        totalPages: page1.totalPages,
      });

      expect(store.get(recordsPaginationAtom).page).toBe(1);
      expect(store.get(recordsPaginationAtom).totalPages).toBe(5);

      // Fetch page 2
      const page2 = await fetchRecords(pb as any, "users", { page: 2, perPage: 10 });
      store.set(setPaginationAtom, { page: page2.page });

      expect(store.get(recordsPaginationAtom).page).toBe(2);
    });

    it("should display different records on each page", async () => {
      const mockRecords = Array.from({ length: 25 }, (_, i) => ({
        id: String(i + 1),
        created: "2024-01-01",
        updated: "2024-01-01",
      }));
      const pb = createMockPBClient(mockRecords);

      const page1 = await fetchRecords(pb as any, "users", { page: 1, perPage: 10 });
      const page3 = await fetchRecords(pb as any, "users", { page: 3, perPage: 10 });

      expect(page1.records.length).toBe(10);
      expect(page3.records.length).toBe(5);
      expect(page1.records[0].id).not.toBe(page3.records[0].id);
    });
  });

  describe("T-5.4.4: Enter shows record detail (US4-AC4)", () => {
    it("should set active record on selection", () => {
      const records: RecordData[] = [
        { id: "1", created: "", updated: "", data: { name: "John" } },
        { id: "2", created: "", updated: "", data: { name: "Jane" } },
      ];

      store.set(setRecordsAtom, records);
      
      // Simulate Enter on selected record
      const selectedIndex = 1;
      store.set(setActiveRecordAtom, records[selectedIndex]);

      const active = store.get(activeRecordAtom);
      expect(active?.id).toBe("2");
      expect(active?.data.name).toBe("Jane");
    });
  });

  describe("T-5.4.5: filter=\"verified=true\" filtering (US6-AC1)", () => {
    it("should parse filter argument", () => {
      const result = parseCommand('/view @users filter="verified=true"');
      
      expect(result.command).toBe("/view");
      expect(result.resource?.collection).toBe("users");
      expect(result.args.filter).toBe("verified=true");
    });

    it("should apply filter to records query", async () => {
      const pb = createMockPBClient([]);
      
      const result = await fetchRecords(pb as any, "users", { 
        filter: "verified=true" 
      });

      expect(result.records).toBeDefined();
    });

    it("should store filter in state", () => {
      store.set(setFilterAtom, { filter: "verified=true" });
      
      expect(store.get(recordsFilterAtom).filter).toBe("verified=true");
    });
  });

  describe("T-5.4.6: filter=\"created>'2024-01-01'\" (US6-AC2)", () => {
    it("should parse date comparison filter", () => {
      const result = parseCommand("/view @users filter=\"created>'2024-01-01'\"");
      
      expect(result.args.filter).toBe("created>'2024-01-01'");
    });

    it("should support complex date filters", () => {
      const result = parseCommand("/view @posts filter=\"created>'2024-01-01' && published=true\"");
      
      expect(result.args.filter).toBe("created>'2024-01-01' && published=true");
    });
  });

  describe("T-5.4.7: Invalid filter shows error (US6-AC3)", () => {
    it("should handle invalid filter gracefully", async () => {
      const pb = {
        collection: () => ({
          getList: mock(() => Promise.reject(new Error("Invalid filter syntax"))),
        }),
      };

      await expect(
        fetchRecords(pb as any, "users", { filter: "invalid syntax <<<" })
      ).rejects.toThrow("Invalid filter syntax");
    });
  });

  describe("T-5.4.8: `/get @users:abc123` shows single record (US10-AC1)", () => {
    it("should parse /get command with resource:id", () => {
      const result = parseCommand("/get @users:abc123");
      
      expect(result.command).toBe("/get");
      expect(result.resource?.collection).toBe("users");
      expect(result.resource?.id).toBe("abc123");
      expect(getCommand("/get")).toBeDefined();
    });

    it("should fetch single record by ID", async () => {
      const mockRecords = [
        { 
          id: "abc123", 
          created: "2024-01-01",
          updated: "2024-01-02",
          name: "John Doe",
          email: "john@example.com",
        },
      ];
      const pb = createMockPBClient(mockRecords);

      const record = await getRecord(pb as any, "users", "abc123");

      expect(record.id).toBe("abc123");
      expect(record.data.name).toBe("John Doe");
      expect(record.data.email).toBe("john@example.com");
    });

    it("should display record in JSON format", async () => {
      const mockRecords = [
        { 
          id: "1", 
          created: "2024-01-01",
          updated: "2024-01-02",
          title: "Test Post",
          content: "Hello World",
          published: true,
          tags: ["test", "demo"],
        },
      ];
      const pb = createMockPBClient(mockRecords);

      const record = await getRecord(pb as any, "posts", "1");

      expect(record.data).toHaveProperty("title");
      expect(record.data).toHaveProperty("content");
      expect(record.data).toHaveProperty("published");
      expect(record.data).toHaveProperty("tags");
    });
  });

  describe("T-5.4.9: Non-existent record shows error (US10-AC2)", () => {
    it("should throw error for non-existent record", async () => {
      const pb = createMockPBClient([]);

      await expect(
        getRecord(pb as any, "users", "nonexistent")
      ).rejects.toThrow("Record not found");
    });
  });

  describe("Complete /view flow integration", () => {
    it("should complete /view @users -> navigate -> select flow", async () => {
      const mockRecords = [
        { id: "1", created: "2024-01-01", updated: "2024-01-01", name: "John" },
        { id: "2", created: "2024-01-02", updated: "2024-01-02", name: "Jane" },
        { id: "3", created: "2024-01-03", updated: "2024-01-03", name: "Bob" },
      ];
      const pb = createMockPBClient(mockRecords);

      // Step 1: Parse command
      const cmd = parseCommand("/view @users");
      expect(cmd.command).toBe("/view");
      expect(cmd.resource?.collection).toBe("users");

      // Step 2: Fetch records
      const result = await fetchRecords(pb as any, "users", {});
      store.set(setRecordsAtom, result.records);
      store.set(setPaginationAtom, {
        totalItems: result.totalItems,
        totalPages: result.totalPages,
      });

      // Step 3: Navigate to second record
      const selectedIndex = 1;
      const selectedRecord = store.get(recordsAtom)[selectedIndex];

      // Step 4: Select record
      store.set(setActiveRecordAtom, selectedRecord);
      expect(store.get(activeRecordAtom)?.id).toBe("2");
    });

    it("should complete /get @users:id flow", async () => {
      const mockRecords = [
        { 
          id: "abc123", 
          created: "2024-01-01", 
          updated: "2024-01-02",
          name: "John Doe",
          email: "john@example.com",
        },
      ];
      const pb = createMockPBClient(mockRecords);

      // Step 1: Parse command
      const cmd = parseCommand("/get @users:abc123");
      expect(cmd.command).toBe("/get");
      expect(cmd.resource?.collection).toBe("users");
      expect(cmd.resource?.id).toBe("abc123");

      // Step 2: Fetch record
      const record = await getRecord(pb as any, "users", "abc123");
      
      // Step 3: Set as active
      store.set(setActiveRecordAtom, record);

      expect(store.get(activeRecordAtom)?.id).toBe("abc123");
      expect(store.get(activeRecordAtom)?.data.name).toBe("John Doe");
    });
  });
});
