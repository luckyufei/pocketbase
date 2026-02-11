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

export interface SecretsStore {
  isEnabled(): boolean;
  set(key: string, value: string, options?: SecretOption): Promise<void>;
  get(key: string, env?: string): Promise<string>;
  getWithDefault(key: string, defaultValue: string): Promise<string>;
  delete(key: string, env?: string): Promise<void>;
  exists(key: string, env?: string): Promise<boolean>;
  list(env?: string): Promise<Secret[]>;
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
      description: options?.description ?? existing?.description ?? "",
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
      .filter((s) => !env || s.env === env);
  }
}

/** 注册入口 */
export function MustRegister(
  _app: unknown,
  config: SecretsConfig = defaultConfig(),
): SecretsStore {
  return new MemorySecretsStore(config);
}
