/**
 * T023 — tools/dbutils/json.ts
 * 对照 Go 版 tools/dbutils/json.go
 * 统一 JSON 查询接口（SQLite vs PostgreSQL）
 */

export function jsonEach(column: string): string {
  return `json_each(CASE WHEN iif(json_valid(${column}), json_type(${column})='array', FALSE) THEN ${column} ELSE json_array(${column}) END)`;
}

export function jsonArrayLength(column: string): string {
  return `json_array_length(CASE WHEN iif(json_valid(${column}), json_type(${column})='array', FALSE) THEN ${column} ELSE (CASE WHEN ${column}='' OR ${column} IS NULL THEN json_array() ELSE json_array(${column}) END) END)`;
}

export function jsonExtract(column: string, path: string): string {
  return `CASE WHEN json_valid(${column}) THEN JSON_EXTRACT(${column}, '$.${path}') ELSE JSON_EXTRACT(json_object('pb', ${column}), '$.pb.${path}') END`;
}
