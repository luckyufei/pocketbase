/**
 * Archive — ZIP 解压
 * 与 Go 版 tools/archive/extract.go 对齐
 *
 * 包含 Zip Slip 防护
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, normalize, resolve, dirname } from "node:path";

/**
 * 解压 ZIP 文件到目标目录
 *
 * @param src - ZIP 文件路径
 * @param dest - 目标解压目录
 * @throws 如果文件不存在或路径穿越检测失败
 */
export async function extractArchive(src: string, dest: string): Promise<void> {
  if (!existsSync(src)) {
    throw new Error(`ZIP file not found: ${src}`);
  }

  const normalizedDest = resolve(normalize(dest));

  // 使用 Bun 的文件读取 + 手动 ZIP 解析
  const { default: AdmZip } = await importAdmZip();

  const zip = new AdmZip(src);
  const entries = zip.getEntries();

  for (const entry of entries) {
    const entryName = entry.entryName;

    // Zip Slip 防护: 检查路径是否在目标目录内
    const targetPath = resolve(normalize(join(normalizedDest, entryName)));
    if (!targetPath.startsWith(normalizedDest)) {
      throw new Error(`Zip Slip detected: "${entryName}" resolves outside target directory`);
    }

    if (entry.isDirectory) {
      mkdirSync(targetPath, { recursive: true });
    } else {
      // 确保父目录存在
      mkdirSync(dirname(targetPath), { recursive: true });
      writeFileSync(targetPath, entry.getData());
    }
  }
}

/**
 * 简易 ZIP 解析器（降级方案）
 */
async function importAdmZip(): Promise<{ default: any }> {
  try {
    return await import("adm-zip");
  } catch {
    return { default: SimpleZipReader };
  }
}

/**
 * 简易 ZIP 读取器
 */
class SimpleZipReader {
  private entries: { entryName: string; isDirectory: boolean; data: Buffer }[] = [];

  constructor(src: string) {
    const file = Bun.file(src);
    // 同步读取 ZIP 文件并解析
    this.parseSync(src);
  }

  private parseSync(src: string): void {
    const { readFileSync } = require("node:fs");
    const buf = readFileSync(src) as Buffer;

    // 找到 End of Central Directory
    let eocdOffset = -1;
    for (let i = buf.length - 22; i >= 0; i--) {
      if (buf.readUInt32LE(i) === 0x06054b50) {
        eocdOffset = i;
        break;
      }
    }

    if (eocdOffset < 0) {
      throw new Error("Invalid ZIP file: EOCD not found");
    }

    const cdOffset = buf.readUInt32LE(eocdOffset + 16);
    const cdCount = buf.readUInt16LE(eocdOffset + 10);

    let pos = cdOffset;
    for (let i = 0; i < cdCount; i++) {
      if (buf.readUInt32LE(pos) !== 0x02014b50) break;

      const compMethod = buf.readUInt16LE(pos + 10);
      const compSize = buf.readUInt32LE(pos + 20);
      const uncompSize = buf.readUInt32LE(pos + 24);
      const nameLen = buf.readUInt16LE(pos + 28);
      const extraLen = buf.readUInt16LE(pos + 30);
      const commentLen = buf.readUInt16LE(pos + 32);
      const localOffset = buf.readUInt32LE(pos + 42);
      const name = buf.slice(pos + 46, pos + 46 + nameLen).toString("utf-8");

      const isDir = name.endsWith("/");

      // 读取本地文件数据
      let data = Buffer.alloc(0);
      if (!isDir && compMethod === 0) { // STORE
        const localNameLen = buf.readUInt16LE(localOffset + 26);
        const localExtraLen = buf.readUInt16LE(localOffset + 28);
        const dataStart = localOffset + 30 + localNameLen + localExtraLen;
        data = buf.slice(dataStart, dataStart + uncompSize);
      }

      this.entries.push({ entryName: name, isDirectory: isDir, data });

      pos += 46 + nameLen + extraLen + commentLen;
    }
  }

  getEntries() {
    return this.entries.map(e => ({
      entryName: e.entryName,
      isDirectory: e.isDirectory,
      getData: () => e.data,
    }));
  }
}
