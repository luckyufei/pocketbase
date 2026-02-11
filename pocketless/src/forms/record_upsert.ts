/**
 * record_upsert.ts — Record Upsert 表单
 * 与 Go 版 forms/record_upsert.go 对齐
 * 用于 Batch API 中的 Create/Update 操作
 */

import type { RecordModel } from "../core/record_model";

export interface RecordUpsertForm {
  record: RecordModel;
  password?: string;
  passwordConfirm?: string;
  oldPassword?: string;
}

export function validateRecordUpsertForm(form: RecordUpsertForm): {
  valid: boolean;
  errors?: Record<string, { code: string; message: string }>;
} {
  const errors: Record<string, { code: string; message: string }> = {};

  // 密码确认
  if (form.password && form.password !== form.passwordConfirm) {
    errors.passwordConfirm = {
      code: "validation_values_mismatch",
      message: "Values don't match.",
    };
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }

  return { valid: true };
}
