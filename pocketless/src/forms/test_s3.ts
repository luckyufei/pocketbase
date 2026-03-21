/**
 * test_s3.ts — S3 测试表单
 * 与 Go 版 forms/test_s3_filesystem.go 对齐
 */

export interface TestS3Form {
  filesystem: "storage" | "backups";
}

export function validateTestS3Form(form: Partial<TestS3Form>): {
  valid: boolean;
  errors?: Record<string, { code: string; message: string }>;
} {
  if (!form.filesystem) {
    return {
      valid: false,
      errors: {
        filesystem: {
          code: "validation_required",
          message: "Cannot be blank.",
        },
      },
    };
  }

  if (form.filesystem !== "storage" && form.filesystem !== "backups") {
    return {
      valid: false,
      errors: {
        filesystem: {
          code: "validation_in_invalid",
          message: "Must be a valid value.",
        },
      },
    };
  }

  return { valid: true };
}
