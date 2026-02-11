/**
 * Record 查询辅助函数
 * 与 Go 版 core/record_query.go 对齐
 */

import type { BaseApp } from "./base";
import { RecordModel } from "./record_model";
import { findCollectionByNameOrId } from "./collection_query";

/** 通过 ID 查找记录 */
export async function findRecordById(
  app: BaseApp,
  collectionNameOrId: string,
  id: string,
): Promise<RecordModel | null> {
  const col = await findCollectionByNameOrId(app, collectionNameOrId);
  if (!col) return null;
  const row = app.dbAdapter().queryOne(`SELECT * FROM ${col.name} WHERE id = ?`, id);
  if (!row) return null;
  const record = new RecordModel(col);
  record.load(row as Record<string, unknown>);
  return record;
}

/** 通过 filter 查找记录列表 */
export async function findRecordsByFilter(
  app: BaseApp,
  collectionNameOrId: string,
  filter: string,
  sort?: string,
  limit?: number,
  offset?: number,
): Promise<RecordModel[]> {
  const col = await findCollectionByNameOrId(app, collectionNameOrId);
  if (!col) return [];
  let sql = `SELECT * FROM ${col.name}`;
  if (filter) sql += ` WHERE ${filter}`;
  if (sort) sql += ` ORDER BY ${sort}`;
  if (limit) sql += ` LIMIT ${limit}`;
  if (offset) sql += ` OFFSET ${offset}`;
  const rows = app.dbAdapter().query(sql);
  return rows.map((row) => {
    const record = new RecordModel(col);
    record.load(row as Record<string, unknown>);
    return record;
  });
}

/** 统计记录数 */
export async function countRecords(
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

/** 查找单条记录（通过 filter） */
export async function findFirstRecordByFilter(
  app: BaseApp,
  collectionNameOrId: string,
  filter: string,
): Promise<RecordModel | null> {
  const records = await findRecordsByFilter(app, collectionNameOrId, filter, undefined, 1);
  return records.length > 0 ? records[0] : null;
}
