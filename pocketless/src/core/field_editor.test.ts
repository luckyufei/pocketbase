/**
 * field_editor.test.ts — T140 移植 Go 版 core/field_editor_test.go
 */
import { describe, test, expect } from "bun:test";
import { EditorField } from "./field_editor";
import { RecordModel } from "./record_model";
import { CollectionModel } from "./collection_model";

function newBaseCollection(name: string): CollectionModel {
  const c = new CollectionModel();
  c.name = name;
  return c;
}

const DEFAULT_MAX_SIZE = 5 << 20; // 5MB

describe("EditorField base methods", () => {
  test("type is 'editor'", () => {
    expect(new EditorField().type).toBe("editor");
  });
});

describe("EditorField columnType", () => {
  test("default", () => {
    expect(new EditorField().columnType()).toBe("TEXT DEFAULT '' NOT NULL");
  });
});

describe("EditorField prepareValue", () => {
  const f = new EditorField();
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

describe("EditorField validateValue", () => {
  const collection = newBaseCollection("test_collection");

  test("zero field value (not required)", () => {
    expect(new EditorField({ name: "test" }).validateValue("", new RecordModel(collection))).toBeNull();
  });

  test("zero field value (required)", () => {
    expect(new EditorField({ name: "test", required: true }).validateValue("", new RecordModel(collection))).not.toBeNull();
  });

  test("non-zero field value (required)", () => {
    expect(new EditorField({ name: "test", required: true }).validateValue("abc", new RecordModel(collection))).toBeNull();
  });

  test("> default MaxSize (5MB)", () => {
    const val = "a".repeat(1 + DEFAULT_MAX_SIZE);
    expect(new EditorField({ name: "test", required: true }).validateValue(val, new RecordModel(collection))).not.toBeNull();
  });

  test("> MaxSize", () => {
    expect(new EditorField({ name: "test", required: true, maxSize: 5 }).validateValue("abcdef", new RecordModel(collection))).not.toBeNull();
  });

  test("<= MaxSize", () => {
    expect(new EditorField({ name: "test", required: true, maxSize: 5 }).validateValue("abcde", new RecordModel(collection))).toBeNull();
  });
});

describe("EditorField validateSettings", () => {
  const collection = newBaseCollection("test_collection");

  test("< 0 MaxSize", () => {
    const f = new EditorField({ id: "test", name: "test", maxSize: -1 });
    expect(f.validateSettings(collection)).not.toBeNull();
  });

  test("= 0 MaxSize (default)", () => {
    const f = new EditorField({ id: "test", name: "test" });
    expect(f.validateSettings(collection)).toBeNull();
  });

  test("> 0 MaxSize", () => {
    const f = new EditorField({ id: "test", name: "test", maxSize: 1 });
    expect(f.validateSettings(collection)).toBeNull();
  });

  test("MaxSize > safe JSON int", () => {
    const f = new EditorField({ id: "test", name: "test", maxSize: 2 ** 53 });
    expect(f.validateSettings(collection)).not.toBeNull();
  });
});
