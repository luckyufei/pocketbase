/**
 * SecretField — 加密字段
 * 与 Go 版 core/field_secret.go 对齐
 * 使用 AES-256-GCM 可逆加密存储敏感数据
 */

import { registerField, type Field } from "./field";
import type { RecordModel } from "./record_model";
import type { CollectionModel } from "./collection_model";

const DEFAULT_MAX_SIZE = 4096; // 4KB

export interface SecretFieldValue {
  plain: string;
  encrypted: string;
  lastError?: Error;
}

export class SecretField implements Field {
  id: string;
  name: string;
  type = "secret";
  system: boolean;
  hidden: boolean;
  required: boolean;
  maxSize: number;

  constructor(options: Record<string, unknown> = {}) {
    this.id = (options.id as string) || "";
    this.name = (options.name as string) || "";
    this.system = !!(options.system);
    this.hidden = !!(options.hidden ?? true);
    this.required = !!(options.required);
    this.maxSize = (options.maxSize as number) || 0;
  }

  columnType(_isPostgres?: boolean): string {
    return "TEXT DEFAULT '' NOT NULL";
  }

  prepareValue(raw: unknown): SecretFieldValue {
    if (raw !== null && typeof raw === "object" && "encrypted" in (raw as object)) {
      return raw as SecretFieldValue;
    }
    return { plain: "", encrypted: String(raw ?? "") };
  }

  validateValue(value: unknown, _record: RecordModel): string | null {
    const sfv = value as SecretFieldValue | null;
    if (!sfv) {
      if (this.required) return "不能为空";
      return null;
    }
    if (sfv.lastError) return sfv.lastError.message;
    if (!sfv.encrypted && !sfv.plain && this.required) return "不能为空";
    if (!sfv.plain) return null;
    const effectiveMax = this.maxSize || DEFAULT_MAX_SIZE;
    const byteLength = new TextEncoder().encode(sfv.plain).length;
    if (byteLength > effectiveMax) return `内容过大（最大 ${effectiveMax} 字节）`;
    return null;
  }

  validateSettings(_collection: CollectionModel): string | null {
    return null;
  }

  driverValue(value: unknown): string {
    const sfv = value as SecretFieldValue | null;
    return sfv?.encrypted || "";
  }
}

registerField("secret", (opts) => new SecretField(opts));
