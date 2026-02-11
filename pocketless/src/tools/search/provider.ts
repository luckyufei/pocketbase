/**
 * SearchProvider — 搜索提供者
 * 与 Go 版 tools/search/provider.go 对齐
 *
 * 整合分页、排序、过滤，执行查询并返回统一结果
 */

import { parse } from "./parser";
import { buildFilterExpr, parseSortFromString, buildSortExpr, type FieldResolver } from "./filter_resolver";
import type { DBAdapter } from "../../core/db_adapter";

// ─── 常量 ───

export const DEFAULT_PER_PAGE = 30;
export const MAX_PER_PAGE = 1000;
export const DEFAULT_FILTER_EXPR_LIMIT = 200;
export const DEFAULT_SORT_EXPR_LIMIT = 8;
export const MAX_FILTER_LENGTH = 3500;
export const MAX_SORT_FIELD_LENGTH = 255;

// ─── 结果 ───

export interface SearchResult {
  page: number;
  perPage: number;
  totalItems: number;
  totalPages: number;
  items: Record<string, unknown>[];
}

// ─── Provider ───

export interface SearchProviderOptions {
  /** 字段解析器 */
  fieldResolver: FieldResolver;
  /** 数据库适配器 */
  dbAdapter: DBAdapter;
  /** 集合名称（表名） */
  tableName: string;
  /** 默认排序（当用户未指定时） */
  defaultSort?: string;
  /** 额外的 WHERE 条件 (已经是 SQL) */
  extraWhere?: string;
  /** 额外的 WHERE 参数 */
  extraParams?: Record<string, unknown>;
}

/**
 * 执行搜索查询
 *
 * @param options 搜索配置
 * @param queryParams URL 查询参数 (page, perPage, sort, filter, skipTotal)
 */
export function execSearch(
  options: SearchProviderOptions,
  queryParams: {
    page?: string;
    perPage?: string;
    sort?: string;
    filter?: string;
    skipTotal?: string;
  },
): SearchResult {
  const { fieldResolver, dbAdapter, tableName, defaultSort, extraWhere, extraParams } = options;

  // 解析分页参数
  let page = Math.max(1, parseInt(queryParams.page || "1", 10) || 1);
  let perPage = parseInt(queryParams.perPage || String(DEFAULT_PER_PAGE), 10) || DEFAULT_PER_PAGE;
  perPage = Math.max(1, Math.min(MAX_PER_PAGE, perPage));
  const skipTotal = queryParams.skipTotal === "true";

  // 构建 WHERE 子句
  const whereParts: string[] = [];
  const allParams: Record<string, unknown> = { ...(extraParams || {}) };

  // 额外的 WHERE 条件
  if (extraWhere) {
    whereParts.push(`(${extraWhere})`);
  }

  // 用户过滤
  if (queryParams.filter) {
    if (queryParams.filter.length > MAX_FILTER_LENGTH) {
      throw new Error("filter expression is too long");
    }

    const groups = parse(queryParams.filter);
    const [filterSql, filterParams] = buildFilterExpr(groups, {
      fieldResolver,
      maxExprLimit: DEFAULT_FILTER_EXPR_LIMIT,
    });

    if (filterSql) {
      whereParts.push(`(${filterSql})`);
      Object.assign(allParams, filterParams);
    }
  }

  // 构建排序
  let orderBy = "";
  const sortRaw = queryParams.sort || defaultSort || "";
  if (sortRaw) {
    if (sortRaw.length > MAX_SORT_FIELD_LENGTH) {
      throw new Error("sort expression is too long");
    }

    const sortFields = parseSortFromString(sortRaw);
    if (sortFields.length > DEFAULT_SORT_EXPR_LIMIT) {
      throw new Error("too many sort fields");
    }

    orderBy = buildSortExpr(sortFields, fieldResolver);
  }

  // 让 field resolver 更新查询（添加 JOIN）
  const joinInfo = { joins: [] as string[], params: {} as Record<string, unknown> };
  if (fieldResolver.updateQuery) {
    fieldResolver.updateQuery(joinInfo);
    Object.assign(allParams, joinInfo.params);
  }

  // 构建 SQL
  const whereClause = whereParts.length > 0 ? ` WHERE ${whereParts.join(" AND ")}` : "";
  const joinClause = joinInfo.joins.length > 0 ? ` ${joinInfo.joins.join(" ")}` : "";
  const orderClause = orderBy ? ` ORDER BY ${orderBy}` : "";

  // 替换 [[ ]] 占位符为双引号引用
  const resolveIdentifiers = (sql: string): string => {
    return sql.replace(/\[\[(\w+)\]\]/g, '"$1"');
  };

  // 替换 :param 占位符为 ? (SQLite) 或 $N (PostgreSQL)
  const resolveParams = (sql: string, params: Record<string, unknown>): [string, unknown[]] => {
    const orderedValues: unknown[] = [];
    let idx = 0;
    const resolved = sql.replace(/:(\w+)/g, (_, name) => {
      if (name in params) {
        orderedValues.push(params[name]);
        idx++;
        return "?";
      }
      return `:${name}`;
    });
    return [resolved, orderedValues];
  };

  // 计算总数
  let totalItems = -1;
  let totalPages = -1;

  if (!skipTotal) {
    const countSql = resolveIdentifiers(
      `SELECT COUNT(*) as count FROM "${tableName}"${joinClause}${whereClause}`,
    );
    const [resolvedCountSql, countValues] = resolveParams(countSql, allParams);
    const countRow = dbAdapter.queryOne<{ count: number }>(resolvedCountSql, ...countValues);
    totalItems = countRow?.count ?? 0;
    totalPages = Math.max(1, Math.ceil(totalItems / perPage));

    // 调整 page 不超过 totalPages
    if (page > totalPages) {
      page = totalPages;
    }
  }

  // 查询数据
  const dataSql = resolveIdentifiers(
    `SELECT "${tableName}".* FROM "${tableName}"${joinClause}${whereClause}${orderClause} LIMIT ${perPage} OFFSET ${(page - 1) * perPage}`,
  );
  const [resolvedDataSql, dataValues] = resolveParams(dataSql, allParams);
  const rows = dbAdapter.query(resolvedDataSql, ...dataValues);

  return {
    page,
    perPage,
    totalItems,
    totalPages,
    items: rows as Record<string, unknown>[],
  };
}
