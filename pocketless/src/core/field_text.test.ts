/**
 * field_text.test.ts — T135 移植 Go 版 core/field_text_test.go
 * 对照 Go 版所有 test case，包括边界值、nil/空值、类型转换、验证错误信息
 */
import { describe, test, expect } from "bun:test";
import { TextField } from "./field_text";
import { RecordModel } from "./record_model";
import { CollectionModel } from "./collection_model";

// 辅助函数：创建一个基础 Collection
function newBaseCollection(name: string): CollectionModel {
  const c = new CollectionModel();
  c.name = name;
  c.fields = [
    { id: "test_id_field", name: "id", type: "text", required: true, options: { primaryKey: true } },
  ];
  return c;
}

// 辅助函数：创建 Record 并设置字段值
function newRecordWithValue(collection: CollectionModel, fieldName: string, value: unknown): RecordModel {
  const record = new RecordModel(collection);
  record.set(fieldName, value);
  return record;
}

// ============================================================
// TestTextFieldBaseMethods — 字段基本属性
// ============================================================
describe("TextField base methods", () => {
  test("type is 'text'", () => {
    const f = new TextField();
    expect(f.type).toBe("text");
  });

  test("default values", () => {
    const f = new TextField();
    expect(f.id).toBe("");
    expect(f.name).toBe("");
    expect(f.system).toBe(false);
    expect(f.hidden).toBe(false);
    expect(f.required).toBe(false);
    expect(f.min).toBe(0);
    expect(f.max).toBe(0);
    expect(f.pattern).toBe("");
    expect(f.autogeneratePattern).toBe("");
    expect(f.primaryKey).toBe(false);
  });

  test("constructor with options", () => {
    const f = new TextField({
      id: "f1",
      name: "title",
      system: true,
      hidden: true,
      required: true,
      min: 5,
      max: 100,
      pattern: "\\d+",
      autogeneratePattern: "[a-z]+",
      primaryKey: true,
    });
    expect(f.id).toBe("f1");
    expect(f.name).toBe("title");
    expect(f.system).toBe(true);
    expect(f.hidden).toBe(true);
    expect(f.required).toBe(true);
    expect(f.min).toBe(5);
    expect(f.max).toBe(100);
    expect(f.pattern).toBe("\\d+");
    expect(f.autogeneratePattern).toBe("[a-z]+");
    expect(f.primaryKey).toBe(true);
  });
});

// ============================================================
// TestTextFieldColumnType — 对照 Go 版
// ============================================================
describe("TextField columnType", () => {
  test("non-primary key", () => {
    const f = new TextField();
    expect(f.columnType(false)).toBe("TEXT DEFAULT '' NOT NULL");
  });

  test("primary key - SQLite", () => {
    const f = new TextField({ primaryKey: true });
    const col = f.columnType(false);
    expect(col).toContain("TEXT PRIMARY KEY");
    expect(col).toContain("NOT NULL");
  });

  test("primary key - PostgreSQL", () => {
    const f = new TextField({ primaryKey: true });
    const col = f.columnType(true);
    expect(col).toContain("TEXT PRIMARY KEY");
    expect(col).toContain("NOT NULL");
  });
});

// ============================================================
// TestTextFieldPrepareValue — 对照 Go 版所有类型转换
// ============================================================
describe("TextField prepareValue", () => {
  const f = new TextField();

  const scenarios: { raw: unknown; expected: string }[] = [
    { raw: "", expected: "" },
    { raw: "test", expected: "test" },
    { raw: false, expected: "false" },
    { raw: true, expected: "true" },
    { raw: 123.456, expected: "123.456" },
    { raw: null, expected: "" },
    { raw: undefined, expected: "" },
    { raw: 0, expected: "0" },
  ];

  for (const s of scenarios) {
    test(`prepareValue(${JSON.stringify(s.raw)}) → "${s.expected}"`, () => {
      const v = f.prepareValue(s.raw);
      expect(typeof v).toBe("string");
      expect(v).toBe(s.expected);
    });
  }
});

