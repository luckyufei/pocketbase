/**
 * NumberField — 数字字段
 * 与 Go 版 core/field_number.go 对齐
 */

import { registerField, type Field } from "./field";
import type { RecordModel } from "./record_model";
import type { CollectionModel } from "./collection_model";

export class NumberField implements Field {
  id: string;
  name: string;
  type = "number";
  system: boolean;
  hidden: boolean;
  required: boolean;
  min: number | null;
  max: number | null;
  onlyInt: boolean;

  constructor(options: Record<string, unknown> = {}) {
    this.id = (options.id as string) || "";
    this.name = (options.name as string) || "";
    this.system = !!(options.system);
    this.hidden = !!(options.hidden);
    this.required = !!(options.required);
    this.min = options.min !== undefined && options.min !== null ? Number(options.min) : null;
    this.max = options.max !== undefined && options.max !== null ? Number(options.max) : null;
    this.onlyInt = !!(options.onlyInt);
  }

  columnType(isPostgres?: boolean): string {
    if (isPostgres) return "DOUBLE PRECISION DEFAULT 0 NOT NULL";
    return "NUMERIC DEFAULT 0 NOT NULL";
  }

  prepareValue(raw: unknown): number {
    if (raw === null || raw === undefined) return 0;
    const n = Number(raw);
    return isNaN(n) ? 0 : n;
  }

  validateValue(value: unknown, _record: RecordModel): string | null {
    const v = typeof value === "number" ? value : Number(value ?? 0);
    if (!isFinite(v)) return "值必须是有限数字";
    if (v === 0 && this.required) return "不能为空";
    if (this.onlyInt && v !== Math.trunc(v)) return "必须是整数";
    if (this.min !== null && v < this.min) return `最小值为 ${this.min}`;
    if (this.max !== null && v > this.max) return `最大值为 ${this.max}`;
    return null;
  }

  validateSettings(_collection: CollectionModel): string | null {
    if (this.onlyInt) {
      if (this.min !== null && this.min !== Math.trunc(this.min)) return "onlyInt 模式下 min 必须是整数";
      if (this.max !== null && this.max !== Math.trunc(this.max)) return "onlyInt 模式下 max 必须是整数";
    }
    if (this.min !== null && this.max !== null && this.min > this.max) return "min 不能大于 max";
    return null;
  }
}

registerField("number", (opts) => new NumberField(opts));
