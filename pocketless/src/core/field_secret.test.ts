/**
 * field_secret.test.ts — T149 移植 Go 版 core/field_secret_test.go
 * 注意：加密/解密/MasterKey 相关逻辑需要完整 App，这里只测 TS 层逻辑
 */
import { describe, test, expect } from "bun:test";
import { SecretField, type SecretFieldValue } from "./field_secret";
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
// TestSecretFieldBaseMethods
// ============================================================
describe("SecretField base methods", () => {
  test("type is 'secret'", () => {
    expect(new SecretField().type).toBe("secret");
  });

  test("default values", () => {
    const f = new SecretField();
    expect(f.id).toBe("");
    expect(f.name).toBe("");
    expect(f.system).toBe(false);
    expect(f.hidden).toBe(true); // default hidden
    expect(f.required).toBe(false);
    expect(f.maxSize).toBe(0);
  });
});

// ============================================================
// TestSecretFieldColumnType
// ============================================================
describe("SecretField columnType", () => {
  test("returns TEXT DEFAULT '' NOT NULL", () => {
    expect(new SecretField().columnType()).toBe("TEXT DEFAULT '' NOT NULL");
  });
});

// ============================================================
// TestSecretFieldPrepareValue
// ============================================================
describe("SecretField prepareValue", () => {
  const f = new SecretField({ name: "test" });

  test("'' → encrypted=''", () => {
    const v = f.prepareValue("");
    expect(v.encrypted).toBe("");
    expect(v.plain).toBe("");
  });

  test("'test' → encrypted='test'", () => {
    const v = f.prepareValue("test");
    expect(v.encrypted).toBe("test");
  });

  test("'sk-xxx-123' → encrypted='sk-xxx-123'", () => {
    const v = f.prepareValue("sk-xxx-123");
    expect(v.encrypted).toBe("sk-xxx-123");
  });

  test("existing SecretFieldValue passed through", () => {
    const existing: SecretFieldValue = { plain: "abc", encrypted: "enc123" };
    const v = f.prepareValue(existing);
    expect(v.plain).toBe("abc");
    expect(v.encrypted).toBe("enc123");
  });
});

// ============================================================
// TestSecretFieldValidateValue
// ============================================================
describe("SecretField validateValue", () => {
  const collection = newBaseCollection("test_collection");

  test("zero field value (not required) → null", () => {
    const f = new SecretField({ name: "test" });
    const sfv: SecretFieldValue = { plain: "", encrypted: "" };
    const record = newRecordWithRaw(collection, "test", sfv);
    expect(f.validateValue(sfv, record)).toBeNull();
  });

  test("zero field value (required) → error", () => {
    const f = new SecretField({ name: "test", required: true });
    const sfv: SecretFieldValue = { plain: "", encrypted: "" };
    const record = newRecordWithRaw(collection, "test", sfv);
    expect(f.validateValue(sfv, record)).not.toBeNull();
  });

  test("non-empty encrypted (required) → null", () => {
    const f = new SecretField({ name: "test", required: true });
    const sfv: SecretFieldValue = { plain: "", encrypted: "enc_data" };
    const record = newRecordWithRaw(collection, "test", sfv);
    expect(f.validateValue(sfv, record)).toBeNull();
  });

  test("with lastError → error", () => {
    const f = new SecretField({ name: "test" });
    const sfv: SecretFieldValue = { plain: "", encrypted: "", lastError: new Error("test") };
    const record = newRecordWithRaw(collection, "test", sfv);
    expect(f.validateValue(sfv, record)).not.toBeNull();
  });

  test("> default MaxSize (4096) → error", () => {
    const f = new SecretField({ name: "test" });
    const sfv: SecretFieldValue = { plain: "a".repeat(4097), encrypted: "" };
    const record = newRecordWithRaw(collection, "test", sfv);
    expect(f.validateValue(sfv, record)).not.toBeNull();
  });

  test("<= default MaxSize → null", () => {
    const f = new SecretField({ name: "test" });
    const sfv: SecretFieldValue = { plain: "a".repeat(4096), encrypted: "" };
    const record = newRecordWithRaw(collection, "test", sfv);
    expect(f.validateValue(sfv, record)).toBeNull();
  });

  test("> custom MaxSize → error", () => {
    const f = new SecretField({ name: "test", maxSize: 5 });
    const sfv: SecretFieldValue = { plain: "abcdef", encrypted: "" };
    const record = newRecordWithRaw(collection, "test", sfv);
    expect(f.validateValue(sfv, record)).not.toBeNull();
  });

  test("<= custom MaxSize → null", () => {
    const f = new SecretField({ name: "test", maxSize: 5 });
    const sfv: SecretFieldValue = { plain: "abcde", encrypted: "" };
    const record = newRecordWithRaw(collection, "test", sfv);
    expect(f.validateValue(sfv, record)).toBeNull();
  });
});

// ============================================================
// TestSecretFieldValidateSettings
// ============================================================
describe("SecretField validateSettings", () => {
  const collection = newBaseCollection("test_collection");

  test("always null", () => {
    const f = new SecretField({ id: "test", name: "test" });
    expect(f.validateSettings(collection)).toBeNull();
  });
});

// ============================================================
// TestSecretFieldDriverValue
// ============================================================
describe("SecretField driverValue", () => {
  test("empty SecretFieldValue → ''", () => {
    const f = new SecretField({ name: "test" });
    const sfv: SecretFieldValue = { plain: "", encrypted: "" };
    expect(f.driverValue(sfv)).toBe("");
  });

  test("with encrypted → returns encrypted", () => {
    const f = new SecretField({ name: "test" });
    const sfv: SecretFieldValue = { plain: "plain_val", encrypted: "enc_val" };
    expect(f.driverValue(sfv)).toBe("enc_val");
  });
});
