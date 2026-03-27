/**
 * Secrets 插件 — 加密密钥管理
 * 对照 Go 版 plugins/secrets/
 *
 * 功能: _secrets 表、AES-256-GCM 加解密、环境隔离、REST API
 */

import { encrypt, decrypt } from "../../tools/security/crypto";

export interface SecretOption {
  env?: string;
  description?: string;
}

export interface Secret {
  id: string;
  key: string;
  value: string; // 加密后的密文
  env: string;
  description: string;
  created: string;
  updated: string;
}

export interface SecretsConfig {
  enabled: boolean;
  masterKey: string; // 32 字节 AES 密钥
  httpEnabled?: boolean;
}

export function defaultConfig(): SecretsConfig {
  return {
    enabled: false,
    masterKey: "",
    httpEnabled: true,
  };
}

/**
 * 从环境变量读取配置覆盖（对照 Go 版 applyEnvOverrides）
 *
 * 支持的环境变量：
 *   PB_SECRETS_MASTER_KEY  — 覆盖 masterKey
 *   PB_SECRETS_ENABLED     — "true"/"false" 覆盖 enabled
 *   PB_SECRETS_HTTP_ENABLED — "true"/"false" 覆盖 httpEnabled
 */
export function applyEnvOverrides(config: SecretsConfig): SecretsConfig {
  const result = { ...config };

  const masterKey = process.env.PB_SECRETS_MASTER_KEY;
  if (masterKey !== undefined) result.masterKey = masterKey;

  const enabled = process.env.PB_SECRETS_ENABLED;
  if (enabled !== undefined) result.enabled = enabled === "true";

  const httpEnabled = process.env.PB_SECRETS_HTTP_ENABLED;
  if (httpEnabled !== undefined) result.httpEnabled = httpEnabled !== "false";

  return result;
}

export interface SecretsStore {
  isEnabled(): boolean;
  set(key: string, value: string, options?: SecretOption): Promise<void>;
  get(key: string, env?: string): Promise<string>;
  getWithDefault(key: string, defaultValue: string): Promise<string>;
  delete(key: string, env?: string): Promise<void>;
  exists(key: string, env?: string): Promise<boolean>;
  list(env?: string): Promise<Secret[]>;
  /** 列出所有 key 名称（去重） */
  keys(): Promise<string[]>;
}

/** 内存实现（用于测试和轻量场景） */
export class MemorySecretsStore implements SecretsStore {
  private secrets: Map<string, Secret> = new Map();
  private config: SecretsConfig;

  constructor(config: SecretsConfig) {
    this.config = config;
  }

  isEnabled(): boolean {
    return this.config.enabled && this.config.masterKey.length === 32;
  }

  async set(key: string, value: string, options?: SecretOption): Promise<void> {
    if (!this.isEnabled()) throw new Error("Secrets 插件未启用");
    const env = options?.env ?? "global";
    const encrypted = encrypt(value, this.config.masterKey);
    const now = new Date().toISOString();
    const mapKey = `${key}:${env}`;
    const existing = this.secrets.get(mapKey);

    this.secrets.set(mapKey, {
      id: existing?.id ?? crypto.randomUUID(),
      key,
      value: encrypted,
      env,
      // 显式传入 description 时覆盖，否则保留旧值（不传时不清空）
      description: options?.description !== undefined
        ? options.description
        : (existing?.description ?? ""),
      created: existing?.created ?? now,
      updated: now,
    });
  }

  async get(key: string, env?: string): Promise<string> {
    if (!this.isEnabled()) throw new Error("Secrets 插件未启用");
    const targetEnv = env ?? "global";
    const secret = this.secrets.get(`${key}:${targetEnv}`)
      ?? (targetEnv !== "global" ? this.secrets.get(`${key}:global`) : undefined);

    if (!secret) throw new Error(`secret "${key}" not found`);
    return decrypt(secret.value, this.config.masterKey);
  }

  async getWithDefault(key: string, defaultValue: string): Promise<string> {
    try {
      return await this.get(key);
    } catch {
      return defaultValue;
    }
  }

  async delete(key: string, env?: string): Promise<void> {
    const targetEnv = env ?? "global";
    this.secrets.delete(`${key}:${targetEnv}`);
  }

  async exists(key: string, env?: string): Promise<boolean> {
    const targetEnv = env ?? "global";
    return this.secrets.has(`${key}:${targetEnv}`);
  }

  async list(env?: string): Promise<Secret[]> {
    return Array.from(this.secrets.values())
      .filter((s) => !env || s.env === env)
      .map((s) => ({ ...s })); // 返回副本，防止外部修改内部状态
  }

