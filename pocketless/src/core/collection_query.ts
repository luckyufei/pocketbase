/**
 * Collection 查询辅助函数
 * 与 Go 版 core/*_query.go 对齐
 */

import type { BaseApp } from "./base";
import { CollectionModel } from "./collection_model";

/** 通过 name 或 id 查找集合 */
export async function findCollectionByNameOrId(
  app: BaseApp,
  nameOrId: string,
): Promise<CollectionModel | null> {
  const row = app.dbAdapter().queryOne(
    `SELECT * FROM _collections WHERE id = ? OR name = ? LIMIT 1`,
    nameOrId,
    nameOrId,
  );
  if (!row) return null;
  const col = new CollectionModel();
  col.load(row as Record<string, unknown>);
  return col;
}

/** 查找所有集合（可按类型过滤） */
export async function findAllCollections(
  app: BaseApp,
  ...types: string[]
): Promise<CollectionModel[]> {
  let sql = "SELECT * FROM _collections";
  const params: unknown[] = [];
  if (types.length > 0) {
    sql += ` WHERE type IN (${types.map(() => "?").join(", ")})`;
    params.push(...types);
  }
  sql += " ORDER BY created ASC";
  const rows = app.dbAdapter().query(sql, ...params);
  return rows.map((row) => {
    const col = new CollectionModel();
    col.load(row as Record<string, unknown>);
    return col;
  });
}

/** 统计集合记录数 */
export async function countCollectionRecords(
  app: BaseApp,
  collectionNameOrId: string,
  filter?: string,
): Promise<number> {
  const col = await findCollectionByNameOrId(app, collectionNameOrId);
  if (!col) return 0;
  let sql = `SELECT COUNT(*) as count FROM ${col.name}`;
  if (filter) sql += ` WHERE ${filter}`;
  const row = app.dbAdapter().queryOne<{ count: number }>(sql);
  return row?.count ?? 0;
}