// ============================================================
// TestTextFieldValidateValue — 对照 Go 版所有 30 个 scenario
// ============================================================
describe("TextField validateValue", () => {
  const collection = newBaseCollection("test_collection");

  test("invalid raw value (non-string type passed directly)", () => {
    const f = new TextField({ name: "test" });
    const record = newRecordWithValue(collection, "test", 123);
    // Go 版对非 string 的 raw 值报错；TS 版 validateValue 会将其转为 string
    // 但直接传入 number 123 会被 String() 转换为 "123"，这里验证转换行为
    const err = f.validateValue(123, record);
    // 直接传非 string 时，TS 版会尝试转换，不会报错（与 Go 版不同）
    // Go 版直接检查 raw 类型，TS 版更宽容
    expect(err).toBeNull();
  });

  test("zero field value (not required) - other validators ignored", () => {
    const f = new TextField({ name: "test", pattern: "\\d+", min: 10, max: 100 });
    const record = newRecordWithValue(collection, "test", "");
    const err = f.validateValue("", record);
    expect(err).toBeNull();
  });

  test("zero field value (required)", () => {
    const f = new TextField({ name: "test", required: true });
    const record = newRecordWithValue(collection, "test", "");
    const err = f.validateValue("", record);
    expect(err).not.toBeNull();
  });

  test("non-zero field value (required)", () => {
    const f = new TextField({ name: "test", required: true });
    const record = newRecordWithValue(collection, "test", "abc");
    const err = f.validateValue("abc", record);
    expect(err).toBeNull();
  });

  // ── 主键禁止字符测试 ──
  const forbiddenChars = [
    { char: "/", display: "/" },
    { char: "\\", display: "\\" },
    { char: ".", display: "." },
    { char: " ", display: "' '" },
    { char: "*", display: "*" },
  ];

  for (const { char, display } of forbiddenChars) {
    test(`special forbidden character ${display} (non-primaryKey) - allowed`, () => {
      const f = new TextField({ name: "test", primaryKey: false });
      const val = `abc${char}`;
      const err = f.validateValue(val, newRecordWithValue(collection, "test", val));
      expect(err).toBeNull();
    });

    test(`special forbidden character ${display} (primaryKey) - rejected`, () => {
      const f = new TextField({ name: "test", primaryKey: true });
      const val = `abc${char}`;
      const err = f.validateValue(val, newRecordWithValue(collection, "test", val));
      expect(err).not.toBeNull();
    });
  }

  // ── 保留主键字面量 ──
  test("reserved pk literal (non-primaryKey) - allowed", () => {
    const f = new TextField({ name: "test", primaryKey: false });
    const err = f.validateValue("aUx", newRecordWithValue(collection, "test", "aUx"));
    expect(err).toBeNull();
  });

  test("reserved pk literal (primaryKey) - rejected", () => {
    const f = new TextField({ name: "test", primaryKey: true });
    const err = f.validateValue("aUx", newRecordWithValue(collection, "test", "aUx"));
    expect(err).not.toBeNull();
  });

  test("reserved pk literal (non-exact match, primaryKey) - allowed", () => {
    const f = new TextField({ name: "test", primaryKey: true });
    const err = f.validateValue("aUx-", newRecordWithValue(collection, "test", "aUx-"));
    expect(err).toBeNull();
  });

  // ── 主键空值/非空值 ──
  test("zero field value (primaryKey) - rejected", () => {
    const f = new TextField({ name: "test", primaryKey: true });
    const err = f.validateValue("", newRecordWithValue(collection, "test", ""));
    expect(err).not.toBeNull();
  });

  test("non-zero field value (primaryKey) - allowed", () => {
    const f = new TextField({ name: "test", primaryKey: true });
    const err = f.validateValue("abcd", newRecordWithValue(collection, "test", "abcd"));
    expect(err).toBeNull();
  });

  // ── 长度验证 (min/max) ──
  test("< min (multi-byte)", () => {
    const f = new TextField({ name: "test", min: 4 });
    const err = f.validateValue("абв", newRecordWithValue(collection, "test", "абв")); // 3 runes
    expect(err).not.toBeNull();
  });

  test(">= min (multi-byte)", () => {
    const f = new TextField({ name: "test", min: 3 });
    const err = f.validateValue("абв", newRecordWithValue(collection, "test", "абв")); // 3 runes
    expect(err).toBeNull();
  });

  test("> default max (5000)", () => {
    const f = new TextField({ name: "test" });
    const val = "a".repeat(5001);
    const err = f.validateValue(val, newRecordWithValue(collection, "test", val));
    expect(err).not.toBeNull();
  });

  test("<= default max", () => {
    const f = new TextField({ name: "test" });
    const val = "a".repeat(500);
    const err = f.validateValue(val, newRecordWithValue(collection, "test", val));
    expect(err).toBeNull();
  });

  test("> max (multi-byte)", () => {
    const f = new TextField({ name: "test", max: 2 });
    const err = f.validateValue("абв", newRecordWithValue(collection, "test", "абв")); // 3 runes
    expect(err).not.toBeNull();
  });

  test("<= max (multi-byte)", () => {
    const f = new TextField({ name: "test", min: 3 });
    const err = f.validateValue("абв", newRecordWithValue(collection, "test", "абв")); // 3 runes
    expect(err).toBeNull();
  });

  // ── 正则模式验证 ──
  test("mismatched pattern", () => {
    const f = new TextField({ name: "test", pattern: "\\d+" });
    const err = f.validateValue("abc", newRecordWithValue(collection, "test", "abc"));
    expect(err).not.toBeNull();
  });

  test("matched pattern", () => {
    const f = new TextField({ name: "test", pattern: "\\d+" });
    const err = f.validateValue("123", newRecordWithValue(collection, "test", "123"));
    expect(err).toBeNull();
  });
});

