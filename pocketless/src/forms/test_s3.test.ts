/**
 * S3 测试表单测试
 * 对照 Go 版 forms/test_s3_filesystem_test.go
 * T200
 */

import { describe, test, expect } from "bun:test";
import { validateTestS3Form } from "./test_s3";

describe("validateTestS3Form", () => {
  test("storage 通过", () => {
    const result = validateTestS3Form({ filesystem: "storage" });
    expect(result.valid).toBe(true);
  });

  test("backups 通过", () => {
    const result = validateTestS3Form({ filesystem: "backups" });
    expect(result.valid).toBe(true);
  });

  test("缺少 filesystem", () => {
    const result = validateTestS3Form({});
    expect(result.valid).toBe(false);
    expect(result.errors!.filesystem.code).toBe("validation_required");
  });

  test("无效 filesystem 值", () => {
    const result = validateTestS3Form({ filesystem: "invalid" as any });
    expect(result.valid).toBe(false);
    expect(result.errors!.filesystem.code).toBe("validation_in_invalid");
  });

  test("空字符串失败", () => {
    const result = validateTestS3Form({ filesystem: "" as any });
    expect(result.valid).toBe(false);
  });
});
