/**
 * Settings 模型 — 与 Go 版 core/settings_model.go 对齐
 *
 * 功能:
 * - 9 个子配置：SMTP, S3, Backups, Meta, RateLimits, TrustedProxy, Batch, Logs, Analytics
 * - 序列化/反序列化（JSON）
 * - 敏感字段掩码
 * - DBExport（支持加密）
 * - loadFromParam（支持解密）
 * - Merge / Clone
 */

import { encrypt, decrypt } from "../tools/security/crypto";

export const PARAMS_TABLE = "_params";
export const PARAMS_KEY_SETTINGS = "settings";

// ============================================================
// 子配置类型
// ============================================================

export interface SMTPConfig {
  enabled: boolean;
  port: number;
  host: string;
  username: string;
  password: string;
  authMethod: string;
  tls: boolean;
  localName: string;
}

export interface S3Config {
  enabled: boolean;
  bucket: string;
  region: string;
  endpoint: string;
  accessKey: string;
  secret: string;
  forcePathStyle: boolean;
}

export interface BatchConfig {
  enabled: boolean;
  maxRequests: number;
  timeout: number;
  maxBodySize: number;
}

export interface BackupsConfig {
  cron: string;
  cronMaxKeep: number;
  s3: S3Config;
}

export interface MetaConfig {
  appName: string;
  appURL: string;
  senderName: string;
  senderAddress: string;
  hideControls: boolean;
}

export interface LogsConfig {
  maxDays: number;
  minLevel: number;
  logIP: boolean;
  logAuthId: boolean;
}

export interface AnalyticsSettingsConfig {
  enabled: boolean;
  retention: number;
  s3Bucket: string;
}

export interface TrustedProxyConfig {
  headers: string[];
  useLeftmostIP: boolean;
}

export interface RateLimitRule {
  label: string;
  audience: string;
  duration: number;
  maxRequests: number;
}

export interface RateLimitsConfig {
  enabled: boolean;
  rules: RateLimitRule[];
}

// ============================================================
// Settings 内部数据结构（与 Go 版 settings struct 对齐）
// ============================================================

interface SettingsData {
  smtp: SMTPConfig;
  backups: BackupsConfig;
  s3: S3Config;
  meta: MetaConfig;
  rateLimits: RateLimitsConfig;
  trustedProxy: TrustedProxyConfig;
  batch: BatchConfig;
  logs: LogsConfig;
  analytics: AnalyticsSettingsConfig;
}

// ============================================================
// Settings 类
// ============================================================

export class Settings {
  // 公开子配置（与 Go 版访问模式对齐）
  smtp: SMTPConfig;
  backups: BackupsConfig;
  s3: S3Config;
  meta: MetaConfig;
  rateLimits: RateLimitsConfig;
  trustedProxy: TrustedProxyConfig;
  batch: BatchConfig;
  logs: LogsConfig;
  analytics: AnalyticsSettingsConfig;

  isNew: boolean;

  constructor(data: SettingsData, isNew: boolean = true) {
    this.smtp = data.smtp;
    this.backups = data.backups;
    this.s3 = data.s3;
    this.meta = data.meta;
    this.rateLimits = data.rateLimits;
    this.trustedProxy = data.trustedProxy;
    this.batch = data.batch;
    this.logs = data.logs;
    this.analytics = data.analytics;
    this.isNew = isNew;
  }

  tableName(): string {
    return PARAMS_TABLE;
  }

  pk(): string {
    return PARAMS_KEY_SETTINGS;
  }

  lastSavedPK(): string {
    return PARAMS_KEY_SETTINGS;
  }

  markAsNew(): void {
    this.isNew = true;
  }

  markAsNotNew(): void {
    this.isNew = false;
  }

  postScan(): void {
    this.markAsNotNew();
  }

  /** 返回去敏后的 JSON 对象 */
  toJSON(): SettingsData {
    const copy = this._cloneData();
    // 掩码敏感字段
    if (copy.smtp.password) copy.smtp.password = "";
    if (copy.s3.secret) copy.s3.secret = "";
    if (copy.backups.s3.secret) copy.backups.s3.secret = "";
    return copy;
  }

