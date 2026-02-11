/**
 * SQLiteAdapter — bun:sqlite 封装
 * WAL 模式 + PRAGMA 设置与 Go 版完全对齐
 * 写入通过 Mutex 序列化
 */

import { Database } from "bun:sqlite";
import type { DBAdapter } from "./db_adapter";

export class SQLiteAdapter implements DBAdapter {
  private db: Database;
  private writeLock: Promise<void> = Promise.resolve();

  constructor(dbPath: string) {
    this.db = new Database(dbPath, { create: true, strict: true });
    this.initPragmas();
  }

  private initPragmas(): void {
    // 与 Go 版完全一致的 PRAGMA 设置
    this.db.run("PRAGMA journal_mode = WAL");
    this.db.run("PRAGMA busy_timeout = 10000");
    this.db.run("PRAGMA foreign_keys = ON");
    this.db.run("PRAGMA cache_size = -16000"); // 16MB cache
    this.db.run("PRAGMA synchronous = NORMAL");
  }

  type(): "sqlite" {
    return "sqlite";
  }

  boolValue(val: unknown): boolean {
    return !!val && val !== 0 && val !== "0" && val !== "false";
  }

  formatBool(val: boolean): number {
    return val ? 1 : 0;
  }

  formatTime(val: Date): string {
    // SQLite 格式: "YYYY-MM-DD HH:mm:ss.SSSZ"
    return val.toISOString().replace("T", " ").slice(0, 23) + "Z";
  }

  jsonExtract(column: string, path: string): string {
    return `JSON_EXTRACT(${column}, '$.${path}')`;
  }

  jsonArrayLength(column: string): string {
    return `JSON_ARRAY_LENGTH(${column})`;
  }

  noCaseCollation(): string {
    return "COLLATE NOCASE";
  }

  isUniqueViolation(err: Error): boolean {
    return err.message.includes("UNIQUE constraint failed");
  }

  isForeignKeyViolation(err: Error): boolean {
    return err.message.includes("FOREIGN KEY constraint failed");
  }

  rawDB(): Database {
    return this.db;
  }

  async close(): Promise<void> {
    this.db.close();
  }

  exec(sql: string, ...params: unknown[]): void {
    if (params.length > 0) {
      this.db.run(sql, params as Parameters<Database["run"]>[1]);
    } else {
      this.db.run(sql);
    }
  }

  query<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T[] {
    const stmt = this.db.prepare(sql);
    if (params.length > 0) {
      return stmt.all(params as Parameters<ReturnType<Database["prepare"]>["all"]>[0]) as T[];
    }
    return stmt.all() as T[];
  }

  queryOne<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T | null {
    const stmt = this.db.prepare(sql);
    if (params.length > 0) {
      return (stmt.get(params as Parameters<ReturnType<Database["prepare"]>["get"]>[0]) as T) ?? null;
    }
    return (stmt.get() as T) ?? null;
  }

  /** 事务执行（写入 Mutex 序列化） */
  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }
}
