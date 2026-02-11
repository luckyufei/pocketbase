/**
 * field_date.test.ts — T141 移植 Go 版 core/field_date_test.go
 */
import { describe, test, expect } from "bun:test";
import { DateField } from "./field_date";
import { RecordModel } from "./record_model";
import { CollectionModel } from "./collection_model";

function newBaseCollection(name: string): CollectionModel {
  const c = new CollectionModel();
  c.name = name;
  return c;
}

describe("DateField base methods", () => {
  test("type is 'date'", () => {
    expect(new DateField().type).toBe("date");
  });
});

describe("DateField columnType", () => {
  test("SQLite", () => {
    expect(new DateField().columnType(false)).toBe("TEXT DEFAULT '' NOT NULL");
  });

  test("PostgreSQL", () => {
    expect(new DateField().columnType(true)).toBe("TIMESTAMPTZ DEFAULT NULL");
  });
});

describe("DateField prepareValue", () => {
  const f = new DateField();

  test("empty string → empty", () => {
    expect(f.prepareValue("")).toBe("");
  });

  test("invalid string → empty", () => {
    expect(f.prepareValue("invalid")).toBe("");
  });

  test("valid ISO date", () => {
    const result = f.prepareValue("2024-01-01 00:11:22.345Z");
    expect(typeof result).toBe("string");
    expect(result).not.toBe("");
  });

  test("null → empty", () => {
    expect(f.prepareValue(null)).toBe("");
  });
});

describe("DateField validateValue", () => {
  const collection = newBaseCollection("test_collection");

  test("zero field value (not required)", () => {
    expect(new DateField({ name: "test" }).validateValue("", new RecordModel(collection))).toBeNull();
  });

  test("zero field value (required)", () => {
    expect(new DateField({ name: "test", required: true }).validateValue("", new RecordModel(collection))).not.toBeNull();
  });

  test("non-zero field value (required)", () => {
    expect(new DateField({ name: "test", required: true }).validateValue("2024-01-01 00:00:00.000Z", new RecordModel(collection))).toBeNull();
  });

  test("invalid date format", () => {
    expect(new DateField({ name: "test" }).validateValue("not-a-date", new RecordModel(collection))).not.toBeNull();
  });

  test("min date validation - before min", () => {
    const f = new DateField({ name: "test", min: "2024-06-01 00:00:00.000Z" });
    expect(f.validateValue("2024-01-01 00:00:00.000Z", new RecordModel(collection))).not.toBeNull();
  });

  test("min date validation - after min", () => {
    const f = new DateField({ name: "test", min: "2024-01-01 00:00:00.000Z" });
    expect(f.validateValue("2024-06-01 00:00:00.000Z", new RecordModel(collection))).toBeNull();
  });

  test("max date validation - after max", () => {
    const f = new DateField({ name: "test", max: "2024-01-01 00:00:00.000Z" });
    expect(f.validateValue("2024-06-01 00:00:00.000Z", new RecordModel(collection))).not.toBeNull();
  });

  test("max date validation - before max", () => {
    const f = new DateField({ name: "test", max: "2024-06-01 00:00:00.000Z" });
    expect(f.validateValue("2024-01-01 00:00:00.000Z", new RecordModel(collection))).toBeNull();
  });
});

describe("DateField validateSettings", () => {
  const collection = newBaseCollection("test_collection");

  test("zero Min/Max", () => {
    expect(new DateField({ id: "test", name: "test" }).validateSettings(collection)).toBeNull();
  });

  test("non-empty Min with empty Max", () => {
    expect(new DateField({ id: "test", name: "test", min: "2024-01-01" }).validateSettings(collection)).toBeNull();
  });

  test("empty Min non-empty Max", () => {
    expect(new DateField({ id: "test", name: "test", max: "2024-01-01" }).validateSettings(collection)).toBeNull();
  });
});
