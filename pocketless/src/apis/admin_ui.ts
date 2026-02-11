/**
 * admin_ui.ts — Admin UI 静态文件服务
 * 与 Go 版 apis/serve.go + embed.go 对齐
 *
 * 将 webui/dist/ 内容挂载到 /_/* 路径
 * SPA fallback: 未匹配的路由返回 index.html
 */

import type { Hono } from "hono";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".eot": "application/vnd.ms-fontobject",
  ".webp": "image/webp",
  ".map": "application/json",
  ".txt": "text/plain",
};

/**
 * 注册 Admin UI 静态文件路由
 * @param distDir webui/dist/ 目录的绝对路径
 */
export function registerAdminUIRoutes(app: Hono, distDir: string): void {
  // /_/* 路由 — 服务 Admin UI
  app.get("/_/*", (c) => {
    // 从 URL 中提取路径（移除 /_/ 前缀）
    const urlPath = c.req.path.replace(/^\/_\//, "");
    const filePath = join(distDir, urlPath || "index.html");

    // 尝试服务精确文件
    if (existsSync(filePath) && statSync(filePath).isFile()) {
      return serveFile(c, filePath);
    }

    // SPA fallback — 所有未匹配的路由返回 index.html
    const indexPath = join(distDir, "index.html");
    if (existsSync(indexPath)) {
      return serveFile(c, indexPath);
    }

    return c.json({ status: 404, message: "Admin UI not found.", data: {} }, 404);
  });

  // /_/ 根路由
  app.get("/_/", (c) => {
    const indexPath = join(distDir, "index.html");
    if (existsSync(indexPath)) {
      return serveFile(c, indexPath);
    }
    return c.json({ status: 404, message: "Admin UI not found.", data: {} }, 404);
  });
}

function serveFile(c: any, filePath: string): Response {
  const ext = extname(filePath);
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  const content = readFileSync(filePath);

  // 设置缓存头（静态资源用长缓存，html 不缓存）
  const cacheControl = ext === ".html"
    ? "no-cache, no-store, must-revalidate"
    : "public, max-age=31536000, immutable";

  return new Response(content, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": cacheControl,
    },
  });
}

/**
 * 检查 distDir 是否存在且包含 index.html
 */
export function isAdminUIAvailable(distDir: string): boolean {
  return existsSync(join(distDir, "index.html"));
}
