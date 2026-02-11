/**
 * Filesystem 工具测试 — 路径生成、文件名规范化
 * 对照 Go 版 tools/filesystem/filesystem_test.go
 * T196
 */

import { describe, test, expect } from "bun:test";
import { normalizeFilename, recordFilePath, thumbFilePath } from "./filesystem";

describe("normalizeFilename", () => {
  test("普通文件名", () => {
    const result = normalizeFilename("hello.txt");
    expect(result).toMatch(/^hello_[a-zA-Z0-9]{10}\.txt$/);
  });

  test("含空格和特殊字符", () => {
    const result = normalizeFilename("My File (1).jpg");
    expect(result).toMatch(/^my_file_1_[a-zA-Z0-9]{10}\.jpg$/);
  });

  test("大写转小写", () => {
    const result = normalizeFilename("CamelCase.png");
    expect(result).toMatch(/^camelcase_[a-zA-Z0-9]{10}\.png$/);
  });

  test("无扩展名", () => {
    const result = normalizeFilename("noext");
    expect(result).toMatch(/^noext_[a-zA-Z0-9]{10}$/);
  });

  test("双扩展名", () => {
    const result = normalizeFilename("archive.tar.gz");
    expect(result).toMatch(/^archive_[a-zA-Z0-9]{10}\.tar\.gz$/);
  });

  test("中文文件名", () => {
    const result = normalizeFilename("文档.pdf");
    // 中文被替换为下划线，清理后可能变为空，fallback 到 "file"
    expect(result).toMatch(/_[a-zA-Z0-9]{10}\.pdf$/);
  });

  test("空基础名 fallback 到 file", () => {
    const result = normalizeFilename(".gitignore");
    // baseName 为空（.gitignore 的 baseName 是 ""），fallback "file"
    expect(result).toMatch(/^file_[a-zA-Z0-9]{10}\.gitignore$/);
  });

  test("每次生成不同结果（随机后缀）", () => {
    const r1 = normalizeFilename("test.txt");
    const r2 = normalizeFilename("test.txt");
    expect(r1).not.toBe(r2);
  });

  test("很长的文件名被截断", () => {
    const longName = "a".repeat(200) + ".txt";
    const result = normalizeFilename(longName);
    // baseName 截断到 100
    const parts = result.split("_");
    // 第一部分 ≤ 100 字符
    expect(parts[0].length).toBeLessThanOrEqual(100);
  });
});

describe("recordFilePath", () => {
  test("标准路径", () => {
    expect(recordFilePath("col1", "rec1", "file.txt")).toBe("col1/rec1/file.txt");
  });

  test("15 字符 ID", () => {
    expect(recordFilePath("abc123def456ghi", "xyz789abc123def", "photo.jpg"))
      .toBe("abc123def456ghi/xyz789abc123def/photo.jpg");
  });
});

describe("thumbFilePath", () => {
  test("标准缩略图路径", () => {
    expect(thumbFilePath("col1", "rec1", "photo.jpg", "100x100"))
      .toBe("col1/rec1/thumbs_photo.jpg/100x100_photo.jpg");
  });

  test("不同尺寸", () => {
    expect(thumbFilePath("c", "r", "img.png", "200x200"))
      .toBe("c/r/thumbs_img.png/200x200_img.png");
  });
});
