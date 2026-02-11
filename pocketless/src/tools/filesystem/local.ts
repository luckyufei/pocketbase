/**
 * Local Filesystem Adapter — 本地文件系统
 * 与 Go 版 internal/fileblob/fileblob.go 对齐
 */

import { existsSync } from "node:fs";
import { mkdir, writeFile, readFile, unlink, readdir, stat, copyFile } from "node:fs/promises";
import { join, dirname, extname } from "node:path";
import type { Filesystem, FileAttributes } from "./filesystem";

export class LocalFilesystem implements Filesystem {
  private basePath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
  }

  private resolvePath(fileKey: string): string {
    return join(this.basePath, fileKey);
  }

  async exists(fileKey: string): Promise<boolean> {
    try {
      await stat(this.resolvePath(fileKey));
      return true;
    } catch {
      return false;
    }
  }

  async attributes(fileKey: string): Promise<FileAttributes> {
    const fullPath = this.resolvePath(fileKey);
    const fileStat = await stat(fullPath);

    return {
      contentType: mimeFromExt(extname(fileKey)),
      size: fileStat.size,
      modTime: fileStat.mtime,
      metadata: {},
    };
  }

  async upload(content: Uint8Array | string, fileKey: string): Promise<void> {
    const fullPath = this.resolvePath(fileKey);
    await mkdir(dirname(fullPath), { recursive: true });

    const data = typeof content === "string"
      ? new TextEncoder().encode(content)
      : content;

    await writeFile(fullPath, data);
  }

  async download(fileKey: string): Promise<Uint8Array> {
    const fullPath = this.resolvePath(fileKey);
    return new Uint8Array(await readFile(fullPath));
  }

  async delete(fileKey: string): Promise<void> {
    const fullPath = this.resolvePath(fileKey);
    try {
      await unlink(fullPath);
    } catch (err: any) {
      if (err.code !== "ENOENT") throw err;
    }

    // 尝试清理空的父目录
    await this.cleanEmptyDirs(dirname(fullPath));
  }

  async deletePrefix(prefix: string): Promise<void> {
    const files = await this.list(prefix);
    for (const file of files) {
      await this.delete(file);
    }
  }

  async list(prefix: string): Promise<string[]> {
    const dir = this.resolvePath(prefix);
    const result: string[] = [];

    try {
      await this.walkDir(dir, prefix, result);
    } catch (err: any) {
      if (err.code !== "ENOENT") throw err;
    }

    return result;
  }

  async copy(srcKey: string, dstKey: string): Promise<void> {
    const srcPath = this.resolvePath(srcKey);
    const dstPath = this.resolvePath(dstKey);
    await mkdir(dirname(dstPath), { recursive: true });
    await copyFile(srcPath, dstPath);
  }

  async serve(fileKey: string, filename: string): Promise<Response> {
    const data = await this.download(fileKey);
    const contentType = mimeFromExt(extname(filename));

    return new Response(data, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(filename)}"`,
        "Content-Security-Policy": "default-src 'none'; media-src 'self'; style-src 'unsafe-inline'; sandbox",
        "Cache-Control": "max-age=2592000",
      },
    });
  }

  async close(): Promise<void> {
    // 本地文件系统无需关闭
  }

  /** 递归遍历目录 */
  private async walkDir(
    dir: string,
    prefix: string,
    result: string[],
  ): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      const fileKey = prefix
        ? `${prefix}/${entry.name}`
        : entry.name;

      if (entry.isDirectory()) {
        await this.walkDir(fullPath, fileKey, result);
      } else if (entry.isFile() && !entry.name.endsWith(".attrs")) {
        result.push(fileKey);
      }
    }
  }

  /** 清理空的父目录（直到 basePath） */
  private async cleanEmptyDirs(dir: string): Promise<void> {
    if (!dir.startsWith(this.basePath) || dir === this.basePath) return;

    try {
      const entries = await readdir(dir);
      if (entries.length === 0) {
        const { rmdir } = await import("node:fs/promises");
        await rmdir(dir);
        await this.cleanEmptyDirs(dirname(dir));
      }
    } catch {
      // 忽略
    }
  }
}

/** 根据扩展名推断 MIME 类型 */
function mimeFromExt(ext: string): string {
  const map: Record<string, string> = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "application/javascript",
    ".json": "application/json",
    ".xml": "application/xml",
    ".txt": "text/plain",
    ".csv": "text/csv",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
    ".pdf": "application/pdf",
    ".zip": "application/zip",
    ".gz": "application/gzip",
    ".tar": "application/x-tar",
    ".mp3": "audio/mpeg",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".otf": "font/otf",
  };
  return map[ext.toLowerCase()] || "application/octet-stream";
}
