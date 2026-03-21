/**
 * field_bool.test.ts — T137 移植 Go 版 core/field_bool_test.go
 * 对照 Go 版所有 test case
 */
import { describe, test, expect } from "bun:test";
import { BoolField } from "./field_bool";
import { RecordModel } from "./record_model";
import { CollectionModel } from "./collection_model";

function newBaseCollection(name: string): CollectionModel {
  const c = new CollectionModel();
  c.name = name;
  return c;
}

// ============================================================
// TestBoolFieldBaseMethods
// ============================================================
describe("BoolField base methods", () => {
  test("type is 'bool'", () => {
    const f = new BoolField();
    expect(f.type).toBe("bool");
  });

  test("default values", () => {
    const f = new BoolField();
    expect(f.id).toBe("");
    expect(f.name).toBe("");
    expect(f.system).toBe(false);
    expect(f.hidden).toBe(false);
    expect(f.required).toBe(false);
  });
});

// ============================================================
// TestBoolFieldColumnType
// ============================================================
describe("BoolField columnType", () => {
  test("default column type", () => {
    const f = new BoolField();
    expect(f.columnType()).toBe("BOOLEAN DEFAULT FALSE NOT NULL");
  });
});

// ============================================================
// TestBoolFieldPrepareValue — 对照 Go 版 (strconv.ParseBool)
// ============================================================
describe("BoolField prepareValue", () => {
  const f = new BoolField();

  const scenarios: { raw: unknown; expected: boolean }[] = [
    { raw: "", expected: false },
    { raw: "f", expected: false },
    { raw: "t", expected: true },
    { raw: 1, expected: true },
    { raw: 0, expected: false },
    { raw: true, expected: true },
    { raw: false, expected: false },
    { raw: "true", expected: true },
    { raw: "false", expected: false },
    { raw: "1", expected: true },
    { raw: "0", expected: false },
    { raw: "yes", expected: true },
    { raw: null, expected: false },
    { raw: undefined, expected: false },
  ];

  for (const s of scenarios) {
    test(`prepareValue(${JSON.stringify(s.raw)}) → ${s.expected}`, () => {
      const v = f.prepareValue(s.raw);
      expect(v).toBe(s.expected);
    });
  }
});

// ============================================================
// TestBoolFieldValidateValue — 对照 Go 版所有 scenario
// ============================================================
describe("BoolField validateValue", () => {
  const collection = newBaseCollection("test_collection");

  test("false field value (non-required)", () => {
    const f = new BoolField({ name: "test" });
    const record = new RecordModel(collection);
    record.set("test", false);
    const err = f.validateValue(false, record);
    expect(err).toBeNull();
  });

  test("false field value (required)", () => {
    const f = new BoolField({ name: "test", required: true });
    const record = new RecordModel(collection);
    record.set("test", false);
    const err = f.validateValue(false, record);
    expect(err).not.toBeNull();
  });

  test("true field value (required)", () => {
    const f = new BoolField({ name: "test", required: true });
    const record = new RecordModel(collection);
    record.set("test", true);
    const err = f.validateValue(true, record);
    expect(err).toBeNull();
  });
});

// ============================================================
// TestBoolFieldValidateSettings
// ============================================================
describe("BoolField validateSettings", () => {
  test("always valid", () => {
    const f = new BoolField({ id: "test", name: "test" });
    const collection = newBaseCollection("test_collection");
    expect(f.validateSettings(collection)).toBeNull();
  });
});
