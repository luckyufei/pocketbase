/**
 * field_password.test.ts — T147 移植 Go 版 core/field_password_test.go
 */
import { describe, test, expect } from "bun:test";
import { PasswordField, type PasswordFieldValue } from "./field_password";
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
// TestPasswordFieldBaseMethods
// ============================================================
describe("PasswordField base methods", () => {
  test("type is 'password'", () => {
    expect(new PasswordField().type).toBe("password");
  });

  test("default values", () => {
    const f = new PasswordField();
    expect(f.id).toBe("");
    expect(f.name).toBe("");
    expect(f.system).toBe(false);
    expect(f.hidden).toBe(true); // default hidden
    expect(f.required).toBe(false);
    expect(f.min).toBe(0);
    expect(f.max).toBe(0);
    expect(f.cost).toBe(12);
    expect(f.pattern).toBe("");
  });
});

// ============================================================
// TestPasswordFieldColumnType
// ============================================================
describe("PasswordField columnType", () => {
  test("returns TEXT DEFAULT '' NOT NULL", () => {
    expect(new PasswordField().columnType()).toBe("TEXT DEFAULT '' NOT NULL");
  });
});

// ============================================================
// TestPasswordFieldPrepareValue
// ============================================================
describe("PasswordField prepareValue", () => {
  const f = new PasswordField();

  test("'' → hash=''", () => {
    const v = f.prepareValue("");
    expect(v.hash).toBe("");
  });

  test("'test' → hash='test'", () => {
    const v = f.prepareValue("test");
    expect(v.hash).toBe("test");
  });

  test("false → hash='false'", () => {
    const v = f.prepareValue(false);
    expect(v.hash).toBe("false");
  });

  test("true → hash='true'", () => {
    const v = f.prepareValue(true);
    expect(v.hash).toBe("true");
  });

  test("123.456 → hash='123.456'", () => {
    const v = f.prepareValue(123.456);
    expect(v.hash).toBe("123.456");
  });

  test("existing PasswordFieldValue passed through", () => {
    const existing: PasswordFieldValue = { hash: "abc", plain: "xyz" };
    const v = f.prepareValue(existing);
    expect(v.hash).toBe("abc");
    expect(v.plain).toBe("xyz");
  });
});

// ============================================================
// TestPasswordFieldValidateValue
// ============================================================
describe("PasswordField validateValue", () => {
  const collection = newBaseCollection("test_collection");

  test("zero field value (not required) → null", () => {
    const f = new PasswordField({ name: "test" });
    const pfv: PasswordFieldValue = { hash: "", plain: "" };
    const record = newRecordWithRaw(collection, "test", pfv);
    expect(f.validateValue(pfv, record)).toBeNull();
  });

  test("zero field value (required) → error", () => {
    const f = new PasswordField({ name: "test", required: true });
    const pfv: PasswordFieldValue = { hash: "", plain: "" };
    const record = newRecordWithRaw(collection, "test", pfv);
    expect(f.validateValue(pfv, record)).not.toBeNull();
  });

  test("non-empty hash (required) → null", () => {
    const f = new PasswordField({ name: "test", required: true });
    const pfv: PasswordFieldValue = { hash: "test", plain: "" };
    const record = newRecordWithRaw(collection, "test", pfv);
    expect(f.validateValue(pfv, record)).toBeNull();
  });

  test("with lastError → error", () => {
    const f = new PasswordField({ name: "test" });
    const pfv: PasswordFieldValue = { hash: "", plain: "", lastError: new Error("test") };
    const record = newRecordWithRaw(collection, "test", pfv);
    expect(f.validateValue(pfv, record)).not.toBeNull();
  });

  test("< Min (multi-byte) → error", () => {
    const f = new PasswordField({ name: "test", min: 3 });
    const pfv: PasswordFieldValue = { hash: "", plain: "аб" }; // 2 chars (cyrillic)
    const record = newRecordWithRaw(collection, "test", pfv);
    expect(f.validateValue(pfv, record)).not.toBeNull();
  });

  test(">= Min (multi-byte) → null", () => {
    const f = new PasswordField({ name: "test", min: 3 });
    const pfv: PasswordFieldValue = { hash: "", plain: "абв" }; // 3 chars
    const record = newRecordWithRaw(collection, "test", pfv);
    expect(f.validateValue(pfv, record)).toBeNull();
  });

  test("> default Max (71) → error", () => {
    const f = new PasswordField({ name: "test" });
    const pfv: PasswordFieldValue = { hash: "", plain: "a".repeat(72) };
    const record = newRecordWithRaw(collection, "test", pfv);
    expect(f.validateValue(pfv, record)).not.toBeNull();
  });

  test("<= default Max (71) → null", () => {
    const f = new PasswordField({ name: "test" });
    const pfv: PasswordFieldValue = { hash: "", plain: "a".repeat(71) };
    const record = newRecordWithRaw(collection, "test", pfv);
    expect(f.validateValue(pfv, record)).toBeNull();
  });

  test("> Max → error", () => {
    const f = new PasswordField({ name: "test", max: 2 });
    const pfv: PasswordFieldValue = { hash: "", plain: "абв" }; // 3 chars
    const record = newRecordWithRaw(collection, "test", pfv);
    expect(f.validateValue(pfv, record)).not.toBeNull();
  });

  test("<= Max → null", () => {
    const f = new PasswordField({ name: "test", max: 2 });
    const pfv: PasswordFieldValue = { hash: "", plain: "аб" }; // 2 chars
    const record = newRecordWithRaw(collection, "test", pfv);
    expect(f.validateValue(pfv, record)).toBeNull();
  });

  test("non-matching pattern → error", () => {
    const f = new PasswordField({ name: "test", pattern: "\\d+" });
    const pfv: PasswordFieldValue = { hash: "", plain: "abc" };
    const record = newRecordWithRaw(collection, "test", pfv);
    expect(f.validateValue(pfv, record)).not.toBeNull();
  });

  test("matching pattern → null", () => {
    const f = new PasswordField({ name: "test", pattern: "\\d+" });
    const pfv: PasswordFieldValue = { hash: "", plain: "123" };
    const record = newRecordWithRaw(collection, "test", pfv);
    expect(f.validateValue(pfv, record)).toBeNull();
  });
});

// ============================================================
// TestPasswordFieldValidateSettings
// ============================================================
describe("PasswordField validateSettings", () => {
  const collection = newBaseCollection("test_collection");

  test("zero minimal → null", () => {
    const f = new PasswordField({ id: "test", name: "test" });
    expect(f.validateSettings(collection)).toBeNull();
  });

  test("Min > Max → error", () => {
    const f = new PasswordField({ id: "test", name: "test", min: 2, max: 1 });
    expect(f.validateSettings(collection)).not.toBeNull();
  });

  test("Max > Min → null", () => {
    const f = new PasswordField({ id: "test", name: "test", min: 2, max: 3 });
    expect(f.validateSettings(collection)).toBeNull();
  });

  test("cost < 4 → error", () => {
    const f = new PasswordField({ id: "test", name: "test", cost: 3 });
    expect(f.validateSettings(collection)).not.toBeNull();
  });

  test("cost > 31 → error", () => {
    const f = new PasswordField({ id: "test", name: "test", cost: 32 });
    expect(f.validateSettings(collection)).not.toBeNull();
  });

  test("valid cost → null", () => {
    const f = new PasswordField({ id: "test", name: "test", cost: 12 });
    expect(f.validateSettings(collection)).toBeNull();
  });
});
