/**
 * Archive — ZIP 打包
 * 与 Go 版 tools/archive/create.go 对齐
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { writeFileSync, unlinkSync } from "node:fs";

// 使用 Bun 内置的 JSZip 兼容 API 或原生方式创建 ZIP
// 由于 Bun 支持 node:zlib，我们使用简单的 ZIP 实现

/**
 * 创建 ZIP 压缩包
 *
 * @param src - 源目录路径
 * @param dest - 目标 ZIP 文件路径
 * @param skipPaths - 需要跳过的相对路径列表
 */
export async function createArchive(src: string, dest: string, skipPaths: string[] = []): Promise<void> {
  // 使用 Bun 的 Bun.file + 手动 ZIP 构建
  // 为简洁起见，使用 archiver 或手动方式

  // 收集需要打包的文件
  const files = collectFiles(src, src, skipPaths);

  // 使用 Bun.write 的 ZIP writer (Bun 1.x 内置)
  // 注意: Bun 的 Bun.write 不直接支持 ZIP，使用 deflate 手工实现
  // 简化方案: 使用 node-compatible 的 archiver
  const { default: AdmZip } = await importAdmZip();

  const zip = new AdmZip();

  for (const file of files) {
    const content = readFileSync(file.fullPath);
    zip.addFile(file.relativePath, content);
  }

  zip.writeZip(dest);
}

interface FileEntry {
  fullPath: string;
  relativePath: string;
}

function collectFiles(dir: string, baseDir: string, skipPaths: string[]): FileEntry[] {
  const entries: FileEntry[] = [];
  const items = readdirSync(dir, { withFileTypes: true });

  for (const item of items) {
    const fullPath = join(dir, item.name);
    const relativePath = relative(baseDir, fullPath);

    // 检查是否需要跳过
    if (skipPaths.includes(relativePath) || skipPaths.includes(item.name)) {
      continue;
    }

    if (item.isDirectory()) {
      entries.push(...collectFiles(fullPath, baseDir, skipPaths));
    } else if (item.isFile()) {
      entries.push({ fullPath, relativePath });
    }
    // 跳过符号链接、管道等（安全考虑）
  }

  return entries;
}

/**
 * 动态导入 adm-zip（或内置实现）
 * 由于 Bun 没有内置 ZIP writer，使用简单的 ZIP 格式手动构建
 */
async function importAdmZip(): Promise<{ default: any }> {
  try {
    return await import("adm-zip");
  } catch {
    // 如果 adm-zip 不可用，使用简易 ZIP 实现
    return { default: SimpleZip };
  }
}

/**
 * 简易 ZIP 实现（无压缩，仅打包）
 * 用于 adm-zip 不可用时的降级方案
 */
class SimpleZip {
  private entries: { name: string; data: Buffer }[] = [];

  addFile(name: string, data: Buffer): void {
    this.entries.push({ name, data });
  }

  writeZip(dest: string): void {
    // 简单的 ZIP 文件格式实现（无压缩/STORE 方式）
    const parts: Buffer[] = [];
    const centralDir: Buffer[] = [];
    let offset = 0;

    for (const entry of this.entries) {
      // Local file header
      const nameBytes = Buffer.from(entry.name, "utf-8");
      const localHeader = Buffer.alloc(30 + nameBytes.length);

      localHeader.writeUInt32LE(0x04034b50, 0); // 签名
      localHeader.writeUInt16LE(20, 4);          // 解压版本
      localHeader.writeUInt16LE(0, 6);           // 标志位
      localHeader.writeUInt16LE(0, 8);           // 压缩方式 (STORE)
      localHeader.writeUInt16LE(0, 10);          // 修改时间
      localHeader.writeUInt16LE(0, 12);          // 修改日期
      localHeader.writeUInt32LE(crc32(entry.data), 14); // CRC-32
      localHeader.writeUInt32LE(entry.data.length, 18);  // 压缩大小
      localHeader.writeUInt32LE(entry.data.length, 22);  // 原始大小
      localHeader.writeUInt16LE(nameBytes.length, 26);   // 文件名长度
      localHeader.writeUInt16LE(0, 28);                  // 附加字段长度
      nameBytes.copy(localHeader, 30);

      parts.push(localHeader, entry.data);

      // Central directory entry
      const cdEntry = Buffer.alloc(46 + nameBytes.length);
      cdEntry.writeUInt32LE(0x02014b50, 0);      // 签名
      cdEntry.writeUInt16LE(20, 4);               // 创建版本
      cdEntry.writeUInt16LE(20, 6);               // 解压版本
      cdEntry.writeUInt16LE(0, 8);                // 标志位
      cdEntry.writeUInt16LE(0, 10);               // 压缩方式
      cdEntry.writeUInt16LE(0, 12);               // 修改时间
      cdEntry.writeUInt16LE(0, 14);               // 修改日期
      cdEntry.writeUInt32LE(crc32(entry.data), 16); // CRC-32
      cdEntry.writeUInt32LE(entry.data.length, 20);  // 压缩大小
      cdEntry.writeUInt32LE(entry.data.length, 24);  // 原始大小
      cdEntry.writeUInt16LE(nameBytes.length, 28);   // 文件名长度
      cdEntry.writeUInt16LE(0, 30);               // 附加字段长度
      cdEntry.writeUInt16LE(0, 32);               // 注释长度
      cdEntry.writeUInt16LE(0, 34);               // 起始盘号
      cdEntry.writeUInt16LE(0, 36);               // 内部属性
      cdEntry.writeUInt32LE(0, 38);               // 外部属性
      cdEntry.writeUInt32LE(offset, 42);           // 本地头偏移
      nameBytes.copy(cdEntry, 46);

      centralDir.push(cdEntry);
      offset += localHeader.length + entry.data.length;
    }

    // End of Central Directory
    const cdSize = centralDir.reduce((sum, b) => sum + b.length, 0);
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);             // 签名
    eocd.writeUInt16LE(0, 4);                      // 当前盘号
    eocd.writeUInt16LE(0, 6);                      // 中央目录起始盘号
    eocd.writeUInt16LE(this.entries.length, 8);     // 本盘记录数
    eocd.writeUInt16LE(this.entries.length, 10);    // 总记录数
    eocd.writeUInt32LE(cdSize, 12);                // 中央目录大小
    eocd.writeUInt32LE(offset, 16);                // 中央目录偏移
    eocd.writeUInt16LE(0, 20);                     // 注释长度

    const zipBuffer = Buffer.concat([...parts, ...centralDir, eocd]);
    writeFileSync(dest, zipBuffer);
  }
}

/**
 * CRC-32 计算
 */
function crc32(data: Buffer): number {
  let crc = 0xFFFFFFFF;
  const table = getCRC32Table();

  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ data[i]) & 0xFF];
  }

  return (crc ^ 0xFFFFFFFF) >>> 0;
}

let _crc32Table: number[] | null = null;
function getCRC32Table(): number[] {
  if (_crc32Table) return _crc32Table;

  _crc32Table = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    _crc32Table[i] = c;
  }
  return _crc32Table;
}
