/**
 * T159 — base_model.test.ts
 * 对照 Go 版 core/base_model_test.go
 * 测试 BaseModel：ID 生成、isNew 状态、时间戳、load/toJSON
 */

import { describe, expect, test } from "bun:test";
import { BaseModel } from "./base_model";

describe("BaseModel constructor", () => {
  test("auto-generates 15-char ID", () => {
    const m = new BaseModel("test_table");
    expect(m.id).toBeDefined();
    expect(typeof m.id).toBe("string");
    expect(m.id.length).toBe(15);
  });

  test("each instance has unique ID", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(new BaseModel("t").id);
    }
    expect(ids.size).toBe(100);
  });

  test("created and updated are empty string", () => {
    const m = new BaseModel("t");
    expect(m.created).toBe("");
    expect(m.updated).toBe("");
  });

  test("tableName returns constructor arg", () => {
    const m = new BaseModel("my_table");
    expect(m.tableName()).toBe("my_table");
  });
});

describe("BaseModel isNew / markAsNotNew / markAsNew", () => {
  test("new instance is new by default", () => {
    const m = new BaseModel("t");
    expect(m.isNew()).toBe(true);
  });

  test("markAsNotNew toggles isNew to false", () => {
    const m = new BaseModel("t");
    m.markAsNotNew();
    expect(m.isNew()).toBe(false);
  });

  test("markAsNew toggles isNew back to true", () => {
    const m = new BaseModel("t");
    m.markAsNotNew();
    expect(m.isNew()).toBe(false);
    m.markAsNew();
    expect(m.isNew()).toBe(true);
  });

  test("multiple markAsNotNew calls are idempotent", () => {
    const m = new BaseModel("t");
    m.markAsNotNew();
    m.markAsNotNew();
    expect(m.isNew()).toBe(false);
  });
});

describe("BaseModel refreshTimestamps", () => {
  test("new model — sets both created and updated", () => {
    const m = new BaseModel("t");
    expect(m.created).toBe("");
    m.refreshTimestamps();
    expect(m.created).not.toBe("");
    expect(m.updated).not.toBe("");
    // created and updated should be equal on first refresh
    expect(m.created).toBe(m.updated);
  });

  test("existing model — only updates 'updated'", () => {
    const m = new BaseModel("t");
    m.refreshTimestamps(); // 设置 created
    const origCreated = m.created;
    m.markAsNotNew();
    // 稍微等待确保时间戳可能不同（但 DateTime.now() 可能太快，所以只检查 created 不变）
    m.refreshTimestamps();
    expect(m.created).toBe(origCreated);
    expect(m.updated).toBeDefined();
    expect(m.updated).not.toBe("");
  });

  test("timestamp format is valid datetime string", () => {
    const m = new BaseModel("t");
    m.refreshTimestamps();
    // SQLite 格式：YYYY-MM-DD HH:mm:ss.SSSZ
    expect(m.created).toMatch(/^\d{4}-\d{2}-\d{2}/);
  });
});

describe("BaseModel load", () => {
  test("load sets id, created, updated from data", () => {
    const m = new BaseModel("t");
    m.load({
      id: "abc123def456789",
      created: "2024-01-01 00:00:00.000Z",
      updated: "2024-06-15 12:30:00.000Z",
    });
    expect(m.id).toBe("abc123def456789");
    expect(m.created).toBe("2024-01-01 00:00:00.000Z");
    expect(m.updated).toBe("2024-06-15 12:30:00.000Z");
  });

  test("load marks model as not new", () => {
    const m = new BaseModel("t");
    expect(m.isNew()).toBe(true);
    m.load({ id: "test_id" });
    expect(m.isNew()).toBe(false);
  });

  test("load with empty data — keeps auto-generated values", () => {
    const m = new BaseModel("t");
    const origId = m.id;
    m.load({});
    expect(m.id).toBe(origId); // id not overwritten by empty data
    expect(m.isNew()).toBe(false); // still marked as not new
  });

  test("load with partial data — only overrides present fields", () => {
    const m = new BaseModel("t");
    m.load({ id: "custom_id" });
    expect(m.id).toBe("custom_id");
    expect(m.created).toBe(""); // not overridden
    expect(m.updated).toBe(""); // not overridden
  });
});

describe("BaseModel toJSON", () => {
  test("returns id, created, updated", () => {
    const m = new BaseModel("t");
    m.load({
      id: "json_test_id",
      created: "2024-01-01 00:00:00.000Z",
      updated: "2024-01-02 00:00:00.000Z",
    });
    const json = m.toJSON();
    expect(json).toEqual({
      id: "json_test_id",
      created: "2024-01-01 00:00:00.000Z",
      updated: "2024-01-02 00:00:00.000Z",
    });
  });

  test("does not include tableName or isNew", () => {
    const m = new BaseModel("t");
    const json = m.toJSON();
    expect(json).not.toHaveProperty("tableName");
    expect(json).not.toHaveProperty("_tableName");
    expect(json).not.toHaveProperty("isNew");
    expect(json).not.toHaveProperty("_isNew");
  });

  test("JSON.stringify roundtrip", () => {
    const m = new BaseModel("t");
    m.load({ id: "rt_id", created: "2024-01-01", updated: "2024-01-02" });
    const str = JSON.stringify(m);
    const parsed = JSON.parse(str);
    expect(parsed.id).toBe("rt_id");
    expect(parsed.created).toBe("2024-01-01");
    expect(parsed.updated).toBe("2024-01-02");
  });
});
