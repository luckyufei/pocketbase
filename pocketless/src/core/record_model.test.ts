/**
 * record_model.test.ts — T153 移植 Go 版 core/record_model_test.go
 * 对照 Go 版：动态字段访问、字段修饰符、Auth 方法、expand、序列化
 */
import { describe, test, expect } from "bun:test";
import { RecordModel } from "./record_model";
import { CollectionModel, COLLECTION_TYPE_AUTH, COLLECTION_TYPE_BASE } from "./collection_model";

// ─── 辅助函数 ───

function newBaseCollection(name: string): CollectionModel {
  const c = new CollectionModel();
  c.id = `pbc_${name}`;
  c.name = name;
  c.type = COLLECTION_TYPE_BASE;
  c.fields = [
    { id: "f_id", name: "id", type: "text", required: true, options: { primaryKey: true } },
  ];
  return c;
}

function newAuthCollection(name: string): CollectionModel {
  const c = new CollectionModel();
  c.id = `pbc_${name}`;
  c.name = name;
  c.type = COLLECTION_TYPE_AUTH;
  c.fields = [
    { id: "f_id", name: "id", type: "text", required: true, options: { primaryKey: true } },
    { id: "f_email", name: "email", type: "email", required: true, options: {} },
    { id: "f_password", name: "password", type: "password", required: true, options: {} },
    { id: "f_tokenKey", name: "tokenKey", type: "text", required: true, options: {} },
    { id: "f_emailVis", name: "emailVisibility", type: "bool", required: false, options: {} },
    { id: "f_verified", name: "verified", type: "bool", required: false, options: {} },
  ];
  return c;
}

// ============================================================
// TestNewRecord — 构造函数
// ============================================================
describe("RecordModel constructor", () => {
  test("creates record with collection reference", () => {
    const col = newBaseCollection("test");
    const r = new RecordModel(col);
    expect(r.collection()).toBe(col);
  });

  test("tableName returns collection name", () => {
    const col = newBaseCollection("posts");
    const r = new RecordModel(col);
    expect(r.tableName()).toBe("posts");
  });

  test("collectionId returns collection id", () => {
    const col = newBaseCollection("test");
    const r = new RecordModel(col);
    expect(r.collectionId).toBe(col.id);
  });

  test("collectionName returns collection name", () => {
    const col = newBaseCollection("test");
    const r = new RecordModel(col);
    expect(r.collectionName).toBe("test");
  });

  test("isNew is true for new record", () => {
    const col = newBaseCollection("test");
    const r = new RecordModel(col);
    expect(r.isNew()).toBe(true);
  });

  test("auto-generated id is 15 chars", () => {
    const col = newBaseCollection("test");
    const r = new RecordModel(col);
    expect(r.id.length).toBe(15);
  });
});

// ============================================================
// TestRecordSetGet — 字段读写
// ============================================================
describe("RecordModel get/set", () => {
  test("set and get basic fields", () => {
    const col = newBaseCollection("test");
    const r = new RecordModel(col);
    r.set("title", "hello");
    r.set("count", 42);
    expect(r.get("title")).toBe("hello");
    expect(r.get("count")).toBe(42);
  });

  test("set id via set()", () => {
    const col = newBaseCollection("test");
    const r = new RecordModel(col);
    r.set("id", "custom_id");
    expect(r.id).toBe("custom_id");
    expect(r.get("id")).toBe("custom_id");
  });

  test("set created via set()", () => {
    const col = newBaseCollection("test");
    const r = new RecordModel(col);
    r.set("created", "2024-01-01 00:00:00.000Z");
    expect(r.created).toBe("2024-01-01 00:00:00.000Z");
    expect(r.get("created")).toBe("2024-01-01 00:00:00.000Z");
  });

  test("set updated via set()", () => {
    const col = newBaseCollection("test");
    const r = new RecordModel(col);
    r.set("updated", "2024-06-15 12:00:00.000Z");
    expect(r.updated).toBe("2024-06-15 12:00:00.000Z");
    expect(r.get("updated")).toBe("2024-06-15 12:00:00.000Z");
  });

  test("get returns undefined for missing field", () => {
    const col = newBaseCollection("test");
    const r = new RecordModel(col);
    expect(r.get("missing")).toBeUndefined();
  });

  test("get collectionId and collectionName", () => {
    const col = newBaseCollection("test");
    const r = new RecordModel(col);
    expect(r.get("collectionId")).toBe(col.id);
    expect(r.get("collectionName")).toBe("test");
  });
});

