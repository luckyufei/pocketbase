/**
 * KV 插件 — 类 Redis 键值存储
 * 对照 Go 版 plugins/kv/
 *
 * 功能: _kv 表、L1 内存缓存 + L2 数据库、TTL、原子计数器、Hash、分布式锁
 */

export interface KVConfig {
  enabled: boolean;
  httpEnabled?: boolean;
  l1MaxSize?: number; // 字节
  l1MaxItems?: number;
  cleanupInterval?: number; // 秒
}

export function defaultConfig(): KVConfig {
  return {
    enabled: false,
    httpEnabled: false,
    l1MaxSize: 100 * 1024 * 1024, // 100MB
    l1MaxItems: 10000,
    cleanupInterval: 60,
  };
}

export interface KVStore {
  get(key: string): Promise<unknown | null>;
  set(key: string, value: unknown, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  ttl(key: string): Promise<number>; // 剩余秒数，-1 = 无过期，-2 = 不存在
  expire(key: string, ttlSeconds: number): Promise<void>;
  incr(key: string): Promise<number>;
  incrBy(key: string, amount: number): Promise<number>;
  decr(key: string): Promise<number>;
  hset(key: string, field: string, value: unknown): Promise<void>;
  hget(key: string, field: string): Promise<unknown | null>;
  hgetAll(key: string): Promise<Record<string, unknown>>;
  hdel(key: string, field: string): Promise<void>;
  hincrBy(key: string, field: string, amount: number): Promise<number>;
  lock(key: string, ttlSeconds: number): Promise<boolean>;
  unlock(key: string): Promise<void>;
  mset(entries: Record<string, unknown>): Promise<void>;
  mget(keys: string[]): Promise<(unknown | null)[]>;
  keys(pattern: string): Promise<string[]>;
  isEnabled(): boolean;
}

interface KVEntry {
  value: unknown;
  expireAt: number | null; // Unix ms
}

/** 内存实现 */
export class MemoryKVStore implements KVStore {
  private data: Map<string, KVEntry> = new Map();
  private locks: Map<string, number> = new Map(); // key -> expireAt
  private config: KVConfig;