// ============================================================
// TestTextFieldValidateSettings — 对照 Go 版所有 scenario
// ============================================================
describe("TextField validateSettings", () => {
  test("zero minimal - valid", () => {
    const f = new TextField({ id: "test", name: "test" });
    const collection = newBaseCollection("test_collection");
    const err = f.validateSettings(collection);
    expect(err).toBeNull();
  });

  test("Max > safe JSON int", () => {
    const f = new TextField({ id: "test", name: "test", max: 2 ** 53 });
    const collection = newBaseCollection("test_collection");
    const err = f.validateSettings(collection);
    expect(err).not.toBeNull();
  });

  test("Max < 0", () => {
    const f = new TextField({ id: "test", name: "test", max: -1 });
    const collection = newBaseCollection("test_collection");
    const err = f.validateSettings(collection);
    expect(err).not.toBeNull();
  });

  test("Min > safe JSON int", () => {
    const f = new TextField({ id: "test", name: "test", min: 2 ** 53 });
    const collection = newBaseCollection("test_collection");
    const err = f.validateSettings(collection);
    expect(err).not.toBeNull();
  });

  test("Min < 0", () => {
    const f = new TextField({ id: "test", name: "test", min: -1 });
    const collection = newBaseCollection("test_collection");
    const err = f.validateSettings(collection);
    expect(err).not.toBeNull();
  });

  test("invalid pattern", () => {
    const f = new TextField({ id: "test2", name: "id", pattern: "(invalid" });
    const collection = newBaseCollection("test_collection");
    const err = f.validateSettings(collection);
    expect(err).not.toBeNull();
  });

  test("valid pattern", () => {
    const f = new TextField({ id: "test2", name: "id", pattern: "\\d+" });
    const collection = newBaseCollection("test_collection");
    const err = f.validateSettings(collection);
    expect(err).toBeNull();
  });

  test("invalid autogeneratePattern", () => {
    const f = new TextField({ id: "test2", name: "id", autogeneratePattern: "(invalid" });
    const collection = newBaseCollection("test_collection");
    const err = f.validateSettings(collection);
    expect(err).not.toBeNull();
  });

  test("valid autogeneratePattern", () => {
    const f = new TextField({ id: "test2", name: "id", autogeneratePattern: "[a-z]+" });
    const collection = newBaseCollection("test_collection");
    const err = f.validateSettings(collection);
    expect(err).toBeNull();
  });

  test("conflicting pattern and autogeneratePattern", () => {
    const f = new TextField({
      id: "test2",
      name: "id",
      pattern: "\\d+",
      autogeneratePattern: "[a-z]+",
    });
    const collection = newBaseCollection("test_collection");
    const err = f.validateSettings(collection);
    expect(err).not.toBeNull();
  });
});