// ============================================================
// TestRecordLoad — 批量加载
// ============================================================
describe("RecordModel load", () => {
  test("load populates all fields", () => {
    const col = newBaseCollection("test");
    const r = new RecordModel(col);
    r.load({
      id: "load_id",
      created: "2024-01-01",
      updated: "2024-01-02",
      title: "loaded",
      count: 10,
    });
    expect(r.id).toBe("load_id");
    expect(r.created).toBe("2024-01-01");
    expect(r.updated).toBe("2024-01-02");
    expect(r.get("title")).toBe("loaded");
    expect(r.get("count")).toBe(10);
  });

  test("load sets isNew to false", () => {
    const col = newBaseCollection("test");
    const r = new RecordModel(col);
    expect(r.isNew()).toBe(true);
    r.load({ id: "test" });
    expect(r.isNew()).toBe(false);
  });

  test("load stores original data for change detection", () => {
    const col = newBaseCollection("test");
    const r = new RecordModel(col);
    r.load({ id: "test", title: "original" });
    expect(r.isFieldChanged("title")).toBe(false);
    r.set("title", "changed");
    expect(r.isFieldChanged("title")).toBe(true);
  });
});

// ============================================================
// TestRecordExpand — 展开数据
// ============================================================
describe("RecordModel expand", () => {
  test("getExpand returns empty object by default", () => {
    const col = newBaseCollection("test");
    const r = new RecordModel(col);
    expect(r.getExpand()).toEqual({});
  });

  test("setExpand and getExpand", () => {
    const col = newBaseCollection("test");
    const r = new RecordModel(col);
    r.setExpand("author", { id: "a1", name: "John" });
    expect(r.getExpand()).toEqual({ author: { id: "a1", name: "John" } });
  });

  test("getExpand returns shallow copy", () => {
    const col = newBaseCollection("test");
    const r = new RecordModel(col);
    r.setExpand("a", 1);
    const exp = r.getExpand();
    exp["b"] = 2;
    expect(r.getExpand()).toEqual({ a: 1 }); // original not modified
  });

  test("multiple setExpand calls add keys", () => {
    const col = newBaseCollection("test");
    const r = new RecordModel(col);
    r.setExpand("a", 1);
    r.setExpand("b", 2);
    expect(r.getExpand()).toEqual({ a: 1, b: 2 });
  });
});

// ============================================================
// TestRecordAuth 专用方法
// ============================================================
describe("RecordModel auth methods", () => {
  test("getEmail", () => {
    const col = newAuthCollection("users");
    const r = new RecordModel(col);
    r.set("email", "test@example.com");
    expect(r.getEmail()).toBe("test@example.com");
  });

  test("getEmail — empty", () => {
    const col = newAuthCollection("users");
    const r = new RecordModel(col);
    expect(r.getEmail()).toBe("");
  });

  test("setEmail", () => {
    const col = newAuthCollection("users");
    const r = new RecordModel(col);
    r.setEmail("new@test.com");
    expect(r.getEmail()).toBe("new@test.com");
  });

  test("isVerified — false by default", () => {
    const col = newAuthCollection("users");
    const r = new RecordModel(col);
    expect(r.isVerified()).toBe(false);
  });

  test("isVerified — true", () => {
    const col = newAuthCollection("users");
    const r = new RecordModel(col);
    r.set("verified", true);
    expect(r.isVerified()).toBe(true);
  });

  test("getTokenKey — empty default", () => {
    const col = newAuthCollection("users");
    const r = new RecordModel(col);
    expect(r.getTokenKey()).toBe("");
  });

  test("getTokenKey — set value", () => {
    const col = newAuthCollection("users");
    const r = new RecordModel(col);
    r.set("tokenKey", "abc123");
    expect(r.getTokenKey()).toBe("abc123");
  });

  test("getPasswordHash — empty default", () => {
    const col = newAuthCollection("users");
    const r = new RecordModel(col);
    expect(r.getPasswordHash()).toBe("");
  });

  test("isEmailVisible — false default", () => {
    const col = newAuthCollection("users");
    const r = new RecordModel(col);
    expect(r.isEmailVisible()).toBe(false);
  });

  test("isEmailVisible — true", () => {
    const col = newAuthCollection("users");
    const r = new RecordModel(col);
    r.set("emailVisibility", true);
    expect(r.isEmailVisible()).toBe(true);
  });
});

