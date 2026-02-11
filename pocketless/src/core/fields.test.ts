/**
 * T161 — fields.test.ts
 * 验证字段注册表 barrel export 完整性
 * 确保所有 16 种字段类型可以正确导入和自注册
 */

import { describe, expect, test } from "bun:test";
// 导入 barrel（会触发所有字段类型的 registerField 副作用）
import {
  TextField,
  NumberField,
  BoolField,
  EmailField,
  URLField,
  EditorField,
  DateField,
  AutodateField,
  SelectField,
  FileField,
  RelationField,
  JSONField,
  PasswordField,
  GeoPointField,
  SecretField,
  VectorField,
  registerField,
  createField,
  getRegisteredFieldTypes,
  createFieldFromConfig,
} from "./fields";

describe("fields barrel export", () => {
  test("exports registerField function", () => {
    expect(typeof registerField).toBe("function");
  });

  test("exports createField function", () => {
    expect(typeof createField).toBe("function");
  });

  test("exports getRegisteredFieldTypes function", () => {
    expect(typeof getRegisteredFieldTypes).toBe("function");
  });

  test("exports createFieldFromConfig function", () => {
    expect(typeof createFieldFromConfig).toBe("function");
  });
});

describe("field types are constructable", () => {
  const fieldClasses = [
    { name: "TextField", cls: TextField, type: "text" },
    { name: "NumberField", cls: NumberField, type: "number" },
    { name: "BoolField", cls: BoolField, type: "bool" },
    { name: "EmailField", cls: EmailField, type: "email" },
    { name: "URLField", cls: URLField, type: "url" },
    { name: "EditorField", cls: EditorField, type: "editor" },
    { name: "DateField", cls: DateField, type: "date" },
    { name: "AutodateField", cls: AutodateField, type: "autodate" },
    { name: "SelectField", cls: SelectField, type: "select" },
    { name: "FileField", cls: FileField, type: "file" },
    { name: "RelationField", cls: RelationField, type: "relation" },
    { name: "JSONField", cls: JSONField, type: "json" },
    { name: "PasswordField", cls: PasswordField, type: "password" },
    { name: "GeoPointField", cls: GeoPointField, type: "geoPoint" },
    { name: "SecretField", cls: SecretField, type: "secret" },
    { name: "VectorField", cls: VectorField, type: "vector" },
  ];

  for (const { name, cls, type } of fieldClasses) {
    test(`${name} instantiates with type '${type}'`, () => {
      const instance = new cls();
      expect(instance).toBeDefined();
      expect(instance.type).toBe(type);
    });
  }
});

describe("field auto-registration", () => {
  test("all 16 field types are registered", () => {
    const types = getRegisteredFieldTypes();
    expect(types.length).toBe(16);
  });

  const expectedTypes = [
    "text", "number", "bool", "email", "url", "editor",
    "date", "autodate", "select", "file", "relation",
    "json", "password", "geoPoint", "secret", "vector",
  ];

  for (const type of expectedTypes) {
    test(`type '${type}' is registered`, () => {
      expect(getRegisteredFieldTypes()).toContain(type);
    });
  }
});

describe("createField", () => {
  test("creates field by type name", () => {
    const field = createField("text", { name: "title" });
    expect(field).not.toBeNull();
    expect(field!.type).toBe("text");
  });

  test("unknown type returns null", () => {
    const field = createField("unknown_type");
    expect(field).toBeNull();
  });

  test("passes options to constructor", () => {
    const field = createField("number", { name: "age", min: 0, max: 150 });
    expect(field).not.toBeNull();
    expect(field!.name).toBe("age");
  });
});

describe("createFieldFromConfig", () => {
  test("creates field from config object", () => {
    const field = createFieldFromConfig({
      id: "f1",
      name: "email",
      type: "email",
      required: true,
      options: {},
    });
    expect(field).not.toBeNull();
    expect(field!.type).toBe("email");
    expect(field!.name).toBe("email");
    expect(field!.required).toBe(true);
  });

  test("unknown type returns null", () => {
    const field = createFieldFromConfig({
      id: "f1",
      name: "x",
      type: "nonexistent",
      required: false,
      options: {},
    });
    expect(field).toBeNull();
  });
});