  /** 列出所有 key 名称（去重，跨 env） */
  async keys(): Promise<string[]> {
    const seen = new Set<string>();
    for (const s of this.secrets.values()) {
      seen.add(s.key);
    }
    return Array.from(seen).sort();
  }
}

// ─── DBSecretsStore（数据库持久化版）────────────────────────────────────────

import type { DBAdapter } from "../../core/db_adapter";
import { DateTime } from "../../tools/types/datetime";

/**
 * 数据库持久化版 SecretsStore。
 * 所有密钥读写均持久化到 _secrets 表，密文使用 AES-256-GCM 加密。
 * 对照 Go 版 secrets_store.go DBSecretsStore。
 */
export class DBSecretsStore implements SecretsStore {
  private readonly db: DBAdapter;
  private readonly config: SecretsConfig;

  constructor(config: SecretsConfig, db: DBAdapter) {
    this.config = config;
    this.db = db;
  }

  isEnabled(): boolean {
    return this.config.enabled && this.config.masterKey.length === 32;
  }

  async set(key: string, value: string, options?: SecretOption): Promise<void> {
    if (!this.isEnabled()) throw new Error("Secrets 插件未启用");
    const env = options?.env ?? "global";
    const encrypted = encrypt(value, this.config.masterKey);
    const now = DateTime.now().toSQLite();

    // 查是否已存在（保留 id 和 created）
    const existing = this.db.queryOne<{ id: string; created: string; description: string }>(
      `SELECT id, created, description FROM _secrets WHERE key = ? AND env = ?`, key, env,
    );

    const id = existing?.id ?? crypto.randomUUID();
    const created = existing?.created ?? now;
    const description = options?.description !== undefined
      ? options.description
      : (existing?.description ?? "");

    this.db.exec(
      `INSERT OR REPLACE INTO _secrets (id, key, value, env, description, created, updated)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      id, key, encrypted, env, description, created, now,
    );
  }

  async get(key: string, env?: string): Promise<string> {
    if (!this.isEnabled()) throw new Error("Secrets 插件未启用");
    const targetEnv = env ?? "global";

    // 先查指定 env
    let row = this.db.queryOne<{ value: string }>(
      `SELECT value FROM _secrets WHERE key = ? AND env = ?`, key, targetEnv,
    );

    // 回退到 global
    if (!row && targetEnv !== "global") {
      row = this.db.queryOne<{ value: string }>(
        `SELECT value FROM _secrets WHERE key = ? AND env = 'global'`, key,
      );
    }

    if (!row) throw new Error(`secret "${key}" not found`);
    return decrypt(row.value, this.config.masterKey);
  }

  async getWithDefault(key: string, defaultValue: string): Promise<string> {
    try { return await this.get(key); } catch { return defaultValue; }
  }

  async delete(key: string, env?: string): Promise<void> {
    const targetEnv = env ?? "global";
    this.db.exec(`DELETE FROM _secrets WHERE key = ? AND env = ?`, key, targetEnv);
  }

  async exists(key: string, env?: string): Promise<boolean> {
    const targetEnv = env ?? "global";
    const row = this.db.queryOne<{ id: string }>(
      `SELECT id FROM _secrets WHERE key = ? AND env = ?`, key, targetEnv,
    );
    return row !== null;
  }

  async list(env?: string): Promise<Secret[]> {
    const rows = env
      ? this.db.query<Record<string, unknown>>(`SELECT * FROM _secrets WHERE env = ? ORDER BY key ASC`, env)
      : this.db.query<Record<string, unknown>>(`SELECT * FROM _secrets ORDER BY key ASC`);
    return rows.map((r) => ({
      id: r.id as string,
      key: r.key as string,
      value: r.value as string, // 仍是密文，调用方勿直接用
      env: r.env as string,
      description: (r.description as string) ?? "",
      created: (r.created as string) ?? "",
      updated: (r.updated as string) ?? "",
    }));
  }

  async keys(): Promise<string[]> {
    const rows = this.db.query<{ key: string }>(
      `SELECT DISTINCT key FROM _secrets ORDER BY key ASC`,
    );
    return rows.map((r) => r.key);
  }
}

// ─── MustRegister ────────────────────────────────────────────────────────────

/** 注册入口
 * - db 注入 → DBSecretsStore（持久化版）
 * - 无 db   → MemorySecretsStore（内存版）
 */
export function MustRegister(
  _app: unknown,
  config: SecretsConfig = defaultConfig(),
  db?: DBAdapter,
): SecretsStore {
  const resolved = applyEnvOverrides(config);
  if (db) return new DBSecretsStore(resolved, db);
  return new MemorySecretsStore(resolved);
}
