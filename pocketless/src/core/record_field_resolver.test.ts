/**
 * record_field_resolver.test.ts — T156 移植 Go 版 core/record_field_resolver_test.go
 * 对照 Go 版：字段路径解析、自动 JOIN、@request.* / @collection.* 标识符、修饰符
 */
import { describe, test, expect } from "bun:test";
import { RecordFieldResolver, type RequestInfo } from "./record_field_resolver";
import { CollectionModel, COLLECTION_TYPE_BASE, COLLECTION_TYPE_AUTH } from "./collection_model";
import { RecordModel } from "./record_model";

// ─── 辅助函数 ───

function newTestCollection(): CollectionModel {
  const c = new CollectionModel();
  c.id = "col_test";
  c.name = "demo";
  c.type = COLLECTION_TYPE_BASE;
  c.fields = [
    { id: "f1", name: "id", type: "text", required: true, options: {} },
    { id: "f2", name: "title", type: "text", required: false, options: {} },
    { id: "f3", name: "count", type: "number", required: false, options: {} },
    { id: "f4", name: "active", type: "bool", required: false, options: {} },
    { id: "f5", name: "json_data", type: "json", required: false, options: {} },
    { id: "f6", name: "geo", type: "geoPoint", required: false, options: {} },
    {
      id: "f7", name: "rel_one", type: "relation", required: false,
      options: { collectionId: "col_other", maxSelect: 1 },
    },
    {
      id: "f8", name: "rel_many", type: "relation", required: false,
      options: { collectionId: "col_other", maxSelect: 10 },
    },
    { id: "f9", name: "tags", type: "select", required: false, options: { maxSelect: 5, values: ["a", "b", "c"] } },
  ];
  return c;
}

function createMockAdapter(dbType: "sqlite" | "postgres" = "sqlite") {
  return {
    type: () => dbType,
    queryOne: () => null,
    query: () => [],
  };
}

function createMockApp(dbType: "sqlite" | "postgres" = "sqlite") {
  return {
    dbAdapter: () => createMockAdapter(dbType),
  };
}

// ============================================================
// 基础字段解析
// ============================================================
describe("RecordFieldResolver — basic fields", () => {
  test("simple field name", () => {
    const col = newTestCollection();
    const resolver = new RecordFieldResolver(createMockApp() as any, col);
    const result = resolver.resolve("title");
    expect(result).not.toBeNull();
    expect(result!.identifier).toBe("[[demo]].[[title]]");
  });

  test("id field", () => {
    const col = newTestCollection();
    const resolver = new RecordFieldResolver(createMockApp() as any, col);
    const result = resolver.resolve("id");
    expect(result).not.toBeNull();
    expect(result!.identifier).toBe("[[demo]].[[id]]");
  });

  test("invalid field path — rejected", () => {
    const col = newTestCollection();
    const resolver = new RecordFieldResolver(createMockApp() as any, col);
    expect(resolver.resolve("")).toBeNull();
    expect(resolver.resolve("$invalid")).toBeNull();
    expect(resolver.resolve("field with spaces")).toBeNull();
  });
});

