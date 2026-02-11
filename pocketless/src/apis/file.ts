/**
 * File API 端点
 * 与 Go 版 apis/file.go 对齐
 *
 * POST /api/files/token        → 生成文件访问令牌
 * GET  /api/files/:col/:id/:fn → 下载文件（支持缩略图）
 */

import type { Hono } from "hono";
import type { BaseApp } from "../core/base";
import type { Filesystem } from "../tools/filesystem/filesystem";
import { recordFilePath, thumbFilePath } from "../tools/filesystem/filesystem";
import { createThumb, isImageFilename } from "../tools/filesystem/thumb";

export function registerFileRoutes(
  app: Hono,
  baseApp: BaseApp,
  fsys: Filesystem,
): void {
  // POST /api/files/token — 生成文件令牌
  app.post("/api/files/token", async (c) => {
    // 需要认证
    const auth = c.get("auth") as any;
    if (!auth) {
      return c.json(
        { status: 401, message: "Missing or invalid authentication.", data: {} },
        401,
      );
    }

    // 生成短期 file token (与 Go 版兼容)
    const { signToken } = await import("../tools/security/jwt");
    const token = await signToken(
      { id: auth.id, type: "file", collectionId: auth.collectionId || "" },
      auth.tokenKey || "default-key",
      180, // 3 分钟
    );

    // 触发 onFileTokenRequest hook
    const collection = auth.collection || null;
    const record = auth;
    await baseApp.onFileTokenRequest().trigger({
      app: baseApp,
      httpContext: c,
      token,
      record,
      collection,
      next: async () => {},
    });

    return c.json({ token });
  });

  // GET /api/files/:collection/:recordId/:filename — 下载文件
  app.get("/api/files/:collection/:recordId/:filename", async (c) => {
    const collectionParam = c.req.param("collection");
    const recordId = c.req.param("recordId");
    const filename = c.req.param("filename");

    // 查找 collection
    const collection = await baseApp.findCollectionByNameOrId(collectionParam);
    if (!collection) {
      return c.json(
        { status: 404, message: "Collection not found.", data: {} },
        404,
      );
    }

    // 构建文件路径
    const fileKey = recordFilePath(collection.id, recordId, filename);

    // 检查文件是否存在
    if (!(await fsys.exists(fileKey))) {
      return c.json(
        { status: 404, message: "File not found.", data: {} },
        404,
      );
    }

    // 触发 onFileDownloadRequest hook
    await baseApp.onFileDownloadRequest().trigger({
      app: baseApp,
      httpContext: c,
      record: { id: recordId } as any,
      collection: collection as any,
      fileField: null,
      servedPath: fileKey,
      servedName: filename,
      next: async () => {},
    });

    // 缩略图处理
    const thumbSize = c.req.query("thumb");
    if (thumbSize && isImageFilename(filename)) {
      const thumbKey = thumbFilePath(
        collection.id,
        recordId,
        filename,
        thumbSize,
      );

      // 检查缩略图是否已存在
      if (await fsys.exists(thumbKey)) {
        return fsys.serve(thumbKey, filename);
      }

      // 生成缩略图
      try {
        const original = await fsys.download(fileKey);
        const thumbData = await createThumb(original, thumbSize);
        await fsys.upload(thumbData, thumbKey);
        return fsys.serve(thumbKey, filename);
      } catch {
        // 缩略图生成失败，返回原始文件
      }
    }

    // 返回原始文件
    return fsys.serve(fileKey, filename);
  });
}
