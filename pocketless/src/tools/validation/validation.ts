/**
 * Zod 验证工具 — 通用验证器
 * 与 Go 版 validation 包对齐
 */

import { z } from "zod";

// ─── 基础验证器 ───

/** 必填字符串 */
export const requiredString = z.string().min(1, "不能为空");

/** 邮箱验证 */
export const email = z.string().email("无效的邮箱格式");

/** URL 验证 */
export const url = z.string().url("无效的 URL 格式");

/** 最小长度 */
export const minLength = (min: number) => z.string().min(min, `长度不能少于 ${min} 个字符`);

/** 最大长度 */
export const maxLength = (max: number) => z.string().max(max, `长度不能超过 ${max} 个字符`);

/** 数值范围 */
export const numberRange = (min?: number, max?: number) => {
  let schema = z.number();
  if (min !== undefined) schema = schema.min(min, `不能小于 ${min}`);
  if (max !== undefined) schema = schema.max(max, `不能大于 ${max}`);
  return schema;
};

/** 15 字符 ID 格式 */
export const recordId = z.string().regex(/^[a-z0-9]{15}$/, "无效的记录 ID 格式");

/** Collection 名称（字母开头，只含字母数字和下划线） */
export const collectionName = z
  .string()
  .min(1)
  .max(255)
  .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, "集合名称只能包含字母、数字和下划线，且必须以字母或下划线开头");

// ─── 错误格式化 ───

export interface ValidationError {
  code: string;
  message: string;
}

/** 将 Zod 错误转换为 PocketBase 格式 */
export function formatZodError(error: z.ZodError): Record<string, ValidationError> {
  const result: Record<string, ValidationError> = {};
  for (const issue of error.issues) {
    const field = issue.path.join(".");
    result[field] = {
      code: "validation_" + issue.code,
      message: issue.message,
    };
  }
  return result;
}

/** 验证并返回错误（如有） */
export function validate<T>(schema: z.ZodType<T>, data: unknown): { data?: T; errors?: Record<string, ValidationError> } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { data: result.data };
  }
  return { errors: formatZodError(result.error) };
}
