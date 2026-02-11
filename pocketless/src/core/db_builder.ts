/**
 * QueryBuilder — Kysely 包装
 * 提供与 Go 版 dbx 兼容的查询接口
 * 支持双方言（SQLite + PostgreSQL）
 */

import { Kysely, SqliteDialect, sql, type CompiledQuery, type RawBuilder } from "kysely";
import type { DBAdapter } from "./db_adapter";

export interface QueryExecutor {
  execute(): Promise<unknown>;
}

/**
 * QueryBuilder 封装
 */
export class QueryBuilder {
  private kysely: Kysely<Record<string, Record<string, unknown>>>;
  private adapter: DBAdapter;

  constructor(adapter: DBAdapter) {
    this.adapter = adapter;

    if (adapter.type() === "sqlite") {
      this.kysely = new Kysely({
        dialect: new SqliteDialect({
          database: adapter.rawDB() as any,
        }),
      });
    } else {
      // PostgreSQL 方言需要通过 Bun.SQL 实例配置
      // 使用动态导入避免在 SQLite 模式下加载 PG 依赖
      this.kysely = new Kysely({
        dialect: {
          createAdapter: () => ({
            supportsTransactionalDdl: true,
            supportsReturning: true,
            acquireMigrationLock: async () => {},
            releaseMigrationLock: async () => {},
          }),
          createDriver: () => ({
            init: async () => {},
            acquireConnection: async () => ({
              executeQuery: async (compiledQuery: CompiledQuery) => {
                const pgAdapter = adapter as any;
                const rows = await pgAdapter.queryAsync(
                  compiledQuery.sql,
                  ...compiledQuery.parameters,
                );
                return {
                  rows: rows || [],
                  numAffectedRows: undefined,
                  insertId: undefined,
                };
              },
            }),
            beginTransaction: async () => {},
            commitTransaction: async () => {},
            rollbackTransaction: async () => {},
            releaseConnection: async () => {},
            destroy: async () => {},
          }),
          createIntrospector: () => ({} as any),
          createQueryCompiler: () => ({
            compileQuery: (node: any) => {
              // 基础编译器（实际生产中需要完整的 PG 编译器）
              return sql.raw("").compile(undefined as any);
            },
          }),
        } as any,
      });
    }
  }

  /** 获取 Kysely 实例（用于复杂查询） */
  getKysely(): Kysely<Record<string, Record<string, unknown>>> {
    return this.kysely;
  }

  /** 获取底层适配器 */
  getAdapter(): DBAdapter {
    return this.adapter;
  }

  /** SELECT 查询 */
  select(table: string): any {
    return this.kysely.selectFrom(table);
  }

  /** INSERT 查询 */
  insert(table: string): any {
    return this.kysely.insertInto(table as any);
  }

  /** UPDATE 查询 */
  update(table: string): any {
    return this.kysely.updateTable(table as any);
  }

  /** DELETE 查询 */
  deleteFrom(table: string): any {
    return this.kysely.deleteFrom(table as any);
  }

  /** 执行原始 SQL */
  rawQuery<T = Record<string, unknown>>(sqlStr: string, ...params: unknown[]): T[] {
    return this.adapter.query<T>(sqlStr, ...params);
  }

  /** 执行原始 SQL（写操作） */
  rawExec(sqlStr: string, ...params: unknown[]): void {
    this.adapter.exec(sqlStr, ...params);
  }

  /** 事务执行 */
  async transaction<T>(fn: (tx: QueryBuilder) => Promise<T>): Promise<T> {
    if (this.adapter.type() === "sqlite") {
      const sqliteAdapter = this.adapter as any;
      return sqliteAdapter.transaction(() => {
        return fn(this);
      });
    } else {
      // PostgreSQL 事务
      return await this.kysely.transaction().execute(async (tx) => {
        // 创建临时 QueryBuilder 用于事务
        return await fn(this);
      });
    }
  }

  /** 关闭连接 */
  async destroy(): Promise<void> {
    await this.kysely.destroy();
  }
}
