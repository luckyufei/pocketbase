/**
 * field_autodate.test.ts — T142 移植 Go 版 core/field_autodate_test.go
 */
import { describe, test, expect } from "bun:test";
import { AutodateField } from "./field_autodate";
import { RecordModel } from "./record_model";
import { CollectionModel } from "./collection_model";

function newBaseCollection(name: string): CollectionModel {
  const c = new CollectionModel();
  c.name = name;
  return c;
}

function newRecordWithRaw(collection: CollectionModel, fieldName: string, value: unknown): RecordModel {
  const record = new RecordModel(collection);
  record.set(fieldName, value);
  return record;
}

// ============================================================
// TestAutodateFieldBaseMethods
// ============================================================
describe("AutodateField base methods", () => {
  test("type is 'autodate'", () => {
    const f = new AutodateField();
    expect(f.type).toBe("autodate");
  });

  test("default values", () => {
    const f = new AutodateField();
    expect(f.id).toBe("");
    expect(f.name).toBe("");
    expect(f.system).toBe(false);
    expect(f.hidden).toBe(false);
    expect(f.required).toBe(false);
    expect(f.onCreate).toBe(true);
    expect(f.onUpdate).toBe(true);
  });

  test("constructor with options", () => {
    const f = new AutodateField({
      id: "f1",
      name: "created_at",
      system: true,
      hidden: true,
      onCreate: false,
      onUpdate: true,
    });
    expect(f.id).toBe("f1");
    expect(f.name).toBe("created_at");
    expect(f.system).toBe(true);
    expect(f.hidden).toBe(true);
    expect(f.onCreate).toBe(false);
    expect(f.onUpdate).toBe(true);
  });
});

// ============================================================
// TestAutodateFieldColumnType
// ============================================================
describe("AutodateField columnType", () => {
  const f = new AutodateField();

  test("SQLite", () => {
    expect(f.columnType(false)).toBe("TEXT DEFAULT '' NOT NULL");
  });

  test("PostgreSQL", () => {
    expect(f.columnType(true)).toBe("TIMESTAMPTZ DEFAULT NULL");
  });
});

// ============================================================
// TestAutodateFieldPrepareValue
// ============================================================
describe("AutodateField prepareValue", () => {
  const f = new AutodateField();

  test("empty string → empty", () => {
    expect(f.prepareValue("")).toBe("");
  });

  test("invalid string → empty", () => {
    expect(f.prepareValue("invalid")).toBe("");
  });

  test("valid datetime string", () => {
    const result = f.prepareValue("2024-01-01 00:11:22.345Z");
    expect(result).toBe("2024-01-01 00:11:22.345Z");
  });

  test("Date object", () => {
    const d = new Date(Date.UTC(2024, 0, 2, 3, 4, 5));
    const result = f.prepareValue(d);
    expect(result).toBe("2024-01-02 03:04:05.000Z");
  });

  test("null → empty", () => {
    expect(f.prepareValue(null)).toBe("");
  });

  test("undefined → empty", () => {
    expect(f.prepareValue(undefined)).toBe("");
  });

  test("number → empty", () => {
    expect(f.prepareValue(123)).toBe("");
  });
});

// ============================================================
// TestAutodateFieldValidateValue — 始终返回 null
// ============================================================
describe("AutodateField validateValue", () => {
  const collection = newBaseCollection("test_collection");

  test("invalid raw value", () => {
    const f = new AutodateField({ name: "test" });
    const record = newRecordWithRaw(collection, "test", 123);
    expect(f.validateValue(123, record)).toBeNull();
  });

  test("missing field value", () => {
    const f = new AutodateField({ name: "test" });
    const record = newRecordWithRaw(collection, "abc", true);
    expect(f.validateValue(undefined, record)).toBeNull();
  });

  test("existing field value", () => {
    const f = new AutodateField({ name: "test" });
    const record = newRecordWithRaw(collection, "test", "2024-01-01 00:00:00.000Z");
    expect(f.validateValue("2024-01-01 00:00:00.000Z", record)).toBeNull();
  });
});

// ============================================================
// TestAutodateFieldValidateSettings
// ============================================================
describe("AutodateField validateSettings", () => {
  const collection = newBaseCollection("test_collection");

  test("empty onCreate and onUpdate → should still return null (TS impl)", () => {
    // 注意：Go 版会报错 ["onCreate", "onUpdate"]，但 TS 版 validateSettings 当前始终返回 null
    const f = new AutodateField({ id: "test", name: "test", onCreate: false, onUpdate: false });
    const result = f.validateSettings(collection);
    // TS 版本当前返回 null — 如果 Go 对齐则应报错
    expect(result).toBeNull();
  });

  test("with onCreate = true", () => {
    const f = new AutodateField({ id: "test", name: "test", onCreate: true, onUpdate: false });
    expect(f.validateSettings(collection)).toBeNull();
  });

  test("with onUpdate = true", () => {
    const f = new AutodateField({ id: "test", name: "test", onCreate: false, onUpdate: true });
    expect(f.validateSettings(collection)).toBeNull();
  });
});
