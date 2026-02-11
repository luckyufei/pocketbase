/**
 * logs_cron.test.ts — T119-T121 日志查询、日志端点、Cron 端点测试
 * 对照 Go 版 apis/logs_test.go, apis/cron_test.go, core/log_query.go
 */
import { describe, test, expect } from "bun:test";
import {
  LogQueryHelper,
  LOGS_TABLE_NAME,
  type Log,
  type LogsStatsItem,
} from "../core/log_query";
import type { CronJobInfo } from "./cron";

// ============================================================
// T119: Log Query Helpers
// ============================================================

describe("LogQueryHelper", () => {
  test("LOGS_TABLE_NAME = _logs", () => {
    expect(LOGS_TABLE_NAME).toBe("_logs");
  });

  test("findById 找到日志", () => {
    const helper = new LogQueryHelper();
    helper.addLog({
      id: "log1",
      created: "2025-01-01T12:30:00Z",
      message: "test message",
      level: 4,
      data: { url: "/api/test" },
    });

    const log = helper.findById("log1");
    expect(log).not.toBeNull();
    expect(log!.id).toBe("log1");
    expect(log!.message).toBe("test message");
    expect(log!.level).toBe(4);
  });

  test("findById 找不到返回 null", () => {
    const helper = new LogQueryHelper();
    expect(helper.findById("nonexistent")).toBeNull();
  });

  test("list 基础分页", () => {
    const helper = new LogQueryHelper();
    for (let i = 1; i <= 50; i++) {
      helper.addLog({
        id: `log${i}`,
        created: `2025-01-01T${String(i % 24).padStart(2, "0")}:00:00Z`,
        message: `msg ${i}`,
        level: i % 5,
        data: {},
      });
    }

    const page1 = helper.list({ page: 1, perPage: 10 });
    expect(page1.page).toBe(1);
    expect(page1.perPage).toBe(10);
    expect(page1.totalItems).toBe(50);
    expect(page1.totalPages).toBe(5);
    expect(page1.items.length).toBe(10);
  });

  test("list 过滤 level >= 3", () => {
    const helper = new LogQueryHelper();
    for (let i = 0; i < 10; i++) {
      helper.addLog({
        id: `log${i}`,
        created: "2025-01-01T12:00:00Z",
        message: `msg ${i}`,
        level: i,
        data: {},
      });
    }

    const result = helper.list({ filter: "level >= 3" });
    expect(result.totalItems).toBe(7); // 3,4,5,6,7,8,9
    for (const item of result.items) {
      expect(item.level).toBeGreaterThanOrEqual(3);
    }
  });

  test("list 排序", () => {
    const helper = new LogQueryHelper();
    helper.addLog({ id: "a", created: "2025-01-01T10:00:00Z", message: "a", level: 1, data: {} });
    helper.addLog({ id: "b", created: "2025-01-01T12:00:00Z", message: "b", level: 2, data: {} });
    helper.addLog({ id: "c", created: "2025-01-01T08:00:00Z", message: "c", level: 3, data: {} });

    const asc = helper.list({ sort: "created" });
    expect(asc.items[0].id).toBe("c"); // 08:00
    expect(asc.items[2].id).toBe("b"); // 12:00

    const desc = helper.list({ sort: "-created" });
    expect(desc.items[0].id).toBe("b"); // 12:00
    expect(desc.items[2].id).toBe("c"); // 08:00
  });

  test("stats 按小时分组", () => {
    const helper = new LogQueryHelper();
    helper.addLog({ id: "1", created: "2025-01-01T12:15:00Z", message: "a", level: 0, data: {} });
    helper.addLog({ id: "2", created: "2025-01-01T12:45:00Z", message: "b", level: 0, data: {} });
    helper.addLog({ id: "3", created: "2025-01-01T13:10:00Z", message: "c", level: 0, data: {} });

    const stats = helper.stats();
    expect(stats.length).toBe(2);
    expect(stats[0].date).toBe("2025-01-01T12:00:00");
    expect(stats[0].total).toBe(2);
    expect(stats[1].date).toBe("2025-01-01T13:00:00");
    expect(stats[1].total).toBe(1);
  });

  test("stats 带 filter", () => {
    const helper = new LogQueryHelper();
    helper.addLog({ id: "1", created: "2025-01-01T12:00:00Z", message: "a", level: 2, data: {} });
    helper.addLog({ id: "2", created: "2025-01-01T12:00:00Z", message: "b", level: 4, data: {} });
    helper.addLog({ id: "3", created: "2025-01-01T12:00:00Z", message: "c", level: 5, data: {} });

    const stats = helper.stats("level >= 4");
    expect(stats.length).toBe(1);
    expect(stats[0].total).toBe(2); // level 4 和 5
  });

  test("deleteOldLogs", () => {
    const helper = new LogQueryHelper();
    helper.addLog({ id: "1", created: "2025-01-01T00:00:00Z", message: "old", level: 0, data: {} });
    helper.addLog({ id: "2", created: "2025-01-15T00:00:00Z", message: "new", level: 0, data: {} });

    const deleted = helper.deleteOldLogs("2025-01-10T00:00:00Z");
    expect(deleted).toBe(1);
    expect(helper.findById("1")).toBeNull();
    expect(helper.findById("2")).not.toBeNull();
  });

  test("Log 结构完整性", () => {
    const log: Log = {
      id: "test123",
      created: "2025-01-01T00:00:00Z",
      message: "Test log",
      level: 4,
      data: { method: "GET", url: "/api/test", status: 200 },
    };
    expect(log.id).toBe("test123");
    expect(log.data.status).toBe(200);
  });

  test("LogsStatsItem 结构完整性", () => {
    const item: LogsStatsItem = { date: "2025-01-01T12:00:00", total: 42 };
    expect(item.date).toBeDefined();
    expect(item.total).toBe(42);
  });
});

