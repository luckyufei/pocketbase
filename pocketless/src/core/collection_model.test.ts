/**
 * collection_model.test.ts — T152 移植 Go 版 core/collection_model_test.go
 * 对照 Go 版所有 test case：三种类型、字段列表、API 规则、系统集合
 */
import { describe, test, expect } from "bun:test";
import {
  CollectionModel,
  COLLECTION_TYPE_BASE,
  COLLECTION_TYPE_AUTH,
  COLLECTION_TYPE_VIEW,
} from "./collection_model";

// ============================================================
// TestCollectionTableName
// ============================================================
describe("CollectionModel tableName", () => {
  test("returns _collections", () => {
    const c = new CollectionModel();
    expect(c.tableName()).toBe("_collections");
  });
});

// ============================================================
// TestCollectionIsBase / IsAuth / IsView
// ============================================================
describe("CollectionModel type checks", () => {
  test("isBase — base type returns true", () => {
    const c = new CollectionModel();
    c.type = COLLECTION_TYPE_BASE;
    expect(c.isBase()).toBe(true);
    expect(c.isAuth()).toBe(false);
    expect(c.isView()).toBe(false);
  });

  test("isAuth — auth type returns true", () => {
    const c = new CollectionModel();
    c.type = COLLECTION_TYPE_AUTH;
    expect(c.isBase()).toBe(false);
    expect(c.isAuth()).toBe(true);
    expect(c.isView()).toBe(false);
  });

  test("isView — view type returns true", () => {
    const c = new CollectionModel();
    c.type = COLLECTION_TYPE_VIEW;
    expect(c.isBase()).toBe(false);
    expect(c.isAuth()).toBe(false);
    expect(c.isView()).toBe(true);
  });

  test("unknown type — all return false", () => {
    const c = new CollectionModel();
    c.type = "unknown";
    expect(c.isBase()).toBe(false);
    expect(c.isAuth()).toBe(false);
    expect(c.isView()).toBe(false);
  });
});

// ============================================================
// TestCollectionModel 默认值
// ============================================================
describe("CollectionModel defaults", () => {
  test("default type is base", () => {
    const c = new CollectionModel();
    expect(c.type).toBe(COLLECTION_TYPE_BASE);
  });

  test("default name is empty", () => {
    const c = new CollectionModel();
    expect(c.name).toBe("");
  });

  test("default system is false", () => {
    const c = new CollectionModel();
    expect(c.system).toBe(false);
  });

  test("default fields is empty array", () => {
    const c = new CollectionModel();
    expect(c.fields).toEqual([]);
  });

  test("default indexes is empty array", () => {
    const c = new CollectionModel();
    expect(c.indexes).toEqual([]);
  });

  test("default rules are null", () => {
    const c = new CollectionModel();
    expect(c.listRule).toBeNull();
    expect(c.viewRule).toBeNull();
    expect(c.createRule).toBeNull();
    expect(c.updateRule).toBeNull();
    expect(c.deleteRule).toBeNull();
  });

  test("default options is empty object", () => {
    const c = new CollectionModel();
    expect(c.options).toEqual({});
  });

  test("has auto-generated id", () => {
    const c = new CollectionModel();
    expect(c.id).toBeTruthy();
    expect(c.id.length).toBe(15);
  });

  test("isNew is true by default", () => {
    const c = new CollectionModel();
    expect(c.isNew()).toBe(true);
  });
});

// ============================================================
// TestCollectionModel fields helpers
// ============================================================
describe("CollectionModel field helpers", () => {
  test("getFieldByName — found", () => {
    const c = new CollectionModel();
    c.fields = [
      { id: "f1", name: "title", type: "text", required: true, options: {} },
      { id: "f2", name: "count", type: "number", required: false, options: {} },
    ];
    const f = c.getFieldByName("title");
    expect(f).toBeDefined();
    expect(f!.id).toBe("f1");
  });

  test("getFieldByName — not found", () => {
    const c = new CollectionModel();
    c.fields = [
      { id: "f1", name: "title", type: "text", required: true, options: {} },
    ];
    expect(c.getFieldByName("missing")).toBeUndefined();
  });

  test("getFieldById — found", () => {
    const c = new CollectionModel();
    c.fields = [
      { id: "f1", name: "title", type: "text", required: true, options: {} },
    ];
    const f = c.getFieldById("f1");
    expect(f).toBeDefined();
    expect(f!.name).toBe("title");
  });

  test("getFieldById — not found", () => {
    const c = new CollectionModel();
    c.fields = [];
    expect(c.getFieldById("missing")).toBeUndefined();
  });
});