// ============================================================
// TestRecordFieldModifiers — 字段修饰符
// ============================================================
describe("RecordModel field modifiers", () => {
  test("field+ appends to array", () => {
    const col = newBaseCollection("test");
    const r = new RecordModel(col);
    r.set("tags", ["a", "b"]);
    r.applyModifier("tags+", "c");
    expect(r.get("tags")).toEqual(["a", "b", "c"]);
  });

  test("field+ appends array", () => {
    const col = newBaseCollection("test");
    const r = new RecordModel(col);
    r.set("tags", ["a"]);
    r.applyModifier("tags+", ["b", "c"]);
    expect(r.get("tags")).toEqual(["a", "b", "c"]);
  });

  test("+field prepends to array", () => {
    const col = newBaseCollection("test");
    const r = new RecordModel(col);
    r.set("tags", ["b", "c"]);
    r.applyModifier("+tags", "a");
    expect(r.get("tags")).toEqual(["a", "b", "c"]);
  });

  test("+field prepends array", () => {
    const col = newBaseCollection("test");
    const r = new RecordModel(col);
    r.set("tags", ["c"]);
    r.applyModifier("+tags", ["a", "b"]);
    expect(r.get("tags")).toEqual(["a", "b", "c"]);
  });

  test("field- removes from array", () => {
    const col = newBaseCollection("test");
    const r = new RecordModel(col);
    r.set("tags", ["a", "b", "c"]);
    r.applyModifier("tags-", "b");
    expect(r.get("tags")).toEqual(["a", "c"]);
  });

  test("field- removes multiple", () => {
    const col = newBaseCollection("test");
    const r = new RecordModel(col);
    r.set("tags", ["a", "b", "c", "d"]);
    r.applyModifier("tags-", ["b", "d"]);
    expect(r.get("tags")).toEqual(["a", "c"]);
  });

  test("regular set via applyModifier", () => {
    const col = newBaseCollection("test");
    const r = new RecordModel(col);
    r.applyModifier("title", "hello");
    expect(r.get("title")).toBe("hello");
  });

  test("modifier on non-array field is no-op for +/-", () => {
    const col = newBaseCollection("test");
    const r = new RecordModel(col);
    r.set("title", "hello");
    r.applyModifier("title+", "world");
    // title is not array, so append does nothing
    expect(r.get("title")).toBe("hello");
  });
});

