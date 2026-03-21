/**
 * PostgresAdapter — Bun.SQL 封装
 * 连接池管理，扩展初始化
 */

import type { DBAdapter } from "./db_adapter";

// Bun.SQL 类型（Bun 内置）
type BunSQL = ReturnType<typeof import("bun").SQL>;

export class PostgresAdapter implements DBAdapter {
  private sql: any; // Bun.SQL 实例
  private initialized = false;

  constructor(dsn: string) {
    // Bun.SQL 内置支持（Bun 1.2+）
    const { SQL } = require("bun");
    this.sql = new SQL({
      url: dsn,
      max: 25,          // Go 版默认最大连接数
      idleTimeout: 300,  // 5 分钟空闲超时
    });
  }

  /** 初始化 PG 扩展 */
  async init(): Promise<void> {
    if (this.initialized) return;
    await this.sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`;
    await this.sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`;
    this.initialized = true;
  }

  type(): "postgres" {
    return "postgres";
  }

  boolValue(val: unknown): boolean {
    return val === true || val === "true" || val === "t";
  }

  formatBool(val: boolean): boolean {
    return val;
  }

  formatTime(val: Date): string {
    return val.toISOString();
  }

  jsonExtract(column: string, path: string): string {
    return `${column}->>'${path}'`;
  }

  jsonArrayLength(column: string): string {
    return `jsonb_array_length(${column})`;
  }

  noCaseCollation(): string {
    return `COLLATE "default"`;
  }

  isUniqueViolation(err: Error): boolean {
    return err.message.includes("unique_violation") || err.message.includes("duplicate key");
  }

  isForeignKeyViolation(err: Error): boolean {
    return err.message.includes("foreign_key_violation") || err.message.includes("violates foreign key");
  }

  rawDB(): unknown {
    return this.sql;
  }

  async close(): Promise<void> {
    await this.sql.close();
  }

  exec(sql: string, ...params: unknown[]): void {
    // 异步操作在 PG 中需要特殊处理
    // 同步包装（实际使用中应该用 async 版本）
    throw new Error("PostgreSQL exec 需要使用 async 方法：execAsync");
  }

  /** 异步执行 SQL */
  async execAsync(sql: string, ...params: unknown[]): Promise<void> {
    if (params.length > 0) {
      await this.sql.unsafe(sql, params);
    } else {
      await this.sql.unsafe(sql);
    }
  }

  query<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T[] {
    throw new Error("PostgreSQL query 需要使用 async 方法：queryAsync");
  }

  /** 异步查询 */
  async queryAsync<T = Record<string, unknown>>(sql: string, ...params: unknown[]): Promise<T[]> {
    if (params.length > 0) {
      return await this.sql.unsafe(sql, params);
    }
    return await this.sql.unsafe(sql);
  }

  queryOne<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T | null {
    throw new Error("PostgreSQL queryOne 需要使用 async 方法：queryOneAsync");
  }

  /** 异步查询单行 */
  async queryOneAsync<T = Record<string, unknown>>(sql: string, ...params: unknown[]): Promise<T | null> {
    const results = await this.queryAsync<T>(sql, ...params);
    return results[0] ?? null;
  }
}
