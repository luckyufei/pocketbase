/**
 * EmailField — 邮箱字段
 * 与 Go 版 core/field_email.go 对齐
 */

import { registerField, type Field } from "./field";
import type { RecordModel } from "./record_model";
import type { CollectionModel } from "./collection_model";

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

export class EmailField implements Field {
  id: string;
  name: string;
  type = "email";
  system: boolean;
  hidden: boolean;
  required: boolean;
  exceptDomains: string[];
  onlyDomains: string[];

  constructor(options: Record<string, unknown> = {}) {
    this.id = (options.id as string) || "";
    this.name = (options.name as string) || "";
    this.system = !!(options.system);
    this.hidden = !!(options.hidden);
    this.required = !!(options.required);
    this.exceptDomains = (options.exceptDomains as string[]) || [];
    this.onlyDomains = (options.onlyDomains as string[]) || [];
  }

  columnType(_isPostgres?: boolean): string {
    return "TEXT DEFAULT '' NOT NULL";
  }

  prepareValue(raw: unknown): string {
    if (raw === null || raw === undefined) return "";
    return String(raw);
  }

  validateValue(value: unknown, _record: RecordModel): string | null {
    const v = typeof value === "string" ? value : String(value ?? "");
    if (!v && this.required) return "不能为空";
    if (!v) return null;
    if (!EMAIL_REGEX.test(v)) return "无效的邮箱格式";
    const domain = v.split("@")[1]?.toLowerCase() || "";
    if (this.onlyDomains.length > 0) {
      if (!this.onlyDomains.some((d) => d.toLowerCase() === domain)) {
        return `域名不在允许列表中`;
      }
    }
    if (this.exceptDomains.length > 0) {
      if (this.exceptDomains.some((d) => d.toLowerCase() === domain)) {
        return `域名在禁止列表中`;
      }
    }
    return null;
  }

  validateSettings(_collection: CollectionModel): string | null {
    if (this.onlyDomains.length > 0 && this.exceptDomains.length > 0) {
      return "onlyDomains 和 exceptDomains 不能同时使用";
    }
    return null;
  }
}

registerField("email", (opts) => new EmailField(opts));
