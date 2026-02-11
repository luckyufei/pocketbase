/**
 * PasswordField — 密码字段
 * 与 Go 版 core/field_password.go 对齐
 * 存储 bcrypt 哈希，明文不持久化
 */

import { registerField, type Field } from "./field";
import type { RecordModel } from "./record_model";
import type { CollectionModel } from "./collection_model";

const DEFAULT_COST = 12;
const DEFAULT_MAX = 71; // bcrypt 最大输入长度

export interface PasswordFieldValue {
  hash: string;
  plain: string;
  lastError?: Error;
}

export class PasswordField implements Field {
  id: string;
  name: string;
  type = "password";
  system: boolean;
  hidden: boolean;
  required: boolean;
  min: number;
  max: number;
  cost: number;
  pattern: string;

  constructor(options: Record<string, unknown> = {}) {
    this.id = (options.id as string) || "";
    this.name = (options.name as string) || "";
    this.system = !!(options.system);
    this.hidden = !!(options.hidden ?? true);
    this.required = !!(options.required);
    this.min = (options.min as number) || 0;
    this.max = (options.max as number) || 0;
    this.cost = (options.cost as number) || DEFAULT_COST;
    this.pattern = (options.pattern as string) || "";
  }

  columnType(_isPostgres?: boolean): string {
    return "TEXT DEFAULT '' NOT NULL";
  }

  prepareValue(raw: unknown): PasswordFieldValue {
    if (raw !== null && typeof raw === "object" && "hash" in (raw as object)) {
      return raw as PasswordFieldValue;
    }
    return { hash: String(raw ?? ""), plain: "" };
  }

  validateValue(value: unknown, _record: RecordModel): string | null {
    const pfv = value as PasswordFieldValue | null;
    if (!pfv) {
      if (this.required) return "不能为空";
      return null;
    }
    if (pfv.lastError) return pfv.lastError.message;
    if (!pfv.hash && this.required) return "不能为空";
    if (!pfv.plain) return null;
    const runes = [...pfv.plain];
    const effectiveMax = this.max || DEFAULT_MAX;
    if (this.min > 0 && runes.length < this.min) return `最少 ${this.min} 个字符`;
    if (runes.length > effectiveMax) return `最多 ${effectiveMax} 个字符`;
    if (this.pattern) {
      try {
        if (!new RegExp(this.pattern).test(pfv.plain)) return `不匹配模式 ${this.pattern}`;
      } catch {
        return "无效的正则模式";
      }
    }
    return null;
  }

  validateSettings(_collection: CollectionModel): string | null {
    if (this.max > 0 && this.min > this.max) return "min 不能大于 max";
    if (this.cost < 4 || this.cost > 31) return "cost 必须在 4-31 之间";
    return null;
  }

  driverValue(value: unknown): string {
    const pfv = value as PasswordFieldValue | null;
    return pfv?.hash || "";
  }
}

registerField("password", (opts) => new PasswordField(opts));