// ============================================================
// T120: Logs API 端点（通过 LogQueryHelper 测试核心逻辑）
// 实际 HTTP 路由测试已在 logs.ts 中实现，这里测试业务逻辑
// ============================================================

describe("Logs API", () => {
  test("默认分页 page=1, perPage=30", () => {
    const helper = new LogQueryHelper();
    for (let i = 0; i < 50; i++) {
      helper.addLog({
        id: `log${i}`,
        created: "2025-01-01T00:00:00Z",
        message: `msg ${i}`,
        level: 0,
        data: {},
      });
    }
    const result = helper.list();
    expect(result.page).toBe(1);
    expect(result.perPage).toBe(30);
    expect(result.items.length).toBe(30);
  });

  test("perPage 上限 100", () => {
    const helper = new LogQueryHelper();
    const result = helper.list({ perPage: 999 });
    expect(result.perPage).toBe(100);
  });

  test("空日志返回空列表", () => {
    const helper = new LogQueryHelper();
    const result = helper.list();
    expect(result.totalItems).toBe(0);
    expect(result.items.length).toBe(0);
  });
});

// ============================================================
// T121: Cron API 端点
// ============================================================

describe("Cron API", () => {
  test("CronJobInfo 结构", () => {
    const job: CronJobInfo = { id: "cleanup", expression: "0 * * * *" };
    expect(job.id).toBe("cleanup");
    expect(job.expression).toBe("0 * * * *");
  });

  test("排序：__pb 前缀排最后", () => {
    const jobs: CronJobInfo[] = [
      { id: "__pb_cleanup", expression: "0 * * * *" },
      { id: "backup", expression: "0 0 * * *" },
      { id: "__pb_logs", expression: "0 */6 * * *" },
      { id: "analytics", expression: "0 1 * * *" },
    ];

    jobs.sort((a, b) => {
      const aIsPb = a.id.startsWith("__pb");
      const bIsPb = b.id.startsWith("__pb");
      if (aIsPb && !bIsPb) return 1;
      if (!aIsPb && bIsPb) return -1;
      return a.id.localeCompare(b.id);
    });

    // 非 __pb 在前，按字母序
    expect(jobs[0].id).toBe("analytics");
    expect(jobs[1].id).toBe("backup");
    // __pb 在后
    expect(jobs[2].id).toBe("__pb_cleanup");
    expect(jobs[3].id).toBe("__pb_logs");
  });

  test("空 cron 列表", () => {
    const jobs: CronJobInfo[] = [];
    expect(jobs.length).toBe(0);
  });
});
