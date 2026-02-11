/**
 * Field 接口 + 全局注册表
 * 与 Go 版 core/field.go 对齐
 */

import type { RecordModel } from "./record_model";
import type { CollectionModel } from "./collection_model";

export interface Field {
  id: string;
  name: string;
  type: string;
  system: boolean;
  hidden: boolean;
  required: boolean;

  /** 数据库列类型 (SQLite) */
  columnType(isPostgres?: boolean): string;

  /** 将原始值转为字段期望类型 */
  prepareValue(raw: unknown): unknown;

  /** 验证字段值 */
  validateValue(value: unknown, record: RecordModel): string | null;

  /** 验证字段配置 */
  validateSettings(collection: CollectionModel): string | null;

  /** 是否为多值字段 */
  isMultiple?(): boolean;

  /** 导出为数据库值 */
  driverValue?(value: unknown): unknown;
}

/** 字段工厂函数类型 */
export type FieldFactory = (options: Record<string, unknown>) => Field;

/** 全局字段注册表 */
const fieldRegistry = new Map<string, FieldFactory>();

/** 注册字段类型 */
export function registerField(type: string, factory: FieldFactory): void {
  fieldRegistry.set(type, factory);
}

/** 创建字段实例 */
export function createField(type: string, options: Record<string, unknown> = {}): Field | null {
  const factory = fieldRegistry.get(type);
  if (!factory) return null;
  return factory(options);
}

/** 获取所有已注册字段类型 */
export function getRegisteredFieldTypes(): string[] {
  return [...fieldRegistry.keys()];
}

/** 从 CollectionField 配置创建 Field 实例 */
export function createFieldFromConfig(config: {
  id: string;
  name: string;
  type: string;
  required: boolean;
  options: Record<string, unknown>;
}): Field | null {
  const field = createField(config.type, {
    ...config.options,
    id: config.id,
    name: config.name,
    required: config.required,
  });
  return field;
}