// ============================================================
// @request.* 解析
// ============================================================
describe("RecordFieldResolver — @request.*", () => {
  test("@request.context", () => {
    const col = newTestCollection();
    const reqInfo: RequestInfo = { context: "realtime" };
    const resolver = new RecordFieldResolver(createMockApp() as any, col, reqInfo);
    const result = resolver.resolve("@request.context");
    expect(result).not.toBeNull();
    expect(result!.params).toBeDefined();
    const paramKey = Object.keys(result!.params!)[0];
    expect(result!.params![paramKey]).toBe("realtime");
  });

  test("@request.context — default value", () => {
    const col = newTestCollection();
    const resolver = new RecordFieldResolver(createMockApp() as any, col, {});
    const result = resolver.resolve("@request.context");
    expect(result).not.toBeNull();
    const paramKey = Object.keys(result!.params!)[0];
    expect(result!.params![paramKey]).toBe("default");
  });

  test("@request.method", () => {
    const col = newTestCollection();
    const reqInfo: RequestInfo = { method: "POST" };
    const resolver = new RecordFieldResolver(createMockApp() as any, col, reqInfo);
    const result = resolver.resolve("@request.method");
    expect(result).not.toBeNull();
    const paramKey = Object.keys(result!.params!)[0];
    expect(result!.params![paramKey]).toBe("POST");
  });

  test("@request.method — default GET", () => {
    const col = newTestCollection();
    const resolver = new RecordFieldResolver(createMockApp() as any, col, {});
    const result = resolver.resolve("@request.method");
    expect(result).not.toBeNull();
    const paramKey = Object.keys(result!.params!)[0];
    expect(result!.params![paramKey]).toBe("GET");
  });

  test("@request.query.param", () => {
    const col = newTestCollection();
    const reqInfo: RequestInfo = { query: { page: "2", search: "hello" } };
    const resolver = new RecordFieldResolver(createMockApp() as any, col, reqInfo);
    const result = resolver.resolve("@request.query.page");
    expect(result).not.toBeNull();
    const paramKey = Object.keys(result!.params!)[0];
    expect(result!.params![paramKey]).toBe("2");
  });

  test("@request.query.missing — empty string", () => {
    const col = newTestCollection();
    const reqInfo: RequestInfo = { query: {} };
    const resolver = new RecordFieldResolver(createMockApp() as any, col, reqInfo);
    const result = resolver.resolve("@request.query.missing");
    expect(result).not.toBeNull();
    const paramKey = Object.keys(result!.params!)[0];
    expect(result!.params![paramKey]).toBe("");
  });

  test("@request.headers.key", () => {
    const col = newTestCollection();
    const reqInfo: RequestInfo = { headers: { "content-type": "application/json" } };
    const resolver = new RecordFieldResolver(createMockApp() as any, col, reqInfo);
    const result = resolver.resolve("@request.headers.contentType");
    // headers lookup is lowercased
    expect(result).not.toBeNull();
  });

  test("@request.body.key", () => {
    const col = newTestCollection();
    const reqInfo: RequestInfo = { body: { title: "test" } };
    const resolver = new RecordFieldResolver(createMockApp() as any, col, reqInfo);
    const result = resolver.resolve("@request.body.title");
    expect(result).not.toBeNull();
    const paramKey = Object.keys(result!.params!)[0];
    expect(result!.params![paramKey]).toBe("test");
  });

  test("@request.auth.id — with auth", () => {
    const col = newTestCollection();
    const authCol = new CollectionModel();
    authCol.id = "col_users";
    authCol.name = "users";
    authCol.type = COLLECTION_TYPE_AUTH;
    authCol.fields = [];
    const authRecord = new RecordModel(authCol);
    authRecord.id = "user123";
    const reqInfo: RequestInfo = { auth: authRecord };
    const resolver = new RecordFieldResolver(createMockApp() as any, col, reqInfo);
    const result = resolver.resolve("@request.auth.id");
    expect(result).not.toBeNull();
    const paramKey = Object.keys(result!.params!)[0];
    expect(result!.params![paramKey]).toBe("user123");
  });

  test("@request.auth.id — no auth → NULL", () => {
    const col = newTestCollection();
    const reqInfo: RequestInfo = { auth: null };
    const resolver = new RecordFieldResolver(createMockApp() as any, col, reqInfo);
    const result = resolver.resolve("@request.auth.id");
    expect(result).not.toBeNull();
    expect(result!.identifier).toBe("NULL");
    // Go 版: 无 NoCoalesce，允许标准 NULL 处理（NULL = '' → true for empty check）
  });
});

// ============================================================
// @collection.* 解析
// ============================================================
describe("RecordFieldResolver — @collection.*", () => {
  test("@collection.other.field adds JOIN", () => {
    const col = newTestCollection();
    const resolver = new RecordFieldResolver(createMockApp() as any, col);
    const result = resolver.resolve("@collection.other.title");
    expect(result).not.toBeNull();
    expect(result!.identifier).toContain("__cross_other");
    expect(result!.identifier).toContain("title");
    const joins = resolver.getJoins();
    expect(joins.length).toBeGreaterThan(0);
    expect(joins[0]).toContain("LEFT JOIN");
    expect(joins[0]).toContain("other");
  });

  test("@collection.name:alias.field — with alias", () => {
    const col = newTestCollection();
    const resolver = new RecordFieldResolver(createMockApp() as any, col);
    const result = resolver.resolve("@collection.posts:p.title");
    expect(result).not.toBeNull();
    expect(result!.identifier).toContain("__cross_p");
    const joins = resolver.getJoins();
    expect(joins[0]).toContain("posts");
  });

  test("@collection.x — no field part → null", () => {
    const col = newTestCollection();
    const resolver = new RecordFieldResolver(createMockApp() as any, col);
    // @collection.x without a field should not match allowed patterns
    expect(resolver.resolve("@collection.x")).toBeNull();
  });
});

