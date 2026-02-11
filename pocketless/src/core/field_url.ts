/**
 * URLField — URL 字段
 * 与 Go 版 core/field_url.go 对齐
 */

import { registerField, type Field } from "./field";
import type { RecordModel } from "./record_model";
import type { CollectionModel } from "./collection_model";

export class URLField implements Field {
  id: string;
  name: string;
  type = "url";
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
    try {
      const url = new URL(v);
      if (!url.protocol.startsWith("http")) return "仅支持 http/https 协议";
      const host = url.hostname.toLowerCase();
      if (this.onlyDomains.length > 0) {
        if (!this.onlyDomains.some((d) => d.toLowerCase() === host)) {
          return `域名不在允许列表中`;
        }
      }
      if (this.exceptDomains.length > 0) {
        if (this.exceptDomains.some((d) => d.toLowerCase() === host)) {
          return `域名在禁止列表中`;
        }
      }
    } catch {
      return "无效的 URL 格式";
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

registerField("url", (opts) => new URLField(opts));