// ============================================================
// TestCollectionModel load (from DB row)
// ============================================================
describe("CollectionModel load", () => {
  test("load from full data object", () => {
    const c = new CollectionModel();
    c.load({
      id: "test_id",
      type: "auth",
      name: "users",
      system: true,
      fields: JSON.stringify([{ id: "f1", name: "email", type: "email", required: true, options: {} }]),
      indexes: JSON.stringify(["CREATE INDEX idx1 ON users(email)"]),
      listRule: "1=1",
      viewRule: null,
      createRule: "@request.auth.id != ''",
      updateRule: null,
      deleteRule: null,
      options: JSON.stringify({ authRule: "1=2" }),
      created: "2024-01-01 00:00:00.000Z",
      updated: "2024-01-02 00:00:00.000Z",
    });

    expect(c.id).toBe("test_id");
    expect(c.type).toBe("auth");
    expect(c.name).toBe("users");
    expect(c.system).toBe(true);
    expect(c.fields).toHaveLength(1);
    expect(c.fields[0].name).toBe("email");
    expect(c.indexes).toHaveLength(1);
    expect(c.listRule).toBe("1=1");
    expect(c.viewRule).toBeNull();
    expect(c.createRule).toBe("@request.auth.id != ''");
    expect(c.updateRule).toBeNull();
    expect(c.deleteRule).toBeNull();
    expect(c.options).toEqual({ authRule: "1=2" });
    expect(c.isNew()).toBe(false);
  });

  test("load with already parsed fields (not JSON string)", () => {
    const c = new CollectionModel();
    const fields = [{ id: "f1", name: "title", type: "text", required: false, options: {} }];
    c.load({
      id: "abc",
      fields: fields,
      indexes: ["idx1"],
      options: { viewQuery: "select 1" },
    });
    expect(c.fields).toEqual(fields);
    expect(c.indexes).toEqual(["idx1"]);
    expect(c.options).toEqual({ viewQuery: "select 1" });
  });

  test("load sets isNew to false", () => {
    const c = new CollectionModel();
    expect(c.isNew()).toBe(true);
    c.load({ id: "test" });
    expect(c.isNew()).toBe(false);
  });

  test("load with system=0 keeps false", () => {
    const c = new CollectionModel();
    c.load({ id: "t", system: 0 });
    expect(c.system).toBe(false);
  });

  test("load with system=1 sets true", () => {
    const c = new CollectionModel();
    c.load({ id: "t", system: 1 });
    expect(c.system).toBe(true);
  });
});

// ============================================================
// TestCollectionModel toJSON
// ============================================================
describe("CollectionModel toJSON", () => {
  test("serializes all fields", () => {
    const c = new CollectionModel();
    c.id = "test_id";
    c.type = "base";
    c.name = "posts";
    c.system = false;
    c.fields = [{ id: "f1", name: "title", type: "text", required: true, options: {} }];
    c.indexes = ["CREATE INDEX idx1 ON posts(title)"];
    c.listRule = "1=1";
    c.viewRule = null;
    c.createRule = "@request.auth.id != ''";
    c.updateRule = null;
    c.deleteRule = null;
    c.options = {};

    const json = c.toJSON();
    expect(json.id).toBe("test_id");
    expect(json.type).toBe("base");
    expect(json.name).toBe("posts");
    expect(json.system).toBe(false);
    expect(json.fields).toHaveLength(1);
    expect(json.indexes).toHaveLength(1);
    expect(json.listRule).toBe("1=1");
    expect(json.viewRule).toBeNull();
    expect(json.createRule).toBe("@request.auth.id != ''");
    expect(json.updateRule).toBeNull();
    expect(json.deleteRule).toBeNull();
    expect(json.options).toEqual({});
  });

  test("JSON.stringify roundtrip", () => {
    const c = new CollectionModel();
    c.id = "abc";
    c.name = "test";
    c.type = "view";
    const str = JSON.stringify(c.toJSON());
    expect(str).toContain('"name":"test"');
    expect(str).toContain('"type":"view"');
    expect(str).toContain('"id":"abc"');
  });
});

// ============================================================
// TestCollectionModel toDBRow
// ============================================================
describe("CollectionModel toDBRow", () => {
  test("serializes JSON fields as strings", () => {
    const c = new CollectionModel();
    c.id = "db_test";
    c.name = "items";
    c.type = "base";
    c.system = true;
    c.fields = [{ id: "f1", name: "title", type: "text", required: true, options: {} }];
    c.indexes = ["idx1"];
    c.options = { custom: true };
    c.listRule = "1=1";
    c.viewRule = null;

    const row = c.toDBRow();
    expect(row.id).toBe("db_test");
    expect(row.name).toBe("items");
    expect(row.type).toBe("base");
    expect(row.system).toBe(1); // boolean → 1/0
    expect(typeof row.fields).toBe("string");
    expect(JSON.parse(row.fields as string)).toHaveLength(1);
    expect(typeof row.indexes).toBe("string");
    expect(JSON.parse(row.indexes as string)).toEqual(["idx1"]);
    expect(typeof row.options).toBe("string");
    expect(JSON.parse(row.options as string)).toEqual({ custom: true });
    expect(row.listRule).toBe("1=1");
    expect(row.viewRule).toBeNull();
  });

  test("system false → 0", () => {
    const c = new CollectionModel();
    c.system = false;
    const row = c.toDBRow();
    expect(row.system).toBe(0);
  });
});

// ============================================================
// Collection type constants
// ============================================================
describe("Collection type constants", () => {
  test("COLLECTION_TYPE_BASE is 'base'", () => {
    expect(COLLECTION_TYPE_BASE).toBe("base");
  });

  test("COLLECTION_TYPE_AUTH is 'auth'", () => {
    expect(COLLECTION_TYPE_AUTH).toBe("auth");
  });

  test("COLLECTION_TYPE_VIEW is 'view'", () => {
    expect(COLLECTION_TYPE_VIEW).toBe("view");
  });
});
