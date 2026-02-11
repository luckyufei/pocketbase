/**
 * field_relation.test.ts — T145 移植 Go 版 core/field_relation_test.go
 * 注意：ValidateValue 中 ID 存在性检查需要真实数据库，这里只测 TS 层的逻辑
 */
import { describe, test, expect } from "bun:test";
import { RelationField } from "./field_relation";
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
// TestRelationFieldBaseMethods
// ============================================================
describe("RelationField base methods", () => {
  test("type is 'relation'", () => {
    expect(new RelationField().type).toBe("relation");
  });

  test("default values", () => {
    const f = new RelationField();
    expect(f.id).toBe("");
    expect(f.name).toBe("");
    expect(f.system).toBe(false);
    expect(f.hidden).toBe(false);
    expect(f.required).toBe(false);
    expect(f.collectionId).toBe("");
    expect(f.cascadeDelete).toBe(false);
    expect(f.minSelect).toBe(0);
    expect(f.maxSelect).toBe(1);
  });

  test("constructor with options", () => {
    const f = new RelationField({
      id: "r1",
      name: "author",
      collectionId: "col_123",
      cascadeDelete: true,
      minSelect: 1,
      maxSelect: 5,
    });
    expect(f.id).toBe("r1");
    expect(f.name).toBe("author");
    expect(f.collectionId).toBe("col_123");
    expect(f.cascadeDelete).toBe(true);
    expect(f.minSelect).toBe(1);
    expect(f.maxSelect).toBe(5);
  });
});

// ============================================================
// TestRelationFieldIsMultiple
// ============================================================
describe("RelationField isMultiple", () => {
  test("zero → false", () => {
    expect(new RelationField().isMultiple()).toBe(false);
  });

  test("maxSelect=1 → false", () => {
    expect(new RelationField({ maxSelect: 1 }).isMultiple()).toBe(false);
  });

  test("maxSelect=2 → true", () => {
    expect(new RelationField({ maxSelect: 2 }).isMultiple()).toBe(true);
  });
});

// ============================================================
// TestRelationFieldColumnType
// ============================================================
describe("RelationField columnType", () => {
  test("single (zero) → TEXT", () => {
    expect(new RelationField().columnType()).toBe("TEXT DEFAULT '' NOT NULL");
  });

  test("single → TEXT", () => {
    expect(new RelationField({ maxSelect: 1 }).columnType()).toBe("TEXT DEFAULT '' NOT NULL");
  });

  test("multiple SQLite → JSON", () => {
    expect(new RelationField({ maxSelect: 2 }).columnType(false)).toBe("JSON DEFAULT '[]' NOT NULL");
  });

  test("multiple PostgreSQL → JSONB", () => {
    expect(new RelationField({ maxSelect: 2 }).columnType(true)).toBe("JSONB DEFAULT '[]' NOT NULL");
  });
});

// ============================================================
// TestRelationFieldPrepareValue
// ============================================================
describe("RelationField prepareValue", () => {
  // single
  test("[single] null → ''", () => {
    expect(new RelationField({ maxSelect: 1 }).prepareValue(null)).toBe("");
  });

  test("[single] '' → ''", () => {
    expect(new RelationField({ maxSelect: 1 }).prepareValue("")).toBe("");
  });

  test("[single] 123 → '123'", () => {
    expect(new RelationField({ maxSelect: 1 }).prepareValue(123)).toBe("123");
  });

  test("[single] 'a' → 'a'", () => {
    expect(new RelationField({ maxSelect: 1 }).prepareValue("a")).toBe("a");
  });

  test('[single] \'["a"]\' → "a"', () => {
    expect(new RelationField({ maxSelect: 1 }).prepareValue('["a"]')).toBe("a");
  });

  test("[single] [] → ''", () => {
    expect(new RelationField({ maxSelect: 1 }).prepareValue([])).toBe("");
  });

  test("[single] ['a','b'] → 'b'", () => {
    expect(new RelationField({ maxSelect: 1 }).prepareValue(["a", "b"])).toBe("b");
  });

  // multiple
  const multi = new RelationField({ maxSelect: 2 });

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
// TestRelationFieldValidateValue (逻辑验证，不查数据库)
// ============================================================
describe("RelationField validateValue", () => {
  const collection = newBaseCollection("test_collection");

  // single
  test("[single] zero (not required) → null", () => {
    const f = new RelationField({ name: "test", maxSelect: 1, collectionId: "col1" });
    const record = newRecordWithRaw(collection, "test", "");
    expect(f.validateValue("", record)).toBeNull();
  });

  test("[single] zero (required) → error", () => {
    const f = new RelationField({ name: "test", maxSelect: 1, collectionId: "col1", required: true });
    const record = newRecordWithRaw(collection, "test", "");
    expect(f.validateValue("", record)).not.toBeNull();
  });

  test("[single] > MaxSelect → error", () => {
    const f = new RelationField({ name: "test", maxSelect: 1, collectionId: "col1" });
    const record = newRecordWithRaw(collection, "test", ["a", "b"]);
    expect(f.validateValue(["a", "b"], record)).not.toBeNull();
  });

  // multiple
  test("[multiple] zero (not required) → null", () => {
    const f = new RelationField({ name: "test", maxSelect: 2, collectionId: "col1" });
    const record = newRecordWithRaw(collection, "test", []);
    expect(f.validateValue([], record)).toBeNull();
  });

  test("[multiple] zero (required) → error", () => {
    const f = new RelationField({ name: "test", maxSelect: 2, collectionId: "col1", required: true });
    const record = newRecordWithRaw(collection, "test", []);
    expect(f.validateValue([], record)).not.toBeNull();
  });

  test("[multiple] > MaxSelect → error", () => {
    const f = new RelationField({ name: "test", maxSelect: 2, collectionId: "col1" });
    const record = newRecordWithRaw(collection, "test", ["a", "b", "c"]);
    expect(f.validateValue(["a", "b", "c"], record)).not.toBeNull();
  });

  test("[multiple] < MinSelect → error", () => {
    const f = new RelationField({ name: "test", minSelect: 2, maxSelect: 99, collectionId: "col1" });
    const record = newRecordWithRaw(collection, "test", ["a"]);
    expect(f.validateValue(["a"], record)).not.toBeNull();
  });

  test("[multiple] >= MinSelect → null", () => {
    const f = new RelationField({ name: "test", minSelect: 2, maxSelect: 99, collectionId: "col1" });
    const record = newRecordWithRaw(collection, "test", ["a", "b", "c"]);
    expect(f.validateValue(["a", "b", "c"], record)).toBeNull();
  });
});

// ============================================================
// TestRelationFieldValidateSettings
// ============================================================
describe("RelationField validateSettings", () => {
  const collection = newBaseCollection("test_collection");

  test("zero minimal → error (no collectionId)", () => {
    const f = new RelationField({ id: "test", name: "test" });
    expect(f.validateSettings(collection)).not.toBeNull();
  });

  test("valid collectionId → null", () => {
    const f = new RelationField({ id: "test", name: "test", collectionId: "col_123" });
    expect(f.validateSettings(collection)).toBeNull();
  });
});
