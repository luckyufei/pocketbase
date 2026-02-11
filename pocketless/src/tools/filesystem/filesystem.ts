/**
 * Filesystem 接口 — 文件存储抽象层
 * 与 Go 版 tools/filesystem/filesystem.go 对齐
 *
 * 提供统一的文件操作接口，支持本地文件系统和 S3 两种后端
 */

/** 文件属性 */
export interface FileAttributes {
  contentType: string;
  size: number;
  modTime: Date;
  metadata: Record<string, string>;
}

/** 文件系统接口 */
export interface Filesystem {
  /** 检查文件是否存在 */
  exists(fileKey: string): Promise<boolean>;

  /** 获取文件属性 */
  attributes(fileKey: string): Promise<FileAttributes>;

  /** 上传文件内容 */
  upload(content: Uint8Array | string, fileKey: string): Promise<void>;

  /** 下载文件内容 */
  download(fileKey: string): Promise<Uint8Array>;

  /** 删除文件 */
  delete(fileKey: string): Promise<void>;

  /** 删除指定前缀下的所有文件 */
  deletePrefix(prefix: string): Promise<void>;

  /** 列出指定前缀下的所有文件 */
  list(prefix: string): Promise<string[]>;

  /** 复制文件 */
  copy(srcKey: string, dstKey: string): Promise<void>;

  /** 通过 HTTP 提供文件下载（含 Content-Type/Content-Disposition 等头） */
  serve(fileKey: string, filename: string): Promise<Response>;

  /** 关闭文件系统（清理资源） */
  close(): Promise<void>;
}

/**
 * 规范化文件名
 * 与 Go 版 file.go 的 normalizeName 对齐
 * 格式: {snakecase_name}_{random10chars}{extension}
 */
export function normalizeFilename(name: string): string {
  // 提取扩展名（支持双扩展名如 .tar.gz）
  let ext = "";
  const parts = name.split(".");
  if (parts.length > 1) {
    // 检查是否有双扩展名
    if (parts.length > 2 && parts[parts.length - 2].length <= 4) {
      ext = "." + parts.slice(-2).join(".");
    } else {
      ext = "." + parts[parts.length - 1];
    }
    // 限制扩展名长度
    if (ext.length > 20) {
      ext = ext.slice(0, 20);
    }
  }

  // 提取基础名
  const baseName = name.slice(0, name.length - ext.length);

  // 转为 snake_case 并清理
  const sanitized = baseName
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase()
    .slice(0, 100);

  // 生成随机后缀
  const { randomString } = require("../security/random");
  const suffix = randomString(10).toLowerCase();

  return `${sanitized || "file"}_${suffix}${ext}`;
}

/**
 * 生成 Record 文件路径
 * 与 Go 版兼容: {collectionId}/{recordId}/{filename}
 */
export function recordFilePath(
  collectionId: string,
  recordId: string,
  filename: string,
): string {
  return `${collectionId}/${recordId}/${filename}`;
}

/**
 * 生成缩略图文件路径
 * 与 Go 版兼容: {collectionId}/{recordId}/thumbs_{filename}/{size}_{filename}
 */
export function thumbFilePath(
  collectionId: string,
  recordId: string,
  filename: string,
  thumbSize: string,
): string {
  return `${collectionId}/${recordId}/thumbs_${filename}/${thumbSize}_${filename}`;
}