// ============================================================
// 关系字段解析 (自动 JOIN)
// ============================================================
describe("RecordFieldResolver — relation fields", () => {
  test("single relation field.id → no extra JOIN", () => {
    const col = newTestCollection();
    const resolver = new RecordFieldResolver(createMockApp() as any, col);
    // rel_one.id should return the rel_one column itself (optimization)
    const result = resolver.resolve("rel_one.id");
    expect(result).not.toBeNull();
    expect(result!.identifier).toContain("rel_one");
  });

  test("single relation field.name → JOIN generated (SQLite)", () => {
    const col = newTestCollection();
    const resolver = new RecordFieldResolver(createMockApp("sqlite") as any, col);
    const result = resolver.resolve("rel_one.name");
    expect(result).not.toBeNull();
    expect(result!.identifier).toContain("__rel_rel_one_0");
    const joins = resolver.getJoins();
    expect(joins.length).toBe(1);
    expect(joins[0]).toContain("LEFT JOIN");
    expect(joins[0]).toContain("col_other");
    expect(joins[0]).toContain("[[__rel_rel_one_0]].[[id]] = [[demo]].[[rel_one]]");
  });

  test("multi relation field.name → JOIN with json_each (SQLite)", () => {
    const col = newTestCollection();
    const resolver = new RecordFieldResolver(createMockApp("sqlite") as any, col);
    const result = resolver.resolve("rel_many.name");
    expect(result).not.toBeNull();
    const joins = resolver.getJoins();
    expect(joins.length).toBe(1);
    expect(joins[0]).toContain("json_each");
  });

  test("multi relation field.name → JOIN with jsonb_array_elements_text (PostgreSQL)", () => {
    const col = newTestCollection();
    const resolver = new RecordFieldResolver(createMockApp("postgres") as any, col);
    const result = resolver.resolve("rel_many.name");
    expect(result).not.toBeNull();
    const joins = resolver.getJoins();
    expect(joins.length).toBe(1);
    expect(joins[0]).toContain("jsonb_array_elements_text");
  });
});

// ============================================================
// JSON 字段解析
// ============================================================
describe("RecordFieldResolver — JSON fields", () => {
  test("json field sub-path (SQLite)", () => {
    const col = newTestCollection();
    const resolver = new RecordFieldResolver(createMockApp("sqlite") as any, col);
    const result = resolver.resolve("json_data.key");
    expect(result).not.toBeNull();
    expect(result!.identifier).toContain("JSON_EXTRACT");
    expect(result!.identifier).toContain("json_data");
    expect(result!.identifier).toContain("$.key");
  });

  test("json field sub-path (PostgreSQL)", () => {
    const col = newTestCollection();
    const resolver = new RecordFieldResolver(createMockApp("postgres") as any, col);
    const result = resolver.resolve("json_data.key");
    expect(result).not.toBeNull();
    expect(result!.identifier).toContain("->>'key'");
  });

  test("geoPoint field sub-path (SQLite)", () => {
    const col = newTestCollection();
    const resolver = new RecordFieldResolver(createMockApp("sqlite") as any, col);
    const result = resolver.resolve("geo.lon");
    expect(result).not.toBeNull();
    expect(result!.identifier).toContain("JSON_EXTRACT");
    expect(result!.identifier).toContain("$.lon");
  });
});

// ============================================================
// 反向关系
// ============================================================
describe("RecordFieldResolver — back relations", () => {
  test("collectionName_via_fieldName.subfield (SQLite)", () => {
    const col = newTestCollection();
    const resolver = new RecordFieldResolver(createMockApp("sqlite") as any, col);
    const result = resolver.resolve("posts_via_author.title");
    expect(result).not.toBeNull();
    expect(result!.identifier).toContain("__back_posts_author_0");
    const joins = resolver.getJoins();
    expect(joins.length).toBe(1);
    expect(joins[0]).toContain("json_each");
  });

  test("collectionName_via_fieldName.subfield (PostgreSQL)", () => {
    const col = newTestCollection();
    const resolver = new RecordFieldResolver(createMockApp("postgres") as any, col);
    const result = resolver.resolve("posts_via_author.title");
    expect(result).not.toBeNull();
    const joins = resolver.getJoins();
    expect(joins[0]).toContain("jsonb_array_elements_text");
  });
});

