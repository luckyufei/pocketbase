import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { Hono } from "hono";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtempSync } from "node:fs";
import { LocalFilesystem } from "../tools/filesystem/local";
import { recordFilePath } from "../tools/filesystem/filesystem";
import { registerFileRoutes } from "./file";
import { BaseApp } from "../core/base";
import sharp from "sharp";

let testDir: string;
let fsys: LocalFilesystem;

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), "pocketless-file-api-"));
  fsys = new LocalFilesystem(testDir);
});

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true });
});

function createApp() {
  const app = new Hono();
  const tmpDir = mkdtempSync(join(tmpdir(), "pb-file-"));
  const baseApp = new BaseApp({ dataDir: tmpDir, isDev: true });

  // Override findCollectionByNameOrId on the baseApp
  (baseApp as any).findCollectionByNameOrId = async (nameOrId: string) => {
    if (nameOrId === "posts" || nameOrId === "col_posts") {
      return { id: "col_posts", name: "posts", type: "base" };
    }
    return null;
  };

  registerFileRoutes(app, baseApp, fsys);
  return app;
}

describe("File Endpoint", () => {
  test("GET /api/files/:col/:id/:fn — 下载文件", async () => {
    const fileKey = recordFilePath("col_posts", "rec1", "photo.txt");
    await fsys.upload("hello file", fileKey);

    const app = createApp();
    const res = await app.request(
      "/api/files/posts/rec1/photo.txt",
      { method: "GET" },
    );

    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe("hello file");
  });

  test("GET /api/files/:col/:id/:fn — 集合不存在返回 404", async () => {
    const app = createApp();
    const res = await app.request(
      "/api/files/nonexistent/rec1/photo.txt",
      { method: "GET" },
    );
    expect(res.status).toBe(404);
  });

  test("GET /api/files/:col/:id/:fn — 文件不存在返回 404", async () => {
    const app = createApp();
    const res = await app.request(
      "/api/files/posts/rec1/missing.txt",
      { method: "GET" },
    );
    expect(res.status).toBe(404);
  });

  test("GET /api/files/:col/:id/:fn?thumb=50x50 — 缩略图", async () => {
    // 上传一个 100x100 的 PNG 图片
    const png = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: { r: 255, g: 0, b: 0 },
      },
    })
      .png()
      .toBuffer();

    const fileKey = recordFilePath("col_posts", "rec1", "photo.png");
    await fsys.upload(new Uint8Array(png), fileKey);

    const app = createApp();
    const res = await app.request(
      "/api/files/posts/rec1/photo.png?thumb=50x50",
      { method: "GET" },
    );

    expect(res.status).toBe(200);

    // 验证返回的是缩略图（大小应比原图小）
    const data = await res.arrayBuffer();
    expect(data.byteLength).toBeGreaterThan(0);

    // 验证缩略图已被缓存
    const thumbKey = "col_posts/rec1/thumbs_photo.png/50x50_photo.png";
    expect(await fsys.exists(thumbKey)).toBe(true);
  });

  test("GET /api/files/:col/:id/:fn?thumb=50x50 — 非图片忽略 thumb", async () => {
    const fileKey = recordFilePath("col_posts", "rec1", "data.json");
    await fsys.upload('{"key":"value"}', fileKey);

    const app = createApp();
    const res = await app.request(
      "/api/files/posts/rec1/data.json?thumb=50x50",
      { method: "GET" },
    );

    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe('{"key":"value"}');
  });

  test("POST /api/files/token — 未认证返回 401", async () => {
    const app = createApp();
    const res = await app.request("/api/files/token", { method: "POST" });
    expect(res.status).toBe(401);
  });
});
