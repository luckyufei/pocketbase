/**
 * field_vector.test.ts — T150 移植 Go 版 core/field_vector_test.go
 */
import { describe, test, expect } from "bun:test";
import { VectorField } from "./field_vector";
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
// TestVectorFieldBaseMethods
// ============================================================
describe("VectorField base methods", () => {
  test("type is 'vector'", () => {
    expect(new VectorField().type).toBe("vector");
  });

  test("default values", () => {
    const f = new VectorField();
    expect(f.id).toBe("");
    expect(f.name).toBe("");
    expect(f.system).toBe(false);
    expect(f.hidden).toBe(false);
    expect(f.required).toBe(false);
    expect(f.dimension).toBe(0);
    expect(f.indexType).toBe("");
    expect(f.distanceFunc).toBe("");
  });

  test("constructor with options", () => {
    const f = new VectorField({
      id: "v1",
      name: "embedding",
      dimension: 1536,
      indexType: "hnsw",
      distanceFunc: "cosine",
      required: true,
    });
    expect(f.id).toBe("v1");
    expect(f.name).toBe("embedding");
    expect(f.dimension).toBe(1536);
    expect(f.indexType).toBe("hnsw");
    expect(f.distanceFunc).toBe("cosine");
    expect(f.required).toBe(true);
  });
});

// ============================================================
// TestVectorFieldColumnType
// ============================================================
describe("VectorField columnType", () => {
  test("SQLite → JSON DEFAULT '[]' NOT NULL", () => {
    const f = new VectorField({ dimension: 1536 });
    expect(f.columnType(false)).toBe("JSON DEFAULT '[]' NOT NULL");
  });

  test("PostgreSQL with dimension → vector(1536)", () => {
    const f = new VectorField({ dimension: 1536 });
    expect(f.columnType(true)).toBe("vector(1536)");
  });

  test("PostgreSQL without dimension → vector", () => {
    const f = new VectorField();
    expect(f.columnType(true)).toBe("vector");
  });
});

// ============================================================
// TestVectorFieldPrepareValue
// ============================================================
describe("VectorField prepareValue", () => {
  const f = new VectorField({ dimension: 3 });

  test("null → []", () => {
    expect(f.prepareValue(null)).toEqual([]);
  });

  test("undefined → []", () => {
    expect(f.prepareValue(undefined)).toEqual([]);
  });

  test("[1,2,3] → [1,2,3]", () => {
    expect(f.prepareValue([1, 2, 3])).toEqual([1, 2, 3]);
  });

  test("[1.0,2.0,3.0] → [1,2,3]", () => {
    expect(f.prepareValue([1.0, 2.0, 3.0])).toEqual([1, 2, 3]);
  });

  test("JSON string '[1.5,2.5,3.5]'", () => {
    expect(f.prepareValue("[1.5,2.5,3.5]")).toEqual([1.5, 2.5, 3.5]);
  });

  test("mixed array [1,'2',3]", () => {
    expect(f.prepareValue([1, "2", 3])).toEqual([1, 2, 3]);
  });

  test("array with NaN/Infinity filtered", () => {
    const result = f.prepareValue([1, NaN, Infinity, 2]);
    expect(result).toEqual([1, 2]);
  });
});

// ============================================================
// TestVectorFieldValidateValue
// ============================================================
describe("VectorField validateValue", () => {
  const collection = newBaseCollection("test_collection");

  test("empty (non-required) → null", () => {
    const f = new VectorField({ name: "test", dimension: 3 });
    const record = newRecordWithRaw(collection, "test", []);
    expect(f.validateValue([], record)).toBeNull();
  });

  test("empty (required) → error", () => {
    const f = new VectorField({ name: "test", dimension: 3, required: true });
    const record = newRecordWithRaw(collection, "test", []);
    expect(f.validateValue([], record)).not.toBeNull();
  });

  test("valid vector → null", () => {
    const f = new VectorField({ name: "test", dimension: 3 });
    const vec = [1.0, 2.0, 3.0];
    const record = newRecordWithRaw(collection, "test", vec);
    expect(f.validateValue(vec, record)).toBeNull();
  });

  test("dimension mismatch → error", () => {
    const f = new VectorField({ name: "test", dimension: 3 });
    const vec = [1.0, 2.0];
    const record = newRecordWithRaw(collection, "test", vec);
    expect(f.validateValue(vec, record)).not.toBeNull();
  });

  test("exceeds max dimension (16000) → error", () => {
    const f = new VectorField({ name: "test" });
    const vec = new Array(16001).fill(1.0);
    const record = newRecordWithRaw(collection, "test", vec);
    expect(f.validateValue(vec, record)).not.toBeNull();
  });

  test("contains NaN → error", () => {
    const f = new VectorField({ name: "test", dimension: 3 });
    const vec = [1.0, NaN, 3.0];
    const record = newRecordWithRaw(collection, "test", vec);
    expect(f.validateValue(vec, record)).not.toBeNull();
  });

  test("contains Infinity → error", () => {
    const f = new VectorField({ name: "test", dimension: 3 });
    const vec = [1.0, Infinity, 3.0];
    const record = newRecordWithRaw(collection, "test", vec);
    expect(f.validateValue(vec, record)).not.toBeNull();
  });

  test("no dimension constraint → null for any length", () => {
    const f = new VectorField({ name: "test" });
    const vec = [1, 2, 3, 4, 5];
    const record = newRecordWithRaw(collection, "test", vec);
    expect(f.validateValue(vec, record)).toBeNull();
  });
});

// ============================================================
// TestVectorFieldValidateSettings
// ============================================================
describe("VectorField validateSettings", () => {
  const collection = newBaseCollection("test_collection");

  test("dimension = 0 → null", () => {
    const f = new VectorField({ id: "test", name: "test" });
    expect(f.validateSettings(collection)).toBeNull();
  });

  test("dimension > 0 → null", () => {
    const f = new VectorField({ id: "test", name: "test", dimension: 1536 });
    expect(f.validateSettings(collection)).toBeNull();
  });

  test("dimension < 0 → error", () => {
    const f = new VectorField({ id: "test", name: "test", dimension: -1 });
    expect(f.validateSettings(collection)).not.toBeNull();
  });

  test("dimension > 16000 → error", () => {
    const f = new VectorField({ id: "test", name: "test", dimension: 16001 });
    expect(f.validateSettings(collection)).not.toBeNull();
  });
});

// ============================================================
// TestVectorFieldDriverValue
// ============================================================
describe("VectorField driverValue", () => {
  test("array → JSON string", () => {
    const f = new VectorField({ name: "test" });
    expect(f.driverValue([1, 2, 3])).toBe("[1,2,3]");
  });

  test("empty array → '[]'", () => {
    const f = new VectorField({ name: "test" });
    expect(f.driverValue([])).toBe("[]");
  });

  test("non-array → '[]'", () => {
    const f = new VectorField({ name: "test" });
    expect(f.driverValue("not array")).toBe("[]");
  });
});