  toString(): string {
    return JSON.stringify(this.toJSON());
  }

  /** 合并另一个 Settings */
  merge(other: Settings): void {
    const data = JSON.parse(JSON.stringify(other._getData())) as SettingsData;
    this.smtp = data.smtp;
    this.backups = data.backups;
    this.s3 = data.s3;
    this.meta = data.meta;
    this.rateLimits = data.rateLimits;
    this.trustedProxy = data.trustedProxy;
    this.batch = data.batch;
    this.logs = data.logs;
    this.analytics = data.analytics;
  }

  /** 深拷贝 */
  clone(): Settings {
    const s = new Settings(this._cloneData(), this.isNew);
    return s;
  }

  /** 导出为数据库持久化格式 */
  dbExport(encryptionKey?: string): Record<string, unknown> {
    const now = new Date().toISOString();
    const result: Record<string, unknown> = {
      id: this.pk(),
    };

    if (this.isNew) {
      result.created = now;
    }
    result.updated = now;

    const encoded = JSON.stringify(this._getData());

    if (encryptionKey) {
      result.value = encrypt(encoded, encryptionKey);
    } else {
      result.value = encoded;
    }

    return result;
  }

  /** 从 _params 表的 value 字段加载 */
  loadFromParam(value: string, encryptionKey?: string): void {
    let jsonStr: string;

    // 先尝试直接解析
    try {
      JSON.parse(value);
      jsonStr = value;
    } catch {
      // 解析失败，尝试解密
      if (!encryptionKey) {
        throw new Error("无法解析 settings value，且未提供加密密钥");
      }
      jsonStr = decrypt(value, encryptionKey);
    }

    const data = JSON.parse(jsonStr) as SettingsData;
    this.smtp = data.smtp;
    this.backups = data.backups;
    this.s3 = data.s3;
    this.meta = data.meta;
    this.rateLimits = data.rateLimits;
    this.trustedProxy = data.trustedProxy;
    this.batch = data.batch;
    this.logs = data.logs;
    this.analytics = data.analytics;
  }

  private _getData(): SettingsData {
    return {
      smtp: this.smtp,
      backups: this.backups,
      s3: this.s3,
      meta: this.meta,
      rateLimits: this.rateLimits,
      trustedProxy: this.trustedProxy,
      batch: this.batch,
      logs: this.logs,
      analytics: this.analytics,
    };
  }

  private _cloneData(): SettingsData {
    return JSON.parse(JSON.stringify(this._getData()));
  }
}

// ============================================================
// 默认 Settings 工厂
// ============================================================

export function newDefaultSettings(): Settings {
  return new Settings({
    meta: {
      appName: "Acme",
      appURL: "http://localhost:8090",
      hideControls: false,
      senderName: "Support",
      senderAddress: "support@example.com",
    },
    logs: {
      maxDays: 5,
      minLevel: 0,
      logIP: true,
      logAuthId: false,
    },
    smtp: {
      enabled: false,
      host: "smtp.example.com",
      port: 587,
      username: "",
      password: "",
      authMethod: "",
      tls: false,
      localName: "",
    },
    backups: {
      cron: "",
      cronMaxKeep: 3,
      s3: {
        enabled: false,
        bucket: "",
        region: "",
        endpoint: "",
        accessKey: "",
        secret: "",
        forcePathStyle: false,
      },
    },
    s3: {
      enabled: false,
      bucket: "",
      region: "",
      endpoint: "",
      accessKey: "",
      secret: "",
      forcePathStyle: false,
    },
    batch: {
      enabled: false,
      maxRequests: 50,
      timeout: 3,
      maxBodySize: 0,
    },
    analytics: {
      enabled: true,
      retention: 90,
      s3Bucket: "",
    },
    rateLimits: {
      enabled: false,
      rules: [
        { label: "*:auth", audience: "", maxRequests: 2, duration: 3 },
        { label: "*:create", audience: "", maxRequests: 20, duration: 5 },
        { label: "/api/batch", audience: "", maxRequests: 3, duration: 1 },
        { label: "/api/", audience: "", maxRequests: 300, duration: 10 },
      ],
    },
    trustedProxy: {
      headers: [],
      useLeftmostIP: false,
    },
  });
}