// ============================================================
// 修饰符
// ============================================================
describe("RecordFieldResolver — modifiers", () => {
  test(":length modifier (SQLite)", () => {
    const col = newTestCollection();
    const resolver = new RecordFieldResolver(createMockApp("sqlite") as any, col);
    const result = resolver.resolve("title:length");
    expect(result).not.toBeNull();
    // applyLengthModifier wraps in LENGTH() or json_array_length()
    expect(result!.identifier).toBeTruthy();
  });

  test(":lower modifier", () => {
    const col = newTestCollection();
    const resolver = new RecordFieldResolver(createMockApp() as any, col);
    const result = resolver.resolve("title:lower");
    expect(result).not.toBeNull();
    expect(result!.identifier).toContain("LOWER");
  });

  test(":isset modifier", () => {
    const col = newTestCollection();
    const resolver = new RecordFieldResolver(createMockApp() as any, col);
    const result = resolver.resolve("title:isset");
    expect(result).not.toBeNull();
    expect(result!.identifier).toContain("IS NOT NULL");
    expect(result!.noCoalesce).toBe(true);
  });

  test(":each modifier (SQLite)", () => {
    const col = newTestCollection();
    const resolver = new RecordFieldResolver(createMockApp("sqlite") as any, col);
    const result = resolver.resolve("tags:each");
    expect(result).not.toBeNull();
    expect(result!.identifier).toContain("value");
    const joins = resolver.getJoins();
    expect(joins.length).toBe(1);
    expect(joins[0]).toContain("json_each");
  });

  test(":each modifier (PostgreSQL)", () => {
    const col = newTestCollection();
    const resolver = new RecordFieldResolver(createMockApp("postgres") as any, col);
    const result = resolver.resolve("tags:each");
    expect(result).not.toBeNull();
    const joins = resolver.getJoins();
    expect(joins[0]).toContain("jsonb_array_elements_text");
  });
});

// ============================================================
// T008: :isset 修饰符修正 — 检查 requestInfo.body/query/headers 中 key 是否存在
// ============================================================
describe("RecordFieldResolver — :isset modifier (T008)", () => {
  test("@request.body.a:isset — key exists (value is null) → TRUE", () => {
    const col = newTestCollection();
    const reqInfo: RequestInfo = { body: { a: null, b: 123 } };
    const resolver = new RecordFieldResolver(createMockApp() as any, col, reqInfo);
    const result = resolver.resolve("@request.body.a:isset");
    expect(result).not.toBeNull();
    expect(result!.identifier).toBe("TRUE");
    expect(result!.noCoalesce).toBe(true);
  });

  test("@request.body.b:isset — key exists (value is 123) → TRUE", () => {
    const col = newTestCollection();
    const reqInfo: RequestInfo = { body: { a: null, b: 123 } };
    const resolver = new RecordFieldResolver(createMockApp() as any, col, reqInfo);
    const result = resolver.resolve("@request.body.b:isset");
    expect(result).not.toBeNull();
    expect(result!.identifier).toBe("TRUE");
  });

  test("@request.body.c:isset — key missing → FALSE", () => {
    const col = newTestCollection();
    const reqInfo: RequestInfo = { body: { a: null, b: 123 } };
    const resolver = new RecordFieldResolver(createMockApp() as any, col, reqInfo);
    const result = resolver.resolve("@request.body.c:isset");
    expect(result).not.toBeNull();
    expect(result!.identifier).toBe("FALSE");
  });

  test("@request.query.a:isset — key exists (value is empty string) → TRUE", () => {
    const col = newTestCollection();
    const reqInfo: RequestInfo = { query: { a: "", b: "123" } };
    const resolver = new RecordFieldResolver(createMockApp() as any, col, reqInfo);
    const result = resolver.resolve("@request.query.a:isset");
    expect(result).not.toBeNull();
    expect(result!.identifier).toBe("TRUE");
  });

  test("@request.query.c:isset — key missing → FALSE", () => {
    const col = newTestCollection();
    const reqInfo: RequestInfo = { query: { a: "", b: "123" } };
    const resolver = new RecordFieldResolver(createMockApp() as any, col, reqInfo);
    const result = resolver.resolve("@request.query.c:isset");
    expect(result).not.toBeNull();
    expect(result!.identifier).toBe("FALSE");
  });

  test("@request.headers.a:isset — key exists → TRUE", () => {
    const col = newTestCollection();
    const reqInfo: RequestInfo = { headers: { a: "123" } };
    const resolver = new RecordFieldResolver(createMockApp() as any, col, reqInfo);
    const result = resolver.resolve("@request.headers.a:isset");
    expect(result).not.toBeNull();
    expect(result!.identifier).toBe("TRUE");
  });

  test("@request.headers.c:isset — key missing → FALSE", () => {
    const col = newTestCollection();
    const reqInfo: RequestInfo = { headers: { a: "123" } };
    const resolver = new RecordFieldResolver(createMockApp() as any, col, reqInfo);
    const result = resolver.resolve("@request.headers.c:isset");
    expect(result).not.toBeNull();
    expect(result!.identifier).toBe("FALSE");
  });
});