  constructor(config: KVConfig) {
    this.config = config;
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  private isExpired(entry: KVEntry): boolean {
    return entry.expireAt !== null && Date.now() > entry.expireAt;
  }

  private getEntry(key: string): KVEntry | null {
    const entry = this.data.get(key);
    if (!entry || this.isExpired(entry)) {
      if (entry) this.data.delete(key);
      return null;
    }
    return entry;
  }

  async get(key: string): Promise<unknown | null> {
    return this.getEntry(key)?.value ?? null;
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    this.data.set(key, {
      value,
      expireAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
    });
  }

  async delete(key: string): Promise<void> {
    this.data.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    return this.getEntry(key) !== null;
  }

  async ttl(key: string): Promise<number> {
    const entry = this.getEntry(key);
    if (!entry) return -2;
    if (entry.expireAt === null) return -1;
    return Math.max(0, Math.ceil((entry.expireAt - Date.now()) / 1000));
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    const entry = this.getEntry(key);
    if (entry) entry.expireAt = Date.now() + ttlSeconds * 1000;
  }

  async incr(key: string): Promise<number> {
    return this.incrBy(key, 1);
  }

  async incrBy(key: string, amount: number): Promise<number> {
    const entry = this.getEntry(key);
    const current = typeof entry?.value === "number" ? entry.value : 0;
    const next = current + amount;
    await this.set(key, next);
    return next;
  }

  async decr(key: string): Promise<number> {
    return this.incrBy(key, -1);
  }

  async hset(key: string, field: string, value: unknown): Promise<void> {
    const entry = this.getEntry(key);
    const hash = (entry?.value && typeof entry.value === "object") ? entry.value as Record<string, unknown> : {};
    hash[field] = value;
    await this.set(key, hash);
  }

  async hget(key: string, field: string): Promise<unknown | null> {
    const entry = this.getEntry(key);
    if (!entry?.value || typeof entry.value !== "object") return null;
    return (entry.value as Record<string, unknown>)[field] ?? null;
  }

  async hgetAll(key: string): Promise<Record<string, unknown>> {
    const entry = this.getEntry(key);
    if (!entry?.value || typeof entry.value !== "object") return {};
    return { ...(entry.value as Record<string, unknown>) };
  }

  async hdel(key: string, field: string): Promise<void> {
    const entry = this.getEntry(key);
    if (entry?.value && typeof entry.value === "object") {
      delete (entry.value as Record<string, unknown>)[field];
    }
  }

  async hincrBy(key: string, field: string, amount: number): Promise<number> {
    const current = await this.hget(key, field);
    const next = (typeof current === "number" ? current : 0) + amount;
    await this.hset(key, field, next);
    return next;
  }

  async lock(key: string, ttlSeconds: number): Promise<boolean> {
    const lockKey = `__lock:${key}`;
    const existing = this.locks.get(lockKey);
    if (existing && Date.now() < existing) return false;
    this.locks.set(lockKey, Date.now() + ttlSeconds * 1000);
    return true;
  }

  async unlock(key: string): Promise<void> {
    this.locks.delete(`__lock:${key}`);
  }

  async mset(entries: Record<string, unknown>): Promise<void> {
    for (const [k, v] of Object.entries(entries)) {
      await this.set(k, v);
    }
  }

  async mget(keys: string[]): Promise<(unknown | null)[]> {
    return Promise.all(keys.map((k) => this.get(k)));
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
    const result: string[] = [];
    for (const [key, entry] of this.data) {
      if (!this.isExpired(entry) && regex.test(key)) {
        result.push(key);
      }
    }
    return result;
  }
}

export function applyEnvOverrides(config: KVConfig): KVConfig {
  const c = { ...config };
  const disabled = process.env["PB_KV_DISABLED"];
  if (disabled) c.enabled = !(disabled === "true" || disabled === "1");
  const httpEnabled = process.env["PB_KV_HTTP_ENABLED"];
  if (httpEnabled) c.httpEnabled = httpEnabled === "true" || httpEnabled === "1";
  const cleanup = Number(process.env["PB_KV_CLEANUP_INTERVAL"]);
  if (cleanup > 0) c.cleanupInterval = cleanup;
  return c;
}

// ─── DBKVStore（L1 内存 + L2 数据库）────────────────────────────────────────

import type { DBAdapter } from "../../core/db_adapter";
import { DateTime } from "../../tools/types/datetime";

/**
 * 双层 KV 存储：L1 内存缓存 + L2 SQLite 持久化。
 * 读取策略：L1 命中 → 直接返回；L1 miss → 查 L2 → 填充 L1。
 * 写入策略：同步写入 L1 和 L2。
 * 对照 Go 版 kv_store.go DBKVStore。
 */
export class DBKVStore implements KVStore {
  private readonly db: DBAdapter;
  private readonly l1: MemoryKVStore;
  private readonly config: KVConfig;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: KVConfig, db: DBAdapter) {
    this.config = config;
    this.db = db;
    this.l1 = new MemoryKVStore(config);
    // 启动后台 TTL 清理
    const interval = (config.cleanupInterval ?? 60) * 1000;
    this.cleanupTimer = setInterval(() => this._cleanupExpired(), interval);
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  /** 停止后台清理 */
  stopCleanup(): void {
    if (this.cleanupTimer) { clearInterval(this.cleanupTimer); this.cleanupTimer = null; }
  }

  // ── 基础操作 ──────────────────────────────────────────────────────────────

  async get(key: string): Promise<unknown | null> {
    // L1 先查
    const l1val = await this.l1.get(key);
    if (l1val !== null) return l1val;
    // L2 回源
    return this._getFromDB(key);
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    await this.l1.set(key, value, ttlSeconds);
    this._setInDB(key, "scalar", value, ttlSeconds);
  }

  async delete(key: string): Promise<void> {
    await this.l1.delete(key);
    this.db.exec(`DELETE FROM _kv WHERE key = ?`, key);
    this.db.exec(`DELETE FROM _kv_hash WHERE key = ?`, key);
  }

  async exists(key: string): Promise<boolean> {
    const val = await this.get(key);
    return val !== null;
  }

  async ttl(key: string): Promise<number> {
    // 优先用 L1（更精确）
    const l1ttl = await this.l1.ttl(key);
    if (l1ttl !== -2) return l1ttl;
    // L1 miss → 查 L2
    const row = this.db.queryOne<{ expireAt: string | null }>(
      `SELECT expireAt FROM _kv WHERE key = ?`, key,
    );
    if (!row) return -2;
    if (!row.expireAt) return -1;
    const remaining = Math.ceil((new Date(row.expireAt).getTime() - Date.now()) / 1000);
    return remaining > 0 ? remaining : -2;
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    await this.l1.expire(key, ttlSeconds);
    const expireAt = new DateTime(new Date(Date.now() + ttlSeconds * 1000)).toSQLite();
    this.db.exec(`UPDATE _kv SET expireAt=?, updated=? WHERE key=?`, expireAt, DateTime.now().toSQLite(), key);
  }

  // ── 计数器 ────────────────────────────────────────────────────────────────

  async incr(key: string): Promise<number> { return this.incrBy(key, 1); }
  async decr(key: string): Promise<number> { return this.incrBy(key, -1); }

  async incrBy(key: string, amount: number): Promise<number> {
    const current = (await this.get(key));
    const next = (typeof current === "number" ? current : 0) + amount;
    await this.set(key, next);
    return next;
  }

  // ── Hash ──────────────────────────────────────────────────────────────────

  async hset(key: string, field: string, value: unknown): Promise<void> {
    await this.l1.hset(key, field, value);
    const nowStr = DateTime.now().toSQLite();
    // 确保主键行存在
    this.db.exec(
      `INSERT OR IGNORE INTO _kv (key, type, value, created, updated) VALUES (?, 'hash', '{}', ?, ?)`,
      key, nowStr, nowStr,
    );
    this.db.exec(
      `INSERT OR REPLACE INTO _kv_hash (key, field, value) VALUES (?, ?, ?)`,
      key, field, JSON.stringify(value),
    );
  }

  async hget(key: string, field: string): Promise<unknown | null> {
    // L1 先查
    const l1val = await this.l1.hget(key, field);
    if (l1val !== null) return l1val;
    // L2 回源
    const row = this.db.queryOne<{ value: string }>(
      `SELECT value FROM _kv_hash WHERE key = ? AND field = ?`, key, field,
    );
    if (!row) return null;
    try { return JSON.parse(row.value); } catch { return null; }
  }

  async hgetAll(key: string): Promise<Record<string, unknown>> {
    const rows = this.db.query<{ field: string; value: string }>(
      `SELECT field, value FROM _kv_hash WHERE key = ?`, key,
    );
    if (rows.length === 0) return await this.l1.hgetAll(key);
    const result: Record<string, unknown> = {};
    for (const r of rows) {
      try { result[r.field] = JSON.parse(r.value); } catch { result[r.field] = null; }
    }
    return result;
  }

  async hdel(key: string, field: string): Promise<void> {
    await this.l1.hdel(key, field);
    this.db.exec(`DELETE FROM _kv_hash WHERE key = ? AND field = ?`, key, field);
  }

  async hincrBy(key: string, field: string, amount: number): Promise<number> {
    const current = await this.hget(key, field);
    const next = (typeof current === "number" ? current : 0) + amount;
    await this.hset(key, field, next);
    return next;
  }

  // ── 分布式锁（使用 _kv 表保证持久化）────────────────────────────────────

  async lock(key: string, ttlSeconds: number): Promise<boolean> {
    const lockKey = `__lock:${key}`;
    // 先查 L1（最快路径）
    const l1lock = await this.l1.lock(key, ttlSeconds);
    if (!l1lock) return false;
    // L2 原子锁（check-and-set）
    const row = this.db.queryOne<{ expireAt: string | null }>(
      `SELECT expireAt FROM _kv WHERE key = ?`, lockKey,
    );
    const now = Date.now();
    if (row && row.expireAt && new Date(row.expireAt).getTime() > now) {
      // 锁被占用，回滚 L1
      await this.l1.unlock(key);
      return false;
    }
    const expireAt = new DateTime(new Date(now + ttlSeconds * 1000)).toSQLite();
    const nowStr = DateTime.now().toSQLite();
    this.db.exec(
      `INSERT OR REPLACE INTO _kv (key, type, value, expireAt, created, updated) VALUES (?, 'scalar', '1', ?, ?, ?)`,
      lockKey, expireAt, nowStr, nowStr,
    );
    return true;
  }

  async unlock(key: string): Promise<void> {
    await this.l1.unlock(key);
    this.db.exec(`DELETE FROM _kv WHERE key = ?`, `__lock:${key}`);
  }

  // ── 批量操作 ──────────────────────────────────────────────────────────────

  async mset(entries: Record<string, unknown>): Promise<void> {
    for (const [k, v] of Object.entries(entries)) await this.set(k, v);
  }

  async mget(keys: string[]): Promise<(unknown | null)[]> {
    return Promise.all(keys.map((k) => this.get(k)));
  }

  async keys(pattern: string): Promise<string[]> {
    // 组合 L1 和 L2 的结果
    const l1keys = new Set(await this.l1.keys(pattern));
    const regexStr = "^" + pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$";
    const regex = new RegExp(regexStr);
    const nowStr = DateTime.now().toSQLite();
    const l2rows = this.db.query<{ key: string }>(
      `SELECT key FROM _kv WHERE (expireAt IS NULL OR expireAt > ?)`, nowStr,
    );
    for (const r of l2rows) {
      if (regex.test(r.key)) l1keys.add(r.key);
    }
    return Array.from(l1keys).sort();
  }

  // ── 私有方法 ──────────────────────────────────────────────────────────────

  private _getFromDB(key: string): unknown | null {
    const row = this.db.queryOne<{ value: string; expireAt: string | null; type: string }>(
      `SELECT value, expireAt, type FROM _kv WHERE key = ?`, key,
    );
    if (!row) return null;
    // 检查过期
    if (row.expireAt && new Date(row.expireAt).getTime() < Date.now()) {
      this.db.exec(`DELETE FROM _kv WHERE key = ?`, key);
      return null;
    }
    try {
      const value = JSON.parse(row.value);
      // 填充 L1
      const ttlMs = row.expireAt ? new Date(row.expireAt).getTime() - Date.now() : null;
      void this.l1.set(key, value, ttlMs ? Math.ceil(ttlMs / 1000) : undefined);
      return value;
    } catch { return null; }
  }

  private _setInDB(key: string, type: string, value: unknown, ttlSeconds?: number): void {
    const expireAt = ttlSeconds
      ? new DateTime(new Date(Date.now() + ttlSeconds * 1000)).toSQLite()
      : null;
    const nowStr = DateTime.now().toSQLite();
    this.db.exec(
      `INSERT OR REPLACE INTO _kv (key, type, value, expireAt, created, updated) VALUES (?, ?, ?, ?, ?, ?)`,
      key, type, JSON.stringify(value), expireAt, nowStr, nowStr,
    );
  }

  /** 清理 L2 中已过期的 key */
  private _cleanupExpired(): void {
    const nowStr = DateTime.now().toSQLite();
    this.db.exec(`DELETE FROM _kv WHERE expireAt IS NOT NULL AND expireAt < ?`, nowStr);
    // 同步删除失效的 hash 子行（外键级联 OR 手动）
    this.db.exec(
      `DELETE FROM _kv_hash WHERE key NOT IN (SELECT key FROM _kv)`,
    );
  }
}

// ─── MustRegister ────────────────────────────────────────────────────────────

export function MustRegister(
  _app: unknown,
  config: KVConfig = defaultConfig(),
  db?: DBAdapter,
): KVStore {
  const merged = applyEnvOverrides(config);
  if (db) return new DBKVStore(merged, db);
  return new MemoryKVStore(merged);
}
