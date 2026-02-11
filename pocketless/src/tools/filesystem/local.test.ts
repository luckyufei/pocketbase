import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { LocalFilesystem } from "./local";
import { normalizeFilename, recordFilePath, thumbFilePath } from "./filesystem";

let testDir: string;
let fs: LocalFilesystem;

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), "pocketless-fs-"));
  fs = new LocalFilesystem(testDir);
});

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true });
});

describe("LocalFilesystem", () => {
  test("upload + exists — 上传后文件存在", async () => {
    await fs.upload("hello world", "test/file.txt");
    expect(await fs.exists("test/file.txt")).toBe(true);
    expect(await fs.exists("test/missing.txt")).toBe(false);
  });

  test("upload + download — 内容一致", async () => {
    const content = "Hello PocketBase!";
    await fs.upload(content, "data/hello.txt");

    const downloaded = await fs.download("data/hello.txt");
    const text = new TextDecoder().decode(downloaded);
    expect(text).toBe(content);
  });

  test("upload Uint8Array — 二进制内容", async () => {
    const data = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // PNG magic
    await fs.upload(data, "images/test.png");

    const downloaded = await fs.download("images/test.png");
    expect(downloaded).toEqual(data);
  });

  test("delete — 删除文件", async () => {
    await fs.upload("temp", "temp/file.txt");
    expect(await fs.exists("temp/file.txt")).toBe(true);

    await fs.delete("temp/file.txt");
    expect(await fs.exists("temp/file.txt")).toBe(false);
  });

  test("delete — 删除不存在的文件不报错", async () => {
    await fs.delete("nonexistent/file.txt"); // 不应抛出
  });

  test("list — 列出前缀下的文件", async () => {
    await fs.upload("a", "col/rec1/file_a.txt");
    await fs.upload("b", "col/rec1/file_b.txt");
    await fs.upload("c", "col/rec2/file_c.txt");

    const files = await fs.list("col/rec1");
    expect(files.length).toBe(2);
    expect(files).toContain("col/rec1/file_a.txt");
    expect(files).toContain("col/rec1/file_b.txt");
  });

  test("list — 空前缀返回空", async () => {
    const files = await fs.list("nonexistent");
    expect(files.length).toBe(0);
  });

  test("copy — 复制文件", async () => {
    await fs.upload("original", "src/file.txt");
    await fs.copy("src/file.txt", "dst/file.txt");

    expect(await fs.exists("dst/file.txt")).toBe(true);
    const content = new TextDecoder().decode(await fs.download("dst/file.txt"));
    expect(content).toBe("original");
  });

  test("deletePrefix — 删除前缀下所有文件", async () => {
    await fs.upload("a", "prefix/a.txt");
    await fs.upload("b", "prefix/b.txt");
    await fs.upload("c", "other/c.txt");

    await fs.deletePrefix("prefix");

    expect(await fs.exists("prefix/a.txt")).toBe(false);
    expect(await fs.exists("prefix/b.txt")).toBe(false);
    expect(await fs.exists("other/c.txt")).toBe(true);
  });

  test("attributes — 返回文件属性", async () => {
    await fs.upload("test content", "meta/file.txt");
    const attrs = await fs.attributes("meta/file.txt");

    expect(attrs.size).toBe(12); // "test content" is 12 bytes
    expect(attrs.contentType).toBe("text/plain");
    expect(attrs.modTime).toBeInstanceOf(Date);
  });

  test("serve — 返回 Response 对象", async () => {
    await fs.upload("serve me", "serve/file.txt");
    const res = await fs.serve("serve/file.txt", "download.txt");

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/plain");
    expect(res.headers.get("Content-Disposition")).toContain("download.txt");
    expect(res.headers.get("Cache-Control")).toBe("max-age=2592000");

    const text = await res.text();
    expect(text).toBe("serve me");
  });
});

describe("Filesystem Helpers", () => {
  test("normalizeFilename — 生成规范化文件名", () => {
    const result = normalizeFilename("My Photo.jpg");
    expect(result).toMatch(/^my_photo_[a-zA-Z0-9]{10}\.jpg$/);
  });

  test("normalizeFilename — 处理特殊字符", () => {
    const result = normalizeFilename("hello world!@#.png");
    expect(result).toMatch(/^hello_world_[a-zA-Z0-9]{10}\.png$/);
  });

  test("normalizeFilename — 双扩展名", () => {
    const result = normalizeFilename("backup.tar.gz");
    expect(result).toMatch(/^backup_[a-zA-Z0-9]{10}\.tar\.gz$/);
  });

  test("recordFilePath — 生成 Record 文件路径", () => {
    expect(recordFilePath("col1", "rec1", "photo.jpg")).toBe(
      "col1/rec1/photo.jpg",
    );
  });

  test("thumbFilePath — 生成缩略图路径", () => {
    expect(thumbFilePath("col1", "rec1", "photo.jpg", "100x100")).toBe(
      "col1/rec1/thumbs_photo.jpg/100x100_photo.jpg",
    );
  });
});
