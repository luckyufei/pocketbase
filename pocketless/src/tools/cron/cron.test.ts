/**
 * Cron scheduler wrapper 测试 — 对照 Go 版 tools/cron 测试
 * 覆盖: Cron, Job, Schedule
 */

import { describe, test, expect } from "bun:test";
import {
  Cron,
  Job,
  Schedule,
  type Moment,
  newMoment,
} from "./cron";

// ==================== Schedule 测试 ====================

describe("Schedule", () => {
  test("parse valid cron expressions", () => {
    const cases: [string, boolean][] = [
      ["* * * * *", true],
      ["0 0 * * *", true],
      ["*/5 * * * *", true],
      ["0 0 1 1 *", true],
      ["0-30 * * * *", true],
      ["0,15,30,45 * * * *", true],
      ["1-30/5 * * * *", true],
    ];

    for (const [expr, shouldPass] of cases) {
      const schedule = Schedule.parse(expr);
      if (shouldPass) {
        expect(schedule).toBeDefined();
      }
    }
  });

  test("parse invalid expressions", () => {
    const invalid = ["", "* *", "* * * * * *", "60 * * * *", "* 24 * * *", "* * 32 * *", "* * * 13 *", "* * * * 7"];

    for (const expr of invalid) {
      expect(() => Schedule.parse(expr)).toThrow();
    }
  });

  test("parse macros", () => {
    const macros: [string, string][] = [
      ["@yearly", "0 0 1 1 *"],
      ["@annually", "0 0 1 1 *"],
      ["@monthly", "0 0 1 * *"],
      ["@weekly", "0 0 * * 0"],
      ["@daily", "0 0 * * *"],
      ["@midnight", "0 0 * * *"],
      ["@hourly", "0 * * * *"],
    ];

    for (const [macro, _equivalent] of macros) {
      const schedule = Schedule.parse(macro);
      expect(schedule).toBeDefined();
    }
  });

  test("isDue matching", () => {
    // "0 0 * * *" = midnight daily
    const schedule = Schedule.parse("0 0 * * *");
    const midnight: Moment = { minute: 0, hour: 0, day: 15, month: 6, dayOfWeek: 3 };
    const noon: Moment = { minute: 0, hour: 12, day: 15, month: 6, dayOfWeek: 3 };

    expect(schedule.isDue(midnight)).toBe(true);
    expect(schedule.isDue(noon)).toBe(false);
  });

  test("isDue with wildcard", () => {
    // "* * * * *" = every minute
    const schedule = Schedule.parse("* * * * *");
    const any: Moment = { minute: 30, hour: 14, day: 5, month: 3, dayOfWeek: 1 };
    expect(schedule.isDue(any)).toBe(true);
  });

  test("isDue with ranges", () => {
    // "0-30 * * * *" = first 31 minutes
    const schedule = Schedule.parse("0-30 * * * *");
    const m15: Moment = { minute: 15, hour: 0, day: 1, month: 1, dayOfWeek: 0 };
    const m45: Moment = { minute: 45, hour: 0, day: 1, month: 1, dayOfWeek: 0 };

    expect(schedule.isDue(m15)).toBe(true);
    expect(schedule.isDue(m45)).toBe(false);
  });

  test("isDue with steps", () => {
    // "*/15 * * * *" = every 15 minutes (0, 15, 30, 45)
    const schedule = Schedule.parse("*/15 * * * *");

    expect(schedule.isDue({ minute: 0, hour: 0, day: 1, month: 1, dayOfWeek: 0 })).toBe(true);
    expect(schedule.isDue({ minute: 15, hour: 0, day: 1, month: 1, dayOfWeek: 0 })).toBe(true);
    expect(schedule.isDue({ minute: 30, hour: 0, day: 1, month: 1, dayOfWeek: 0 })).toBe(true);
    expect(schedule.isDue({ minute: 10, hour: 0, day: 1, month: 1, dayOfWeek: 0 })).toBe(false);
  });

  test("isDue with list", () => {
    // "0,15,30,45 * * * *"
    const schedule = Schedule.parse("0,15,30,45 * * * *");

    expect(schedule.isDue({ minute: 0, hour: 0, day: 1, month: 1, dayOfWeek: 0 })).toBe(true);
    expect(schedule.isDue({ minute: 15, hour: 0, day: 1, month: 1, dayOfWeek: 0 })).toBe(true);
    expect(schedule.isDue({ minute: 10, hour: 0, day: 1, month: 1, dayOfWeek: 0 })).toBe(false);
  });

  test("isDue with day of week", () => {
    // "0 9 * * 1" = Monday at 9:00
    const schedule = Schedule.parse("0 9 * * 1");
    const monday: Moment = { minute: 0, hour: 9, day: 10, month: 6, dayOfWeek: 1 };
    const tuesday: Moment = { minute: 0, hour: 9, day: 11, month: 6, dayOfWeek: 2 };

    expect(schedule.isDue(monday)).toBe(true);
    expect(schedule.isDue(tuesday)).toBe(false);
  });
});

