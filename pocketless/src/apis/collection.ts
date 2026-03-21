/**
 * Collection CRUD 端点
 * 与 Go 版 apis/collection.go 对齐
 * 所有路由要求 Superuser 认证（Phase 8 实现后添加中间件）
 *
 * GET    /api/collections               → 列表（分页）
 * POST   /api/collections               → 创建
 * GET    /api/collections/:idOrName     → 查看
 * PATCH  /api/collections/:idOrName     → 更新
 * DELETE /api/collections/:idOrName     → 删除
 * DELETE /api/collections/:idOrName/truncate → 清空
 * PUT    /api/collections/import         → 导入
 */

import type { Hono } from "hono";
import type { BaseApp } from "../core/base";
import { CollectionModel } from "../core/collection_model";
import { notFoundError, badRequestError } from "./errors";

export function registerCollectionRoutes(app: Hono, baseApp: BaseApp): void {
  // 列表
  app.get("/api/collections", async (c) => {
    const page = Math.max(1, parseInt(c.req.query("page") || "1", 10));
    const perPage = Math.min(500, Math.max(1, parseInt(c.req.query("perPage") || "30", 10)));
    const skipTotal = c.req.query("skipTotal") === "true";

    let sql = "SELECT * FROM _collections";
    const filter = c.req.query("filter");
    if (filter) sql += ` WHERE ${filter}`;

    const sort = c.req.query("sort");
    if (sort) {
      const parts = sort.split(",").map((s) => {
        s = s.trim();
        if (s.startsWith("-")) return `${s.slice(1)} DESC`;
        if (s.startsWith("+")) return `${s.slice(1)} ASC`;
        return `${s} ASC`;
      });
      sql += ` ORDER BY ${parts.join(", ")}`;
    } else {
      sql += " ORDER BY created ASC";
    }

    let totalItems = -1;
    let totalPages = -1;
    if (!skipTotal) {
      let countSql = "SELECT COUNT(*) as count FROM _collections";
      if (filter) countSql += ` WHERE ${filter}`;
      const countRow = baseApp.dbAdapter().queryOne<{ count: number }>(countSql);
      totalItems = countRow?.count ?? 0;
      totalPages = Math.ceil(totalItems / perPage) || 1;
    }

    sql += ` LIMIT ${perPage} OFFSET ${(page - 1) * perPage}`;
    const rows = baseApp.dbAdapter().query(sql);
    const items = rows.map((row) => {
      const col = new CollectionModel();
      col.load(row as Record<string, unknown>);
      return col.toJSON();
    });

    return c.json({ page, perPage, totalItems, totalPages, items });
  });

  // 查看
  app.get("/api/collections/:idOrName", async (c) => {
    const col = await baseApp.findCollectionByNameOrId(c.req.param("idOrName"));
    if (!col) throw notFoundError();
    return c.json(col.toJSON());
  });

  // 创建
  app.post("/api/collections", async (c) => {
    const body = await c.req.json();
    const col = new CollectionModel();
    col.load(body);
    if (!col.name) throw badRequestError("Failed to create collection.", { name: { code: "validation_required", message: "Missing required value." } });
    // 保存到数据库
    const row = col.toDBRow();
    const keys = Object.keys(row);
    const placeholders = keys.map(() => "?").join(", ");
    baseApp.dbAdapter().exec(
      `INSERT INTO _collections (${keys.join(", ")}) VALUES (${placeholders})`,
      ...keys.map((k) => row[k]),
    );
    // 创建对应的数据表
    createCollectionTable(baseApp, col);
    col.markAsNotNew();
    return c.json(col.toJSON());
  });

  // 更新
  app.patch("/api/collections/:idOrName", async (c) => {
    const col = await baseApp.findCollectionByNameOrId(c.req.param("idOrName"));
    if (!col) throw notFoundError();
    const body = await c.req.json();
    // 更新可变字段
    if (body.name !== undefined) col.name = body.name;
    if (body.type !== undefined) col.type = body.type;
    if (body.fields !== undefined) col.fields = body.fields;
    if (body.indexes !== undefined) col.indexes = body.indexes;
    if (body.listRule !== undefined) col.listRule = body.listRule;
    if (body.viewRule !== undefined) col.viewRule = body.viewRule;
    if (body.createRule !== undefined) col.createRule = body.createRule;
    if (body.updateRule !== undefined) col.updateRule = body.updateRule;
    if (body.deleteRule !== undefined) col.deleteRule = body.deleteRule;
    if (body.options !== undefined) col.options = body.options;
    col.refreshTimestamps();
    const row = col.toDBRow();
    const updateKeys = Object.keys(row).filter((k) => k !== "id");
    const sets = updateKeys.map((k) => `${k} = ?`).join(", ");
    baseApp.dbAdapter().exec(
      `UPDATE _collections SET ${sets} WHERE id = ?`,
      ...updateKeys.map((k) => row[k]),
      col.id,
    );
    return c.json(col.toJSON());
  });

  // 删除
  app.delete("/api/collections/:idOrName", async (c) => {
    const col = await baseApp.findCollectionByNameOrId(c.req.param("idOrName"));
    if (!col) throw notFoundError();
    if (col.system) throw badRequestError("You cannot delete system collections.");
    baseApp.dbAdapter().exec(`DROP TABLE IF EXISTS ${col.name}`);
    baseApp.dbAdapter().exec(`DELETE FROM _collections WHERE id = ?`, col.id);
    return c.body(null, 204);
  });

  // 清空（Truncate）
  app.delete("/api/collections/:idOrName/truncate", async (c) => {
    const col = await baseApp.findCollectionByNameOrId(c.req.param("idOrName"));
    if (!col) throw notFoundError();
    baseApp.dbAdapter().exec(`DELETE FROM ${col.name}`);
    return c.body(null, 204);
  });

  // 导入
  app.put("/api/collections/import", async (c) => {
    const body = await c.req.json();
    const collections = body.collections as Record<string, unknown>[];
    const deleteMissing = !!body.deleteMissing;

    if (!Array.isArray(collections)) {
      throw badRequestError("Invalid import data.");
    }

    if (deleteMissing) {
      const existing = await baseApp.findAllCollections();
      const importIds = new Set(collections.map((c: any) => c.id).filter(Boolean));
      const importNames = new Set(collections.map((c: any) => c.name).filter(Boolean));
      for (const ex of existing) {
        if (!importIds.has(ex.id) && !importNames.has(ex.name) && !ex.system) {
          baseApp.dbAdapter().exec(`DROP TABLE IF EXISTS ${ex.name}`);
          baseApp.dbAdapter().exec(`DELETE FROM _collections WHERE id = ?`, ex.id);
        }
      }
    }

    for (const colData of collections) {
      const existing = colData.id
        ? await baseApp.findCollectionByNameOrId(colData.id as string)
        : colData.name
          ? await baseApp.findCollectionByNameOrId(colData.name as string)
          : null;

      if (existing) {
        // 更新现有
        existing.load(colData);
        existing.refreshTimestamps();
        const row = existing.toDBRow();
        const updateKeys = Object.keys(row).filter((k) => k !== "id");
        const sets = updateKeys.map((k) => `${k} = ?`).join(", ");
        baseApp.dbAdapter().exec(
          `UPDATE _collections SET ${sets} WHERE id = ?`,
          ...updateKeys.map((k) => row[k]),
          existing.id,
        );
      } else {
        // 创建新的
        const col = new CollectionModel();
        col.load(colData);
        const row = col.toDBRow();
        const keys = Object.keys(row);
        const placeholders = keys.map(() => "?").join(", ");
        baseApp.dbAdapter().exec(
          `INSERT INTO _collections (${keys.join(", ")}) VALUES (${placeholders})`,
          ...keys.map((k) => row[k]),
        );
        createCollectionTable(baseApp, col);
      }
    }

    return c.body(null, 204);
  });
}

