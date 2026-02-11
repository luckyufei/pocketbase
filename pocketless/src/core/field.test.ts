/**
 * field.test.ts — T151 测试 Field 接口和注册表
 * 对照 Go 版 core/field.go 和 field_column_type_test.go
 */
import { describe, test, expect } from "bun:test";
import { createField, registerField, getRegisteredFieldTypes, createFieldFromConfig } from "./field";

// 确保各字段类型已导入注册
import "./field_text";
import "./field_number";
import "./field_bool";
import "./field_email";
import "./field_url";
import "./field_editor";
import "./field_date";
import "./field_autodate";
import "./field_select";
import "./field_json";
import "./field_file";
import "./field_relation";
import "./field_password";
import "./field_geopoint";
import "./field_secret";
import "./field_vector";

// ============================================================
// Field Registry
// ============================================================
describe("Field Registry", () => {
  test("all field types are registered", () => {
    const types = getRegisteredFieldTypes();
    const expectedTypes = [
      "text", "number", "bool", "email", "url", "editor",
      "date", "autodate", "select", "json", "file",
      "relation", "password", "geoPoint", "secret", "vector",
    ];
    for (const t of expectedTypes) {
      expect(types).toContain(t);
    }
  });

  test("createField with known type returns field", () => {
    const f = createField("text", { id: "t1", name: "title" });
    expect(f).not.toBeNull();
    expect(f!.type).toBe("text");
    expect(f!.id).toBe("t1");
    expect(f!.name).toBe("title");
  });

  test("createField with unknown type returns null", () => {
    const f = createField("nonexistent");
    expect(f).toBeNull();
  });

  test("createFieldFromConfig", () => {
    const f = createFieldFromConfig({
      id: "f1",
      name: "count",
      type: "number",
      required: true,
      options: { min: 0, max: 100 },
    });
    expect(f).not.toBeNull();
    expect(f!.type).toBe("number");
    expect(f!.id).toBe("f1");
    expect(f!.name).toBe("count");
    expect(f!.required).toBe(true);
  });
});

// ============================================================
// Column Type per field type
// ============================================================
describe("Field columnType (all types)", () => {
  const scenarios: Array<{
    type: string;
    options: Record<string, unknown>;
    expectedSQ: string;
    expectedPG: string;
  }> = [
    {
      type: "text",
      options: {},
      expectedSQ: "TEXT DEFAULT '' NOT NULL",
      expectedPG: "TEXT DEFAULT '' NOT NULL",
    },
    {
      type: "number",
      options: {},
      expectedSQ: "NUMERIC DEFAULT 0 NOT NULL",
      expectedPG: "DOUBLE PRECISION DEFAULT 0 NOT NULL",
    },
    {
      type: "bool",
      options: {},
      expectedSQ: "BOOLEAN DEFAULT FALSE NOT NULL",
      expectedPG: "BOOLEAN DEFAULT FALSE NOT NULL",
    },
    {
      type: "email",
      options: {},
      expectedSQ: "TEXT DEFAULT '' NOT NULL",
      expectedPG: "TEXT DEFAULT '' NOT NULL",
    },
    {
      type: "url",
      options: {},
      expectedSQ: "TEXT DEFAULT '' NOT NULL",
      expectedPG: "TEXT DEFAULT '' NOT NULL",
    },
    {
      type: "editor",
      options: {},
      expectedSQ: "TEXT DEFAULT '' NOT NULL",
      expectedPG: "TEXT DEFAULT '' NOT NULL",
    },
    {
      type: "date",
      options: {},
      expectedSQ: "TEXT DEFAULT '' NOT NULL",
      expectedPG: "TIMESTAMPTZ DEFAULT NULL",
    },
    {
      type: "autodate",
      options: {},
      expectedSQ: "TEXT DEFAULT '' NOT NULL",
      expectedPG: "TIMESTAMPTZ DEFAULT NULL",
    },
    {
      type: "json",
      options: {},
      expectedSQ: "JSON DEFAULT NULL",
      expectedPG: "JSONB DEFAULT NULL",
    },
    {
      type: "select",
      options: { maxSelect: 1 },
      expectedSQ: "TEXT DEFAULT '' NOT NULL",
      expectedPG: "TEXT DEFAULT '' NOT NULL",
    },
    {
      type: "select",
      options: { maxSelect: 2 },
      expectedSQ: "JSON DEFAULT '[]' NOT NULL",
      expectedPG: "JSONB DEFAULT '[]' NOT NULL",
    },
    {
      type: "file",
      options: { maxSelect: 1 },
      expectedSQ: "TEXT DEFAULT '' NOT NULL",
      expectedPG: "TEXT DEFAULT '' NOT NULL",
    },
    {
      type: "file",
      options: { maxSelect: 2 },
      expectedSQ: "JSON DEFAULT '[]' NOT NULL",
      expectedPG: "JSONB DEFAULT '[]' NOT NULL",
    },
    {
      type: "relation",
      options: { maxSelect: 1 },
      expectedSQ: "TEXT DEFAULT '' NOT NULL",
      expectedPG: "TEXT DEFAULT '' NOT NULL",
    },
    {
      type: "relation",
      options: { maxSelect: 2 },
      expectedSQ: "JSON DEFAULT '[]' NOT NULL",
      expectedPG: "JSONB DEFAULT '[]' NOT NULL",
    },
    {
      type: "password",
      options: {},
      expectedSQ: "TEXT DEFAULT '' NOT NULL",
      expectedPG: "TEXT DEFAULT '' NOT NULL",
    },
    {
      type: "geoPoint",
      options: {},
      expectedSQ: `JSON DEFAULT '{"lon":0,"lat":0}' NOT NULL`,
      expectedPG: `JSONB DEFAULT '{"lon":0,"lat":0}' NOT NULL`,
    },
    {
      type: "secret",
      options: {},
      expectedSQ: "TEXT DEFAULT '' NOT NULL",
      expectedPG: "TEXT DEFAULT '' NOT NULL",
    },
    {
      type: "vector",
      options: { dimension: 1536 },
      expectedSQ: "JSON DEFAULT '[]' NOT NULL",
      expectedPG: "vector(1536)",
    },
  ];

  for (const s of scenarios) {
    const label = `${s.type}(${JSON.stringify(s.options)})`;

    test(`${label} SQLite`, () => {
      const f = createField(s.type, s.options);
      expect(f).not.toBeNull();
      expect(f!.columnType(false)).toBe(s.expectedSQ);
    });

    test(`${label} PostgreSQL`, () => {
      const f = createField(s.type, s.options);
      expect(f).not.toBeNull();
      expect(f!.columnType(true)).toBe(s.expectedPG);
    });
  }
});
