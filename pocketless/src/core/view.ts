/**
 * View 集合支持 — 与 Go 版 core/view.go 对齐
 *
 * 功能:
 * - saveView: 创建/更新 SQL 视图
 * - deleteView: 删除 SQL 视图
 * - createViewFields: 从 SELECT 查询推断字段类型
 */

import type { CollectionField } from "./collection_model";
import type { DBAdapter } from "./db_adapter";

/** 最小化的 App 接口，只需 dbAdapter */
export interface ViewApp {
  dbAdapter(): DBAdapter;
}

/**
 * 创建或更新 SQL 视图
 * 与 Go 版 SaveView 对齐
 */
export function saveView(app: ViewApp, name: string, selectQuery: string): void {
  const adapter = app.dbAdapter();

  // 先删除旧视图
  deleteView(app, name);

  // 创建新视图
  const sql = `CREATE VIEW "${name}" AS ${selectQuery}`;
  adapter.exec(sql);

  // 验证视图是否创建成功
  try {
    adapter.queryOne(`SELECT 1 FROM "${name}" LIMIT 1`);
  } catch (err) {
    // 如果查询失败说明视图创建有问题，清理并抛出错误
    try { deleteView(app, name); } catch { /* ignore cleanup errors */ }
    throw new Error(`Failed to verify view "${name}": ${err}`);
  }
}

/**
 * 删除 SQL 视图
 * 与 Go 版 DeleteView 对齐
 */
export function deleteView(app: ViewApp, name: string): void {
  app.dbAdapter().exec(`DROP VIEW IF EXISTS "${name}"`);
}

/**
 * 从 SELECT 查询推断字段列表
 * 与 Go 版 CreateViewFields 对齐
 *
 * 通过创建临时视图 → PRAGMA table_info → 推断字段类型
 */
export function createViewFields(app: ViewApp, selectQuery: string): CollectionField[] {
  const adapter = app.dbAdapter();
  const tmpViewName = `__pb_tmp_view_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    // 创建临时视图
    adapter.exec(`CREATE VIEW "${tmpViewName}" AS ${selectQuery}`);

    // 获取列信息
    const columns = adapter.query<{
      cid: number;
      name: string;
      type: string;
      notnull: number;
      dflt_value: string | null;
      pk: number;
    }>(`PRAGMA table_info("${tmpViewName}")`);

    // 验证存在 id 列
    const hasId = columns.some(c => c.name === "id");
    if (!hasId) {
      throw new Error("The view query must include an 'id' column.");
    }

    // 将列映射为 CollectionField
    return columns.map((col) => ({
      id: `f_${col.name}_${Math.random().toString(36).slice(2, 8)}`,
      name: col.name,
      type: inferFieldType(col.type, col.name, selectQuery),
      required: col.notnull === 1,
      options: {},
    }));
  } finally {
    // 清理临时视图
    try { adapter.exec(`DROP VIEW IF EXISTS "${tmpViewName}"`); } catch { /* ignore */ }
  }
}

/**
 * 根据 SQLite 类型推断 PocketBase 字段类型
 */
function inferFieldType(sqlType: string, columnName: string, query: string): string {
  const upper = sqlType.toUpperCase();

  // id 列 → text
  if (columnName === "id") return "text";

  // 检查 SELECT 中是否有聚合函数
  const lowerQuery = query.toLowerCase();
  const colPattern = new RegExp(`(count|sum|avg|total|min|max)\\s*\\([^)]*\\)\\s+(?:as\\s+)?${columnName.toLowerCase()}`, "i");
  if (colPattern.test(lowerQuery)) {
    return "number";
  }

  // 也检查简单的 COUNT(*) as name 模式
  const simpleAggPattern = new RegExp(`(count|sum|avg|total)\\s*\\(`, "i");
  if (upper === "" && simpleAggPattern.test(lowerQuery)) {
    // 空类型 + 查询中有聚合 → 尝试匹配列名
    return "number";
  }

  // 类型映射
  if (upper.includes("INT") || upper.includes("REAL") || upper.includes("NUMERIC") || upper.includes("FLOAT") || upper.includes("DOUBLE")) {
    return "number";
  }

  if (upper.includes("BOOL")) {
    return "bool";
  }

  if (upper.includes("DATE") || upper.includes("TIME")) {
    return "autodate";
  }

  if (upper.includes("JSON") || upper.includes("BLOB")) {
    return "json";
  }

  // 默认为 text
  return "text";
}
