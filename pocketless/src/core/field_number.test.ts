/**
 * field_number.test.ts — T136 移植 Go 版 core/field_number_test.go
 * 对照 Go 版所有 test case
 */
import { describe, test, expect } from "bun:test";
import { NumberField } from "./field_number";
import { RecordModel } from "./record_model";
import { CollectionModel } from "./collection_model";

function newBaseCollection(name: string): CollectionModel {
  const c = new CollectionModel();
  c.name = name;
  return c;
}

function newRecordWithValue(collection: CollectionModel, fieldName: string, value: unknown): RecordModel {
  const record = new RecordModel(collection);
  record.set(fieldName, value);
  return record;
}

// ============================================================
// TestNumberFieldBaseMethods
// ============================================================
describe("NumberField base methods", () => {
  test("type is 'number'", () => {
    const f = new NumberField();
    expect(f.type).toBe("number");
  });

  test("default values", () => {
    const f = new NumberField();
    expect(f.id).toBe("");
    expect(f.name).toBe("");
    expect(f.system).toBe(false);
    expect(f.hidden).toBe(false);
    expect(f.required).toBe(false);
    expect(f.min).toBeNull();
    expect(f.max).toBeNull();
    expect(f.onlyInt).toBe(false);
  });
});

// ============================================================
// TestNumberFieldColumnType
// ============================================================
describe("NumberField columnType", () => {
  test("default column type", () => {
    const f = new NumberField();
    expect(f.columnType()).toBe("NUMERIC DEFAULT 0 NOT NULL");
  });
});

// ============================================================
// TestNumberFieldPrepareValue — 对照 Go 版所有类型转换
// ============================================================
describe("NumberField prepareValue", () => {
  const f = new NumberField();

  const scenarios: { raw: unknown; expected: number }[] = [
    { raw: "", expected: 0 },
    { raw: "test", expected: 0 },
    { raw: false, expected: 0 },
    { raw: true, expected: 1 },
    { raw: -2, expected: -2 },
    { raw: 123.456, expected: 123.456 },
    { raw: null, expected: 0 },
    { raw: undefined, expected: 0 },
  ];

  for (const s of scenarios) {
    test(`prepareValue(${JSON.stringify(s.raw)}) → ${s.expected}`, () => {
      const v = f.prepareValue(s.raw);
      expect(typeof v).toBe("number");
      expect(v).toBe(s.expected);
    });
  }
});

// ============================================================
// TestNumberFieldValidateValue — 对照 Go 版所有 scenario
// ============================================================
describe("NumberField validateValue", () => {
  const collection = newBaseCollection("test_collection");

  test("zero field value (not required)", () => {
    const f = new NumberField({ name: "test" });
    const err = f.validateValue(0, newRecordWithValue(collection, "test", 0));
    expect(err).toBeNull();
  });

  test("zero field value (required)", () => {
    const f = new NumberField({ name: "test", required: true });
    const err = f.validateValue(0, newRecordWithValue(collection, "test", 0));
    expect(err).not.toBeNull();
  });

  test("non-zero field value (required)", () => {
    const f = new NumberField({ name: "test", required: true });
    const err = f.validateValue(123, newRecordWithValue(collection, "test", 123));
    expect(err).toBeNull();
  });

  test("decimal with onlyInt", () => {
    const f = new NumberField({ name: "test", onlyInt: true });
    const err = f.validateValue(123.456, newRecordWithValue(collection, "test", 123.456));
    expect(err).not.toBeNull();
  });

  test("int with onlyInt", () => {
    const f = new NumberField({ name: "test", onlyInt: true });
    const err = f.validateValue(123.0, newRecordWithValue(collection, "test", 123.0));
    expect(err).toBeNull();
  });

  test("< min", () => {
    const f = new NumberField({ name: "test", min: 2.0 });
    const err = f.validateValue(1.0, newRecordWithValue(collection, "test", 1.0));
    expect(err).not.toBeNull();
  });

  test(">= min", () => {
    const f = new NumberField({ name: "test", min: 2.0 });
    const err = f.validateValue(2.0, newRecordWithValue(collection, "test", 2.0));
    expect(err).toBeNull();
  });

  test("> max", () => {
    const f = new NumberField({ name: "test", max: 2.0 });
    const err = f.validateValue(3.0, newRecordWithValue(collection, "test", 3.0));
    expect(err).not.toBeNull();
  });

  test("<= max", () => {
    const f = new NumberField({ name: "test", max: 2.0 });
    const err = f.validateValue(2.0, newRecordWithValue(collection, "test", 2.0));
    expect(err).toBeNull();
  });

  test("infinity", () => {
    const f = new NumberField({ name: "test" });
    const err = f.validateValue(Infinity, newRecordWithValue(collection, "test", Infinity));
    expect(err).not.toBeNull();
  });

  test("NaN", () => {
    const f = new NumberField({ name: "test" });
    const err = f.validateValue(NaN, newRecordWithValue(collection, "test", NaN));
    expect(err).not.toBeNull();
  });
});

// ============================================================
// TestNumberFieldValidateSettings — 对照 Go 版
// ============================================================
describe("NumberField validateSettings", () => {
  const collection = newBaseCollection("test_collection");

  test("zero - valid", () => {
    const f = new NumberField({ id: "test", name: "test" });
    const err = f.validateSettings(collection);
    expect(err).toBeNull();
  });

  test("decimal min (no onlyInt) - valid", () => {
    const f = new NumberField({ id: "test", name: "test", min: 1.2 });
    const err = f.validateSettings(collection);
    expect(err).toBeNull();
  });

  test("decimal min (onlyInt) - invalid", () => {
    const f = new NumberField({ id: "test", name: "test", onlyInt: true, min: 1.2 });
    const err = f.validateSettings(collection);
    expect(err).not.toBeNull();
  });

  test("int min (onlyInt) - valid", () => {
    const f = new NumberField({ id: "test", name: "test", onlyInt: true, min: 1.0 });
    const err = f.validateSettings(collection);
    expect(err).toBeNull();
  });

  test("decimal max (no onlyInt) - valid", () => {
    const f = new NumberField({ id: "test", name: "test", max: 1.2 });
    const err = f.validateSettings(collection);
    expect(err).toBeNull();
  });

  test("decimal max (onlyInt) - invalid", () => {
    const f = new NumberField({ id: "test", name: "test", onlyInt: true, max: 1.2 });
    const err = f.validateSettings(collection);
    expect(err).not.toBeNull();
  });

  test("int max (onlyInt) - valid", () => {
    const f = new NumberField({ id: "test", name: "test", onlyInt: true, max: 1.0 });
    const err = f.validateSettings(collection);
    expect(err).toBeNull();
  });

  test("min > max - invalid", () => {
    const f = new NumberField({ id: "test", name: "test", min: 2.0, max: 1.0 });
    const err = f.validateSettings(collection);
    expect(err).not.toBeNull();
  });

  test("min <= max - valid", () => {
    const f = new NumberField({ id: "test", name: "test", min: 2.0, max: 2.0 });
    const err = f.validateSettings(collection);
    expect(err).toBeNull();
  });
});