/** 创建集合对应的数据表 */
function createCollectionTable(app: BaseApp, col: CollectionModel): void {
  const columns: string[] = ["id TEXT PRIMARY KEY"];
  for (const field of col.fields) {
    // 基本列类型映射
    const colType = getFieldColumnType(field.type);
    if (colType) columns.push(`${field.name} ${colType}`);
  }
  columns.push("created TEXT DEFAULT ''");
  columns.push("updated TEXT DEFAULT ''");
  const sql = `CREATE TABLE IF NOT EXISTS ${col.name} (${columns.join(", ")})`;
  app.dbAdapter().exec(sql);
}

/** 获取字段对应的 SQL 列类型 */
function getFieldColumnType(fieldType: string): string {
  const map: Record<string, string> = {
    text: "TEXT DEFAULT '' NOT NULL",
    number: "NUMERIC DEFAULT 0 NOT NULL",
    bool: "BOOLEAN DEFAULT FALSE NOT NULL",
    email: "TEXT DEFAULT '' NOT NULL",
    url: "TEXT DEFAULT '' NOT NULL",
    editor: "TEXT DEFAULT '' NOT NULL",
    date: "TEXT DEFAULT '' NOT NULL",
    autodate: "TEXT DEFAULT '' NOT NULL",
    select: "TEXT DEFAULT '' NOT NULL",
    file: "TEXT DEFAULT '' NOT NULL",
    relation: "TEXT DEFAULT '' NOT NULL",
    json: "JSON DEFAULT NULL",
    password: "TEXT DEFAULT '' NOT NULL",
    geoPoint: "JSON DEFAULT '{\"lon\":0,\"lat\":0}' NOT NULL",
    secret: "TEXT DEFAULT '' NOT NULL",
    vector: "JSON DEFAULT '[]' NOT NULL",
  };
  return map[fieldType] || "TEXT DEFAULT '' NOT NULL";
}
