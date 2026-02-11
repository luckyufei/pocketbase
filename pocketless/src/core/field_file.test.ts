/**
 * field_file.test.ts — T144 移植 Go 版 core/field_file_test.go
 * 注意：File 相关的 Intercept/Tx/Filesystem 等需要完整 App 的测试暂不移植
 */
import { describe, test, expect } from "bun:test";
import { FileField } from "./field_file";
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
// TestFileFieldBaseMethods
// ============================================================
describe("FileField base methods", () => {
  test("type is 'file'", () => {
    expect(new FileField().type).toBe("file");
  });

  test("default values", () => {
    const f = new FileField();
    expect(f.id).toBe("");
    expect(f.name).toBe("");
    expect(f.system).toBe(false);
    expect(f.hidden).toBe(false);
    expect(f.required).toBe(false);
    expect(f.maxSize).toBe(5 << 20); // 5MB default
    expect(f.maxSelect).toBe(1);
    expect(f.mimeTypes).toEqual([]);
    expect(f.thumbs).toEqual([]);
  });
});

// ============================================================
// TestFileFieldIsMultiple
// ============================================================
describe("FileField isMultiple", () => {
  test("zero → false", () => {
    expect(new FileField().isMultiple()).toBe(false);
  });

  test("maxSelect=1 → false", () => {
    expect(new FileField({ maxSelect: 1 }).isMultiple()).toBe(false);
  });

  test("maxSelect=2 → true", () => {
    expect(new FileField({ maxSelect: 2 }).isMultiple()).toBe(true);
  });
});

// ============================================================
// TestFileFieldColumnType
// ============================================================
describe("FileField columnType", () => {
  test("single (zero) → TEXT", () => {
    expect(new FileField().columnType()).toBe("TEXT DEFAULT '' NOT NULL");
  });

  test("single → TEXT", () => {
    expect(new FileField({ maxSelect: 1 }).columnType()).toBe("TEXT DEFAULT '' NOT NULL");
  });

  test("multiple SQLite → JSON", () => {
    expect(new FileField({ maxSelect: 2 }).columnType(false)).toBe("JSON DEFAULT '[]' NOT NULL");
  });

  test("multiple PostgreSQL → JSONB", () => {
    expect(new FileField({ maxSelect: 2 }).columnType(true)).toBe("JSONB DEFAULT '[]' NOT NULL");
  });
});

// ============================================================
// TestFileFieldPrepareValue (string-based only, no filesystem.File)
// ============================================================
describe("FileField prepareValue", () => {
  // single
  test("[single] null → ''", () => {
    expect(new FileField().prepareValue(null)).toBe("");
  });

  test("[single] '' → ''", () => {
    expect(new FileField().prepareValue("")).toBe("");
  });

  test("[single] 123 → '123'", () => {
    expect(new FileField().prepareValue(123)).toBe("123");
  });

  test("[single] 'a' → 'a'", () => {
    expect(new FileField().prepareValue("a")).toBe("a");
  });

  test('[single] \'["a"]\' → "a"', () => {
    expect(new FileField().prepareValue('["a"]')).toBe("a");
  });

  test("[single] [] → ''", () => {
    expect(new FileField().prepareValue([])).toBe("");
  });

  test("[single] ['a','b'] → 'b' (last)", () => {
    expect(new FileField().prepareValue(["a", "b"])).toBe("b");
  });

  // multiple
  const multi = new FileField({ maxSelect: 2 });

  test("[multiple] null → []", () => {
    expect(multi.prepareValue(null)).toEqual([]);
  });

  test("[multiple] '' → []", () => {
    expect(multi.prepareValue("")).toEqual([]);
  });

  test("[multiple] 123 → ['123']", () => {
    expect(multi.prepareValue(123)).toEqual(["123"]);
  });

  test("[multiple] 'a' → ['a']", () => {
    expect(multi.prepareValue("a")).toEqual(["a"]);
  });

  test('[multiple] \'["a"]\' → ["a"]', () => {
    expect(multi.prepareValue('["a"]')).toEqual(["a"]);
  });

  test("[multiple] [] → []", () => {
    expect(multi.prepareValue([])).toEqual([]);
  });

  test("[multiple] ['a','b','c'] → ['a','b','c']", () => {
    expect(multi.prepareValue(["a", "b", "c"])).toEqual(["a", "b", "c"]);
  });
});

// ============================================================
// TestFileFieldValidateValue (string-based only)
// ============================================================
describe("FileField validateValue", () => {
  const collection = newBaseCollection("test_collection");

  test("zero (not required) → null", () => {
    const f = new FileField({ name: "test", maxSize: 9999, maxSelect: 1 });
    const record = newRecordWithRaw(collection, "test", "");
    expect(f.validateValue("", record)).toBeNull();
  });

  test("zero (required) → error", () => {
    const f = new FileField({ name: "test", maxSize: 9999, maxSelect: 1, required: true });
    const record = newRecordWithRaw(collection, "test", "");
    expect(f.validateValue("", record)).not.toBeNull();
  });

  test("> MaxSelect → error", () => {
    const f = new FileField({ name: "test", maxSize: 9999, maxSelect: 1 });
    const record = newRecordWithRaw(collection, "test", ["a", "b"]);
    expect(f.validateValue(["a", "b"], record)).not.toBeNull();
  });

  test("<= MaxSelect → null", () => {
    const f = new FileField({ name: "test", maxSize: 9999, maxSelect: 2 });
    const record = newRecordWithRaw(collection, "test", ["a", "b"]);
    expect(f.validateValue(["a", "b"], record)).toBeNull();
  });
});

// ============================================================
// TestFileFieldValidateSettings
// ============================================================
describe("FileField validateSettings", () => {
  const collection = newBaseCollection("test_collection");

  test("zero minimal → null", () => {
    const f = new FileField({ id: "test", name: "test" });
    expect(f.validateSettings(collection)).toBeNull();
  });
});
