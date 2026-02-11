/**
 * T165 — log_query.test.ts
 * 对照 Go 版 core/log_query.go
 * 测试 LogQueryHelper：CRUD、分页、排序、过滤、统计、旧日志删除
 */

import { describe, expect, test, beforeEach } from "bun:test";
import { LogQueryHelper, LOGS_TABLE_NAME } from "./log_query";
import type { Log } from "./log_query";

describe("LOGS_TABLE_NAME", () => {
  test("is _logs", () => {
    expect(LOGS_TABLE_NAME).toBe("_logs");
  });
});

describe("LogQueryHelper", () => {
  let helper: LogQueryHelper;

  const makeLogs = (): Log[] => [
    { id: "log1", created: "2024-01-15 10:00:00.000Z", data: { url: "/api/health" }, message: "OK", level: 0 },
    { id: "log2", created: "2024-01-15 10:30:00.000Z", data: { url: "/api/records" }, message: "Error", level: 8 },
    { id: "log3", created: "2024-01-15 11:00:00.000Z", data: { url: "/api/auth" }, message: "Warning", level: 4 },
    { id: "log4", created: "2024-01-16 09:00:00.000Z", data: {}, message: "Debug", level: 0 },
    { id: "log5", created: "2024-01-16 09:30:00.000Z", data: { url: "/api/error" }, message: "Fatal", level: 16 },
  ];

  beforeEach(() => {
    helper = new LogQueryHelper();
  });

  describe("addLog + findById", () => {
    test("find existing log by id", () => {
      helper.addLog({ id: "x1", created: "2024-01-01", data: {}, message: "test", level: 0 });
      const found = helper.findById("x1");
      expect(found).not.toBeNull();
      expect(found!.id).toBe("x1");
      expect(found!.message).toBe("test");
    });

    test("find non-existing log returns null", () => {
      expect(helper.findById("missing")).toBeNull();
    });

    test("find among multiple logs", () => {
      for (const log of makeLogs()) helper.addLog(log);
      expect(helper.findById("log3")!.message).toBe("Warning");
      expect(helper.findById("log99")).toBeNull();
    });
  });

  describe("list", () => {
    test("empty helper returns empty list", () => {
      const result = helper.list();
      expect(result.totalItems).toBe(0);
      expect(result.items).toHaveLength(0);
      expect(result.page).toBe(1);
    });

    test("default pagination — page 1, perPage 30", () => {
      for (const log of makeLogs()) helper.addLog(log);
      const result = helper.list();
      expect(result.page).toBe(1);
      expect(result.perPage).toBe(30);
      expect(result.totalItems).toBe(5);
      expect(result.totalPages).toBe(1);
      expect(result.items).toHaveLength(5);
    });

    test("custom pagination", () => {
      for (const log of makeLogs()) helper.addLog(log);
      const result = helper.list({ page: 1, perPage: 2 });
      expect(result.items).toHaveLength(2);
      expect(result.totalPages).toBe(3); // ceil(5/2) = 3
    });

    test("page 2 with perPage 2", () => {
      for (const log of makeLogs()) helper.addLog(log);
      const result = helper.list({ page: 2, perPage: 2 });
      expect(result.items).toHaveLength(2);
      expect(result.page).toBe(2);
    });

    test("page beyond total returns empty items", () => {
      for (const log of makeLogs()) helper.addLog(log);
      const result = helper.list({ page: 10, perPage: 2 });
      expect(result.items).toHaveLength(0);
    });

    test("perPage capped at 100", () => {
      for (const log of makeLogs()) helper.addLog(log);
      const result = helper.list({ perPage: 200 });
      expect(result.perPage).toBe(100);
    });

    test("perPage minimum is 1", () => {
      for (const log of makeLogs()) helper.addLog(log);
      const result = helper.list({ perPage: 0 });
      expect(result.perPage).toBe(1);
    });

    test("filter by level >= 4", () => {
      for (const log of makeLogs()) helper.addLog(log);
      const result = helper.list({ filter: "level >= 4" });
      expect(result.totalItems).toBe(3); // log2(8), log3(4), log5(16)
      expect(result.items.every((l) => l.level >= 4)).toBe(true);
    });

    test("filter by level > 4", () => {
      for (const log of makeLogs()) helper.addLog(log);
      const result = helper.list({ filter: "level > 4" });
      expect(result.totalItems).toBe(2); // log2(8), log5(16)
    });

    test("filter by level <= 4", () => {
      for (const log of makeLogs()) helper.addLog(log);
      const result = helper.list({ filter: "level <= 4" });
      expect(result.totalItems).toBe(3); // log1(0), log3(4), log4(0)
    });

    test("filter by level < 4", () => {
      for (const log of makeLogs()) helper.addLog(log);
      const result = helper.list({ filter: "level < 4" });
      expect(result.totalItems).toBe(2); // log1(0), log4(0)
    });

    test("sort by created ascending", () => {
      for (const log of makeLogs()) helper.addLog(log);
      const result = helper.list({ sort: "created" });
      expect(result.items[0].id).toBe("log1");
      expect(result.items[4].id).toBe("log5");
    });

    test("sort by created descending", () => {
      for (const log of makeLogs()) helper.addLog(log);
      const result = helper.list({ sort: "-created" });
      expect(result.items[0].id).toBe("log5");
      expect(result.items[4].id).toBe("log1");
    });

    test("sort by level ascending", () => {
      for (const log of makeLogs()) helper.addLog(log);
      const result = helper.list({ sort: "level" });
      expect(result.items[0].level).toBeLessThanOrEqual(result.items[4].level);
    });
  });

  describe("stats", () => {
    test("empty helper returns empty stats", () => {
      expect(helper.stats()).toEqual([]);
    });

    test("groups by hour", () => {
      for (const log of makeLogs()) helper.addLog(log);
      const stats = helper.stats();
      // 3 distinct hours: 2024-01-15 10:*, 2024-01-15 11:*, 2024-01-16 09:*
      expect(stats).toHaveLength(3);
    });

    test("stats sorted by date ascending", () => {
      for (const log of makeLogs()) helper.addLog(log);
      const stats = helper.stats();
      for (let i = 1; i < stats.length; i++) {
        expect(stats[i].date >= stats[i - 1].date).toBe(true);
      }
    });

    test("stats totals are correct", () => {
      for (const log of makeLogs()) helper.addLog(log);
      const stats = helper.stats();
      const totalSum = stats.reduce((s, item) => s + item.total, 0);
      expect(totalSum).toBe(5);
    });

    test("stats with level filter", () => {
      for (const log of makeLogs()) helper.addLog(log);
      const stats = helper.stats("level >= 8");
      // log2(8) at hour 10, log5(16) at hour 09
      const totalSum = stats.reduce((s, item) => s + item.total, 0);
      expect(totalSum).toBe(2);
    });
  });

  describe("deleteOldLogs", () => {
    test("delete logs before cutoff", () => {
      for (const log of makeLogs()) helper.addLog(log);
      const deleted = helper.deleteOldLogs("2024-01-16 00:00:00.000Z");
      // log1, log2, log3 are before cutoff (Jan 15)
      expect(deleted).toBe(3);
      // Remaining: log4, log5
      expect(helper.findById("log4")).not.toBeNull();
      expect(helper.findById("log5")).not.toBeNull();
      expect(helper.findById("log1")).toBeNull();
    });

    test("delete none if all are after cutoff", () => {
      for (const log of makeLogs()) helper.addLog(log);
      const deleted = helper.deleteOldLogs("2024-01-01 00:00:00.000Z");
      expect(deleted).toBe(0);
    });

    test("delete all if cutoff is in the future", () => {
      for (const log of makeLogs()) helper.addLog(log);
      const deleted = helper.deleteOldLogs("2025-01-01 00:00:00.000Z");
      expect(deleted).toBe(5);
    });

    test("returns 0 for empty helper", () => {
      const deleted = helper.deleteOldLogs("2024-01-01");
      expect(deleted).toBe(0);
    });
  });
});
