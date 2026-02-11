/**
 * 权限规则检查 — 与 Go 版 record_crud 中的权限逻辑对齐
 *
 * 权限规则行为:
 * - null rule → 禁止访问 (403)
 * - "" (空字符串) → 公开访问
 * - 非空字符串 → 解析为 SQL WHERE 条件并检查
 */

import type { BaseApp } from "./base";
import type { CollectionModel } from "./collection_model";
import type { RequestInfo } from "./record_field_resolver";
import { RecordFieldResolver } from "./record_field_resolver";
import { parse } from "../tools/search/parser";
import { buildFilterExpr } from "../tools/search/filter_resolver";

export interface PermissionCheckContext {
  app: BaseApp;
  collection: CollectionModel;
  /** null = 禁止访问, "" = 公开, 非空 = 条件表达式 */
  rule: string | null;
  requestInfo: RequestInfo;
  /** 可选: 用于 view/update/delete 的记录 ID 检查 */
  recordId?: string;
}

/**
 * 检查权限规则
 * @throws 如果规则为 null 或条件不满足
 */
export async function checkPermissionRule(ctx: PermissionCheckContext): Promise<void> {
  // null → 禁止访问
  if (ctx.rule === null) {
    throw new Error("The action is not allowed.");
  }

  // 空字符串 → 公开访问
  if (ctx.rule === "") {
    return;
  }

  // 解析规则为 SQL WHERE 条件
  const resolver = new RecordFieldResolver(ctx.app, ctx.collection, ctx.requestInfo);
  const groups = parse(ctx.rule);
  const [whereExpr, params] = buildFilterExpr(groups, { fieldResolver: resolver });

  // 构建查询
  const query: { joins: string[]; params: Record<string, unknown> } = { joins: [], params: {} };
  resolver.updateQuery(query);
  Object.assign(query.params, params);

  let sql = `SELECT COUNT(*) as cnt FROM ${ctx.collection.name}`;

  // 添加 JOIN
  if (query.joins.length > 0) {
    sql += " " + query.joins.join(" ");
  }

  // 添加 WHERE
  const whereParts: string[] = [];
  if (whereExpr) {
    whereParts.push(whereExpr);
  }
  if (ctx.recordId) {
    whereParts.push(`${ctx.collection.name}.id = :__recordId`);
    query.params.__recordId = ctx.recordId;
  }
  if (whereParts.length > 0) {
    sql += " WHERE " + whereParts.join(" AND ");
  }

  // 替换 [[ ]] 方括号标记为实际引号
  sql = sql.replace(/\[\[(\w+)\]\]/g, "`$1`");

  // 替换 :paramName 为 ?
  const paramValues: unknown[] = [];
  sql = sql.replace(/:(\w+)/g, (_, name) => {
    paramValues.push(query.params[name] ?? null);
    return "?";
  });

  const row = ctx.app.dbAdapter().queryOne<{ cnt: number }>(sql, ...paramValues);
  if (!row || row.cnt === 0) {
    throw new Error("The action is not allowed.");
  }
}

/**
 * 构建权限过滤的 WHERE 子句（用于 List 查询注入）
 * @returns [whereExpr, params, joins] 或 null（如果 rule 为空字符串）
 */
export function buildPermissionFilter(
  app: BaseApp,
  collection: CollectionModel,
  rule: string,
  requestInfo: RequestInfo,
): { where: string; params: Record<string, unknown>; joins: string[] } | null {
  if (!rule) return null;

  const resolver = new RecordFieldResolver(app, collection, requestInfo);
  const groups = parse(rule);
  const [whereExpr, params] = buildFilterExpr(groups, { fieldResolver: resolver });

  const query: { joins: string[]; params: Record<string, unknown> } = { joins: [], params: {} };
  resolver.updateQuery(query);
  Object.assign(query.params, params);

  return {
    where: whereExpr,
    params: query.params,
    joins: query.joins,
  };
}
