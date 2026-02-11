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

export function MustRegister(_app: unknown, config: KVConfig = defaultConfig()): KVStore {
  return new MemoryKVStore(config);
}
