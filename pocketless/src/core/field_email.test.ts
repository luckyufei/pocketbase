/**
 * field_email.test.ts — T138 移植 Go 版 core/field_email_test.go
 */
import { describe, test, expect } from "bun:test";
import { EmailField } from "./field_email";
import { RecordModel } from "./record_model";
import { CollectionModel } from "./collection_model";

function newBaseCollection(name: string): CollectionModel {
  const c = new CollectionModel();
  c.name = name;
  return c;
}

describe("EmailField base methods", () => {
  test("type is 'email'", () => {
    expect(new EmailField().type).toBe("email");
  });

  test("default values", () => {
    const f = new EmailField();
    expect(f.exceptDomains).toEqual([]);
    expect(f.onlyDomains).toEqual([]);
  });
});

describe("EmailField columnType", () => {
  test("default", () => {
    expect(new EmailField().columnType()).toBe("TEXT DEFAULT '' NOT NULL");
  });
});

describe("EmailField prepareValue", () => {
  const f = new EmailField();
  const scenarios: { raw: unknown; expected: string }[] = [
    { raw: "", expected: "" },
    { raw: "test", expected: "test" },
    { raw: false, expected: "false" },
    { raw: true, expected: "true" },
    { raw: 123.456, expected: "123.456" },
    { raw: null, expected: "" },
    { raw: undefined, expected: "" },
  ];
  for (const s of scenarios) {
    test(`prepareValue(${JSON.stringify(s.raw)}) → "${s.expected}"`, () => {
      expect(f.prepareValue(s.raw)).toBe(s.expected);
    });
  }
});

describe("EmailField validateValue", () => {
  const collection = newBaseCollection("test_collection");

  test("zero field value (not required)", () => {
    const f = new EmailField({ name: "test" });
    expect(f.validateValue("", new RecordModel(collection))).toBeNull();
  });

  test("zero field value (required)", () => {
    const f = new EmailField({ name: "test", required: true });
    expect(f.validateValue("", new RecordModel(collection))).not.toBeNull();
  });

  test("non-zero field value (required)", () => {
    const f = new EmailField({ name: "test", required: true });
    expect(f.validateValue("test@example.com", new RecordModel(collection))).toBeNull();
  });

  test("invalid email", () => {
    const f = new EmailField({ name: "test" });
    expect(f.validateValue("invalid", new RecordModel(collection))).not.toBeNull();
  });

  test("failed onlyDomains", () => {
    const f = new EmailField({ name: "test", onlyDomains: ["example.org", "example.net"] });
    expect(f.validateValue("test@example.com", new RecordModel(collection))).not.toBeNull();
  });

  test("success onlyDomains", () => {
    const f = new EmailField({ name: "test", onlyDomains: ["example.org", "example.com"] });
    expect(f.validateValue("test@example.com", new RecordModel(collection))).toBeNull();
  });

  test("failed exceptDomains", () => {
    const f = new EmailField({ name: "test", exceptDomains: ["example.org", "example.com"] });
    expect(f.validateValue("test@example.com", new RecordModel(collection))).not.toBeNull();
  });

  test("success exceptDomains", () => {
    const f = new EmailField({ name: "test", exceptDomains: ["example.org", "example.net"] });
    expect(f.validateValue("test@example.com", new RecordModel(collection))).toBeNull();
  });
});

describe("EmailField validateSettings", () => {
  const collection = newBaseCollection("test_collection");

  test("zero minimal", () => {
    const f = new EmailField({ id: "test", name: "test" });
    expect(f.validateSettings(collection)).toBeNull();
  });

  test("both onlyDomains and exceptDomains", () => {
    const f = new EmailField({
      id: "test", name: "test",
      onlyDomains: ["example.com"],
      exceptDomains: ["example.org"],
    });
    expect(f.validateSettings(collection)).not.toBeNull();
  });
});
