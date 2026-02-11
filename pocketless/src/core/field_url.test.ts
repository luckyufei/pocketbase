/**
 * field_url.test.ts — T139 移植 Go 版 core/field_url_test.go
 */
import { describe, test, expect } from "bun:test";
import { URLField } from "./field_url";
import { RecordModel } from "./record_model";
import { CollectionModel } from "./collection_model";

function newBaseCollection(name: string): CollectionModel {
  const c = new CollectionModel();
  c.name = name;
  return c;
}

describe("URLField base methods", () => {
  test("type is 'url'", () => {
    expect(new URLField().type).toBe("url");
  });
});

describe("URLField columnType", () => {
  test("default", () => {
    expect(new URLField().columnType()).toBe("TEXT DEFAULT '' NOT NULL");
  });
});

describe("URLField prepareValue", () => {
  const f = new URLField();
  const scenarios: { raw: unknown; expected: string }[] = [
    { raw: "", expected: "" },
    { raw: "test", expected: "test" },
    { raw: false, expected: "false" },
    { raw: true, expected: "true" },
    { raw: 123.456, expected: "123.456" },
  ];
  for (const s of scenarios) {
    test(`prepareValue(${JSON.stringify(s.raw)}) → "${s.expected}"`, () => {
      expect(f.prepareValue(s.raw)).toBe(s.expected);
    });
  }
});

describe("URLField validateValue", () => {
  const collection = newBaseCollection("test_collection");

  test("zero field value (not required)", () => {
    expect(new URLField({ name: "test" }).validateValue("", new RecordModel(collection))).toBeNull();
  });

  test("zero field value (required)", () => {
    expect(new URLField({ name: "test", required: true }).validateValue("", new RecordModel(collection))).not.toBeNull();
  });

  test("non-zero field value (required)", () => {
    expect(new URLField({ name: "test", required: true }).validateValue("https://example.com", new RecordModel(collection))).toBeNull();
  });

  test("invalid url", () => {
    expect(new URLField({ name: "test" }).validateValue("invalid", new RecordModel(collection))).not.toBeNull();
  });

  test("failed onlyDomains", () => {
    const f = new URLField({ name: "test", onlyDomains: ["example.org", "example.net"] });
    expect(f.validateValue("https://example.com", new RecordModel(collection))).not.toBeNull();
  });

  test("success onlyDomains", () => {
    const f = new URLField({ name: "test", onlyDomains: ["example.org", "example.com"] });
    expect(f.validateValue("https://example.com", new RecordModel(collection))).toBeNull();
  });

  test("failed exceptDomains", () => {
    const f = new URLField({ name: "test", exceptDomains: ["example.org", "example.com"] });
    expect(f.validateValue("https://example.com", new RecordModel(collection))).not.toBeNull();
  });

  test("success exceptDomains", () => {
    const f = new URLField({ name: "test", exceptDomains: ["example.org", "example.net"] });
    expect(f.validateValue("https://example.com", new RecordModel(collection))).toBeNull();
  });
});

describe("URLField validateSettings", () => {
  const collection = newBaseCollection("test_collection");

  test("zero minimal", () => {
    expect(new URLField({ id: "test", name: "test" }).validateSettings(collection)).toBeNull();
  });

  test("both onlyDomains and exceptDomains", () => {
    const f = new URLField({
      id: "test", name: "test",
      onlyDomains: ["example.com"],
      exceptDomains: ["example.org"],
    });
    expect(f.validateSettings(collection)).not.toBeNull();
  });
});
