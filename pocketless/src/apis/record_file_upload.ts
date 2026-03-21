/**
 * Record 文件上传/清理逻辑
 * 与 Go 版 record CRUD 中的文件处理对齐
 *
 * - 创建 record 时上传文件
 * - 更新 record 时替换文件并清理旧文件
 * - 删除 record 时清理所有文件
 */

import type { Filesystem } from "../tools/filesystem/filesystem";
import { recordFilePath, normalizeFilename } from "../tools/filesystem/filesystem";

/** 上传结果 */
export interface UploadedFile {
  fieldName: string;
  filename: string;
  originalName: string;
  size: number;
}

/**
 * 从 multipart FormData 中提取并上传文件
 * 返回已上传文件列表
 */
export async function uploadRecordFiles(
  fsys: Filesystem,
  collectionId: string,
  recordId: string,
  formData: FormData,
  fileFieldNames: string[],
): Promise<UploadedFile[]> {
  const uploaded: UploadedFile[] = [];

  for (const fieldName of fileFieldNames) {
    const files = formData.getAll(fieldName);
    for (const file of files) {
      if (!(file instanceof File) || file.size === 0) continue;

      const filename = normalizeFilename(file.name);
      const fileKey = recordFilePath(collectionId, recordId, filename);

      const buffer = new Uint8Array(await file.arrayBuffer());
      await fsys.upload(buffer, fileKey);

      uploaded.push({
        fieldName,
        filename,
        originalName: file.name,
        size: file.size,
      });
    }
  }

  return uploaded;
}

/**
 * 清理 Record 关联的指定文件
 */
export async function deleteRecordFiles(
  fsys: Filesystem,
  collectionId: string,
  recordId: string,
  filenames: string[],
): Promise<void> {
  for (const filename of filenames) {
    const fileKey = recordFilePath(collectionId, recordId, filename);
    await fsys.delete(fileKey);

    // 清理缩略图目录
    const thumbPrefix = `${collectionId}/${recordId}/thumbs_${filename}`;
    await fsys.deletePrefix(thumbPrefix);
  }
}

/**
 * 清理 Record 关联的所有文件
 */
export async function deleteAllRecordFiles(
  fsys: Filesystem,
  collectionId: string,
  recordId: string,
): Promise<void> {
  const prefix = `${collectionId}/${recordId}`;
  await fsys.deletePrefix(prefix);
}