// ==================== Moment 测试 ====================

describe("Moment", () => {
  test("newMoment extracts fields from Date", () => {
    const date = new Date(2025, 5, 15, 14, 30, 0); // June 15 2025 14:30
    const m = newMoment(date);

    expect(m.minute).toBe(30);
    expect(m.hour).toBe(14);
    expect(m.day).toBe(15);
    expect(m.month).toBe(6); // 1-based
    expect(m.dayOfWeek).toBe(date.getDay());
  });
});

// ==================== Job 测试 ====================

describe("Job", () => {
  test("job properties", () => {
    const job = new Job("test-job", "*/5 * * * *", () => {});
    expect(job.id).toBe("test-job");
    expect(job.expression).toBe("*/5 * * * *");
  });

  test("job run executes function", () => {
    let called = false;
    const job = new Job("test", "* * * * *", () => {
      called = true;
    });
    job.run();
    expect(called).toBe(true);
  });

  test("job run with null function is safe", () => {
    const job = new Job("test", "* * * * *", null as any);
    expect(() => job.run()).not.toThrow();
  });

  test("job marshalJSON", () => {
    const job = new Job("my-job", "0 0 * * *", () => {});
    const json = job.toJSON();
    expect(json).toEqual({ id: "my-job", expression: "0 0 * * *" });
  });
});

// ==================== Cron 测试 ====================

describe("Cron", () => {
  test("add and remove jobs", () => {
    const cron = new Cron();
    cron.add("job1", "* * * * *", () => {});
    expect(cron.total()).toBe(1);

    cron.add("job2", "0 0 * * *", () => {});
    expect(cron.total()).toBe(2);

    cron.remove("job1");
    expect(cron.total()).toBe(1);
  });

  test("add replaces existing job with same ID", () => {
    const cron = new Cron();
    let value = 0;

    cron.add("job1", "* * * * *", () => {
      value = 1;
    });
    cron.add("job1", "0 * * * *", () => {
      value = 2;
    });

    expect(cron.total()).toBe(1);
    const jobs = cron.jobs();
    expect(jobs[0].expression).toBe("0 * * * *");
    jobs[0].run();
    expect(value).toBe(2);
  });

  test("add validates cron expression", () => {
    const cron = new Cron();
    expect(() => cron.add("bad", "invalid", () => {})).toThrow();
  });

  test("mustAdd panics on invalid expression", () => {
    const cron = new Cron();
    expect(() => cron.mustAdd("bad", "invalid", () => {})).toThrow();
  });

  test("removeAll clears jobs", () => {
    const cron = new Cron();
    cron.add("job1", "* * * * *", () => {});
    cron.add("job2", "* * * * *", () => {});
    expect(cron.total()).toBe(2);

    cron.removeAll();
    expect(cron.total()).toBe(0);
  });

  test("jobs returns shallow copy", () => {
    const cron = new Cron();
    cron.add("job1", "* * * * *", () => {});

    const jobs1 = cron.jobs();
    const jobs2 = cron.jobs();
    expect(jobs1).not.toBe(jobs2);
    expect(jobs1.length).toBe(jobs2.length);
  });

  test("start and stop", () => {
    const cron = new Cron();
    expect(cron.hasStarted()).toBe(false);

    cron.start();
    expect(cron.hasStarted()).toBe(true);

    cron.stop();
    expect(cron.hasStarted()).toBe(false);
  });

  test("stop is idempotent", () => {
    const cron = new Cron();
    cron.stop();
    cron.stop();
    expect(cron.hasStarted()).toBe(false);
  });

  test("setInterval changes interval", () => {
    const cron = new Cron();
    cron.setInterval(5000);
    expect(cron.interval).toBe(5000);
  });

  test("setTimezone changes timezone", () => {
    const cron = new Cron();
    cron.setTimezone("America/New_York");
    expect(cron.timezone).toBe("America/New_York");
  });

  test("remove non-existent job is safe", () => {
    const cron = new Cron();
    expect(() => cron.remove("nonexistent")).not.toThrow();
  });
});