// ============================================================
// T009: :changed 修饰符修正 — 展开为子表达式
// ============================================================
describe("RecordFieldResolver — :changed modifier (T009)", () => {
  test("@request.body.title:changed — expands to isset + not-equal sub-expression", () => {
    const col = newTestCollection();
    const reqInfo: RequestInfo = { body: { title: "new-value" } };
    const resolver = new RecordFieldResolver(createMockApp() as any, col, reqInfo);
    const result = resolver.resolve("@request.body.title:changed");
    expect(result).not.toBeNull();
    // Go 版行为: 展开为 "@request.body.title:isset = true && @request.body.title != title"
    // 返回的 identifier 应该是一个占位符，通过 afterBuild 替换为完整表达式
    // 至少验证它不是简单的 "1" (旧实现)
    expect(result!.noCoalesce).toBe(true);
    // 应该有 afterBuild hook 或者直接内嵌子表达式
    expect(result!.identifier).not.toBe("1");
  });
});

// ============================================================
// getJoins / getJoinParams / updateQuery
// ============================================================
describe("RecordFieldResolver — query helpers", () => {
  test("getJoins accumulates across multiple resolves", () => {
    const col = newTestCollection();
    const resolver = new RecordFieldResolver(createMockApp() as any, col);
    resolver.resolve("rel_one.name");
    resolver.resolve("rel_many.name");
    const joins = resolver.getJoins();
    expect(joins.length).toBe(2);
  });

  test("getJoins deduplicates same join", () => {
    const col = newTestCollection();
    const resolver = new RecordFieldResolver(createMockApp() as any, col);
    resolver.resolve("rel_one.name");
    resolver.resolve("rel_one.title"); // same join alias
    const joins = resolver.getJoins();
    expect(joins.length).toBe(1);
  });

  test("getJoinParams accumulates static params", () => {
    const col = newTestCollection();
    const reqInfo: RequestInfo = { context: "test", method: "POST" };
    const resolver = new RecordFieldResolver(createMockApp() as any, col, reqInfo);
    resolver.resolve("@request.context");
    resolver.resolve("@request.method");
    const params = resolver.getJoinParams();
    expect(Object.keys(params).length).toBe(2);
  });

  test("updateQuery merges joins and params", () => {
    const col = newTestCollection();
    const reqInfo: RequestInfo = { context: "test" };
    const resolver = new RecordFieldResolver(createMockApp() as any, col, reqInfo);
    resolver.resolve("@request.context");
    resolver.resolve("rel_one.name");
    const query = { joins: [] as string[], params: {} as Record<string, unknown> };
    resolver.updateQuery(query);
    expect(query.joins.length).toBe(1);
    expect(Object.keys(query.params).length).toBeGreaterThan(0);
  });

  test("dbType returns sqlite", () => {
    const col = newTestCollection();
    const resolver = new RecordFieldResolver(createMockApp("sqlite") as any, col);
    expect(resolver.dbType()).toBe("sqlite");
  });

  test("dbType returns postgres", () => {
    const col = newTestCollection();
    const resolver = new RecordFieldResolver(createMockApp("postgres") as any, col);
    expect(resolver.dbType()).toBe("postgres");
  });
});
