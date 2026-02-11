/**
 * T163 — db_adapter_postgres.test.ts
 * 测试 PostgresAdapter 的纯函数方法（不需要真实 PG 连接）
 * 同步方法抛错行为、格式化方法等
 */

import { describe, expect, test } from "bun:test";
import { PostgresAdapter } from "./db_adapter_postgres";

// 由于 PostgresAdapter 构造需要 Bun.SQL，我们只测试不需要真实连接的部分
// 构造函数测试通过 mock 或跳过

describe("PostgresAdapter — static methods", () => {
  // 创建一个伪实例来测试纯方法
  // 通过 prototype 绑定而非实际构造
  const proto = PostgresAdapter.prototype;

  test("type returns 'postgres'", () => {
    expect(proto.type()).toBe("postgres");
  });

  describe("boolValue", () => {
    const boolValue = proto.boolValue.bind(proto);
    test("true → true", () => expect(boolValue(true)).toBe(true));
    test("'true' → true", () => expect(boolValue("true")).toBe(true));
    test("'t' → true", () => expect(boolValue("t")).toBe(true));
    test("false → false", () => expect(boolValue(false)).toBe(false));
    test("'false' → false", () => expect(boolValue("false")).toBe(false));
    test("0 → false", () => expect(boolValue(0)).toBe(false));
    test("null → false", () => expect(boolValue(null)).toBe(false));
    test("1 → false (PG uses native bool)", () => expect(boolValue(1)).toBe(false));
  });

  describe("formatBool", () => {
    const formatBool = proto.formatBool.bind(proto);
    test("true → true", () => expect(formatBool(true)).toBe(true));
    test("false → false", () => expect(formatBool(false)).toBe(false));
  });

  describe("formatTime", () => {
    const formatTime = proto.formatTime.bind(proto);
    test("returns ISO string", () => {
      const d = new Date("2024-06-15T12:30:45.123Z");
      expect(formatTime(d)).toBe("2024-06-15T12:30:45.123Z");
    });
  });

  describe("jsonExtract", () => {
    const jsonExtract = proto.jsonExtract.bind(proto);
    test("generates PG ->> expression", () => {
      expect(jsonExtract("data", "name")).toBe("data->>'name'");
    });
  });

  describe("jsonArrayLength", () => {
    const jsonArrayLength = proto.jsonArrayLength.bind(proto);
    test("generates PG jsonb_array_length expression", () => {
      expect(jsonArrayLength("tags")).toBe("jsonb_array_length(tags)");
    });
  });

  describe("noCaseCollation", () => {
    test("returns COLLATE default", () => {
      expect(proto.noCaseCollation()).toBe('COLLATE "default"');
    });
  });

  describe("isUniqueViolation", () => {
    const check = proto.isUniqueViolation.bind(proto);
    test("detects unique_violation", () => {
      expect(check(new Error("unique_violation"))).toBe(true);
    });
    test("detects duplicate key", () => {
      expect(check(new Error("duplicate key value violates unique constraint"))).toBe(true);
    });
    test("non-unique error returns false", () => {
      expect(check(new Error("some other error"))).toBe(false);
    });
  });

  describe("isForeignKeyViolation", () => {
    const check = proto.isForeignKeyViolation.bind(proto);
    test("detects foreign_key_violation", () => {
      expect(check(new Error("foreign_key_violation"))).toBe(true);
    });
    test("detects violates foreign key", () => {
      expect(check(new Error("violates foreign key constraint"))).toBe(true);
    });
    test("non-FK error returns false", () => {
      expect(check(new Error("some other error"))).toBe(false);
    });
  });

  describe("sync methods throw", () => {
    test("exec throws with async hint", () => {
      expect(() => proto.exec("SELECT 1")).toThrow("execAsync");
    });
    test("query throws with async hint", () => {
      expect(() => proto.query("SELECT 1")).toThrow("queryAsync");
    });
    test("queryOne throws with async hint", () => {
      expect(() => proto.queryOne("SELECT 1")).toThrow("queryOneAsync");
    });
  });
});
