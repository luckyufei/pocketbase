/**
 * field_geopoint.test.ts — T148 移植 Go 版 core/field_geo_point_test.go
 */
import { describe, test, expect } from "bun:test";
import { GeoPointField, type GeoPointValue } from "./field_geopoint";
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
// TestGeoPointFieldBaseMethods
// ============================================================
describe("GeoPointField base methods", () => {
  test("type is 'geoPoint'", () => {
    expect(new GeoPointField().type).toBe("geoPoint");
  });

  test("default values", () => {
    const f = new GeoPointField();
    expect(f.id).toBe("");
    expect(f.name).toBe("");
    expect(f.system).toBe(false);
    expect(f.hidden).toBe(false);
    expect(f.required).toBe(false);
  });
});

// ============================================================
// TestGeoPointFieldColumnType
// ============================================================
describe("GeoPointField columnType", () => {
  const f = new GeoPointField();

  test("SQLite", () => {
    expect(f.columnType(false)).toBe(`JSON DEFAULT '{"lon":0,"lat":0}' NOT NULL`);
  });

  test("PostgreSQL", () => {
    expect(f.columnType(true)).toBe(`JSONB DEFAULT '{"lon":0,"lat":0}' NOT NULL`);
  });
});

// ============================================================
// TestGeoPointFieldPrepareValue
// ============================================================
describe("GeoPointField prepareValue", () => {
  const f = new GeoPointField();

  test("null → {lon:0,lat:0}", () => {
    expect(f.prepareValue(null)).toEqual({ lon: 0, lat: 0 });
  });

  test("'' → {lon:0,lat:0}", () => {
    expect(f.prepareValue("")).toEqual({ lon: 0, lat: 0 });
  });

  test("{} → {lon:0,lat:0}", () => {
    expect(f.prepareValue({})).toEqual({ lon: 0, lat: 0 });
  });

  test("{lon:10,lat:20} → {lon:10,lat:20}", () => {
    expect(f.prepareValue({ lon: 10, lat: 20 })).toEqual({ lon: 10, lat: 20 });
  });

  test("JSON string {lon:10,lat:20}", () => {
    expect(f.prepareValue('{"lon":10,"lat":20}')).toEqual({ lon: 10, lat: 20 });
  });

  test("{longitude:10,latitude:20} alias → {lon:10,lat:20}", () => {
    expect(f.prepareValue({ longitude: 10, latitude: 20 })).toEqual({ lon: 10, lat: 20 });
  });
});

// ============================================================
// TestGeoPointFieldValidateValue
// ============================================================
describe("GeoPointField validateValue", () => {
  const collection = newBaseCollection("test_collection");

  test("zero (non-required) → null", () => {
    const f = new GeoPointField({ name: "test" });
    const v: GeoPointValue = { lon: 0, lat: 0 };
    const record = newRecordWithRaw(collection, "test", v);
    expect(f.validateValue(v, record)).toBeNull();
  });

  test("zero (required) → error", () => {
    const f = new GeoPointField({ name: "test", required: true });
    const v: GeoPointValue = { lon: 0, lat: 0 };
    const record = newRecordWithRaw(collection, "test", v);
    expect(f.validateValue(v, record)).not.toBeNull();
  });

  test("non-zero Lat (required) → null", () => {
    const f = new GeoPointField({ name: "test", required: true });
    const v: GeoPointValue = { lon: 0, lat: 1 };
    const record = newRecordWithRaw(collection, "test", v);
    expect(f.validateValue(v, record)).toBeNull();
  });

  test("non-zero Lon (required) → null", () => {
    const f = new GeoPointField({ name: "test", required: true });
    const v: GeoPointValue = { lon: 1, lat: 0 };
    const record = newRecordWithRaw(collection, "test", v);
    expect(f.validateValue(v, record)).toBeNull();
  });

  test("non-zero Lat+Lon (required) → null", () => {
    const f = new GeoPointField({ name: "test", required: true });
    const v: GeoPointValue = { lon: -1, lat: -2 };
    const record = newRecordWithRaw(collection, "test", v);
    expect(f.validateValue(v, record)).toBeNull();
  });

  test("lat < -90 → error", () => {
    const f = new GeoPointField({ name: "test" });
    const v: GeoPointValue = { lon: 0, lat: -90.1 };
    const record = newRecordWithRaw(collection, "test", v);
    expect(f.validateValue(v, record)).not.toBeNull();
  });

  test("lat > 90 → error", () => {
    const f = new GeoPointField({ name: "test" });
    const v: GeoPointValue = { lon: 0, lat: 90.1 };
    const record = newRecordWithRaw(collection, "test", v);
    expect(f.validateValue(v, record)).not.toBeNull();
  });

  test("lon < -180 → error", () => {
    const f = new GeoPointField({ name: "test" });
    const v: GeoPointValue = { lon: -180.1, lat: 0 };
    const record = newRecordWithRaw(collection, "test", v);
    expect(f.validateValue(v, record)).not.toBeNull();
  });

  test("lon > 180 → error", () => {
    const f = new GeoPointField({ name: "test" });
    const v: GeoPointValue = { lon: 180.1, lat: 0 };
    const record = newRecordWithRaw(collection, "test", v);
    expect(f.validateValue(v, record)).not.toBeNull();
  });
});

// ============================================================
// TestGeoPointFieldValidateSettings — 无额外验证
// ============================================================
describe("GeoPointField validateSettings", () => {
  const collection = newBaseCollection("test_collection");

  test("always null", () => {
    const f = new GeoPointField({ id: "test", name: "test" });
    expect(f.validateSettings(collection)).toBeNull();
  });
});
