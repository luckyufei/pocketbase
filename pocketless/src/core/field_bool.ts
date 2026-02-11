/**
 * BoolField — 布尔字段
 * 与 Go 版 core/field_bool.go 对齐
 */

import { registerField, type Field } from "./field";
import type { RecordModel } from "./record_model";
import type { CollectionModel } from "./collection_model";

export class BoolField implements Field {
  id: string;
  name: string;
  type = "bool";
  system: boolean;
  hidden: boolean;
  required: boolean;

  constructor(options: Record<string, unknown> = {}) {
    this.id = (options.id as string) || "";
    this.name = (options.name as string) || "";
    this.system = !!(options.system);
    this.hidden = !!(options.hidden);
    this.required = !!(options.required);
  }

  columnType(_isPostgres?: boolean): string {
    return "BOOLEAN DEFAULT FALSE NOT NULL";
  }

  prepareValue(raw: unknown): boolean {
    if (typeof raw === "boolean") return raw;
    if (typeof raw === "number") return raw !== 0;
    if (typeof raw === "string") {
      // 对齐 Go strconv.ParseBool 行为
      const lower = raw.toLowerCase();
      return lower === "true" || lower === "1" || lower === "t" || lower === "yes";
    }
    return !!raw;
  }

  validateValue(value: unknown, _record: RecordModel): string | null {
    const v = !!value;
    if (this.required && !v) return "必须为 true";
    return null;
  }

  validateSettings(_collection: CollectionModel): string | null {
    return null;
  }
}

registerField("bool", (opts) => new BoolField(opts));
