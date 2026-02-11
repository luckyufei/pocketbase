import { describe, test, expect } from "bun:test";
import { S3Filesystem } from "./s3";
import type { Filesystem } from "./filesystem";

describe("S3Filesystem", () => {
  test("构造函数 — 创建实例", () => {
    const fs = new S3Filesystem({
      bucket: "test-bucket",
      region: "us-east-1",
      accessKeyId: "test-key",
      secretAccessKey: "test-secret",
    });

    expect(fs).toBeDefined();
  });

  test("类型兼容 — 实现 Filesystem 接口", () => {
    const fs: Filesystem = new S3Filesystem({
      bucket: "test-bucket",
      region: "us-east-1",
      endpoint: "http://localhost:9000",
      accessKeyId: "test-key",
      secretAccessKey: "test-secret",
      forcePathStyle: true,
    });

    // 验证所有方法存在
    expect(typeof fs.exists).toBe("function");
    expect(typeof fs.attributes).toBe("function");
    expect(typeof fs.upload).toBe("function");
    expect(typeof fs.download).toBe("function");
    expect(typeof fs.delete).toBe("function");
    expect(typeof fs.deletePrefix).toBe("function");
    expect(typeof fs.list).toBe("function");
    expect(typeof fs.copy).toBe("function");
    expect(typeof fs.serve).toBe("function");
    expect(typeof fs.close).toBe("function");
  });
});
