/**
 * apple_client_secret.ts — Apple Client Secret 生成表单
 * 与 Go 版 forms/apple_client_secret_create.go 对齐
 */

export interface AppleClientSecretForm {
  clientId: string;
  teamId: string;
  keyId: string;
  privateKey: string;
  duration?: number; // 秒，默认 15777000 (6个月)
}

export function validateAppleClientSecretForm(form: Partial<AppleClientSecretForm>): {
  valid: boolean;
  errors?: Record<string, { code: string; message: string }>;
} {
  const errors: Record<string, { code: string; message: string }> = {};

  if (!form.clientId) {
    errors.clientId = { code: "validation_required", message: "Cannot be blank." };
  }
  if (!form.teamId) {
    errors.teamId = { code: "validation_required", message: "Cannot be blank." };
  }
  if (!form.keyId) {
    errors.keyId = { code: "validation_required", message: "Cannot be blank." };
  }
  if (!form.privateKey) {
    errors.privateKey = { code: "validation_required", message: "Cannot be blank." };
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }

  return { valid: true };
}