// ============================================================
// TestRecordToJSON — 序列化
// ============================================================
describe("RecordModel toJSON", () => {
  test("base collection — includes custom fields, collectionId/Name", () => {
    const col = newBaseCollection("posts");
    const r = new RecordModel(col);
    r.id = "test_id";
    r.set("title", "hello");
    r.set("count", 42);
    const json = r.toJSON();
    expect(json.id).toBe("test_id");
    expect(json.collectionId).toBe(col.id);
    expect(json.collectionName).toBe("posts");
    expect(json.title).toBe("hello");
    expect(json.count).toBe(42);
  });

  test("auth collection — hides password field", () => {
    const col = newAuthCollection("users");
    const r = new RecordModel(col);
    r.set("email", "test@test.com");
    r.set("password", "secret_hash");
    r.set("emailVisibility", true);
    const json = r.toJSON();
    expect(json.password).toBeUndefined();
    expect(json.email).toBe("test@test.com");
  });

  test("auth collection — hides email when emailVisibility is false", () => {
    const col = newAuthCollection("users");
    const r = new RecordModel(col);
    r.set("email", "test@test.com");
    r.set("emailVisibility", false);
    const json = r.toJSON();
    expect(json.email).toBeUndefined();
  });

  test("auth collection — shows email when emailVisibility is true", () => {
    const col = newAuthCollection("users");
    const r = new RecordModel(col);
    r.set("email", "test@test.com");
    r.set("emailVisibility", true);
    const json = r.toJSON();
    expect(json.email).toBe("test@test.com");
  });

  test("expand is included when non-empty", () => {
    const col = newBaseCollection("test");
    const r = new RecordModel(col);
    r.setExpand("author", { id: "a1" });
    const json = r.toJSON();
    expect(json.expand).toEqual({ author: { id: "a1" } });
  });

  test("expand is excluded when empty", () => {
    const col = newBaseCollection("test");
    const r = new RecordModel(col);
    const json = r.toJSON();
    expect(json.expand).toBeUndefined();
  });
});

// ============================================================
// TestRecordToDBRow — 数据库导出
// ============================================================
describe("RecordModel toDBRow", () => {
  test("includes id, created, updated and all data fields", () => {
    const col = newBaseCollection("test");
    const r = new RecordModel(col);
    r.id = "row_id";
    r.created = "2024-01-01";
    r.updated = "2024-01-02";
    r.set("title", "hello");
    r.set("count", 10);
    const row = r.toDBRow();
    expect(row.id).toBe("row_id");
    expect(row.created).toBe("2024-01-01");
    expect(row.updated).toBe("2024-01-02");
    expect(row.title).toBe("hello");
    expect(row.count).toBe(10);
  });

  test("does not include collectionId/collectionName", () => {
    const col = newBaseCollection("test");
    const r = new RecordModel(col);
    const row = r.toDBRow();
    expect(row.collectionId).toBeUndefined();
    expect(row.collectionName).toBeUndefined();
  });
});

// ============================================================
// TestRecordGetData — 获取所有自定义数据
// ============================================================
describe("RecordModel getData", () => {
  test("returns copy of data map", () => {
    const col = newBaseCollection("test");
    const r = new RecordModel(col);
    r.set("a", 1);
    r.set("b", 2);
    const data = r.getData();
    expect(data.get("a")).toBe(1);
    expect(data.get("b")).toBe(2);
    // modifying copy shouldn't affect original
    data.set("c", 3);
    expect(r.get("c")).toBeUndefined();
  });
});

// ============================================================
// TestRecordIsFieldChanged
// ============================================================
describe("RecordModel isFieldChanged", () => {
  test("new record — field is changed after set", () => {
    const col = newBaseCollection("test");
    const r = new RecordModel(col);
    r.set("title", "new");
    // For a new record, original data is empty, so any set field is "changed"
    expect(r.isFieldChanged("title")).toBe(true);
  });

  test("loaded record — unchanged field", () => {
    const col = newBaseCollection("test");
    const r = new RecordModel(col);
    r.load({ id: "test", title: "original" });
    expect(r.isFieldChanged("title")).toBe(false);
  });

  test("loaded record — changed field", () => {
    const col = newBaseCollection("test");
    const r = new RecordModel(col);
    r.load({ id: "test", title: "original" });
    r.set("title", "modified");
    expect(r.isFieldChanged("title")).toBe(true);
  });

  test("loaded record — set same value", () => {
    const col = newBaseCollection("test");
    const r = new RecordModel(col);
    r.load({ id: "test", title: "same" });
    r.set("title", "same");
    expect(r.isFieldChanged("title")).toBe(false);
  });
});
