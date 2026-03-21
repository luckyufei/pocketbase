/**
 * S3 Filesystem Adapter — S3 兼容存储
 * 与 Go 版 internal/s3blob/s3blob.go 对齐
 * 使用 @aws-sdk/client-s3
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  CopyObjectCommand,
} from "@aws-sdk/client-s3";
import type { Filesystem, FileAttributes } from "./filesystem";

export interface S3Config {
  bucket: string;
  region: string;
  endpoint?: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle?: boolean;
}

export class S3Filesystem implements Filesystem {
  private client: S3Client;
  private bucket: string;

  constructor(config: S3Config) {
    this.bucket = config.bucket;
    this.client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: config.forcePathStyle ?? false,
    });
  }

  async exists(fileKey: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: fileKey }),
      );
      return true;
    } catch {
      return false;
    }
  }

  async attributes(fileKey: string): Promise<FileAttributes> {
    const result = await this.client.send(
      new HeadObjectCommand({ Bucket: this.bucket, Key: fileKey }),
    );

    return {
      contentType: result.ContentType || "application/octet-stream",
      size: result.ContentLength || 0,
      modTime: result.LastModified || new Date(),
      metadata: (result.Metadata as Record<string, string>) || {},
    };
  }

  async upload(content: Uint8Array | string, fileKey: string): Promise<void> {
    const body = typeof content === "string"
      ? new TextEncoder().encode(content)
      : content;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: fileKey,
        Body: body,
      }),
    );
  }

  async download(fileKey: string): Promise<Uint8Array> {
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: fileKey }),
    );

    if (!result.Body) {
      throw new Error(`Empty body for key: ${fileKey}`);
    }

    // 将 ReadableStream 转为 Uint8Array
    const chunks: Uint8Array[] = [];
    const reader = result.Body.transformToWebStream().getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    const totalLen = chunks.reduce((sum, c) => sum + c.length, 0);
    const merged = new Uint8Array(totalLen);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    return merged;
  }

  async delete(fileKey: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: fileKey }),
    );
  }

  async deletePrefix(prefix: string): Promise<void> {
    const files = await this.list(prefix);
    // S3 batch delete (one by one for simplicity)
    for (const file of files) {
      await this.delete(file);
    }
  }

  async list(prefix: string): Promise<string[]> {
    const result: string[] = [];
    let continuationToken: string | undefined;

    do {
      const response = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        }),
      );

      for (const obj of response.Contents || []) {
        if (obj.Key) {
          result.push(obj.Key);
        }
      }

      continuationToken = response.IsTruncated
        ? response.NextContinuationToken
        : undefined;
    } while (continuationToken);

    return result;
  }

  async copy(srcKey: string, dstKey: string): Promise<void> {
    await this.client.send(
      new CopyObjectCommand({
        Bucket: this.bucket,
        CopySource: `${this.bucket}/${srcKey}`,
        Key: dstKey,
      }),
    );
  }

  async serve(fileKey: string, filename: string): Promise<Response> {
    const data = await this.download(fileKey);
    const attrs = await this.attributes(fileKey);

    return new Response(data, {
      status: 200,
      headers: {
        "Content-Type": attrs.contentType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(filename)}"`,
        "Content-Security-Policy": "default-src 'none'; media-src 'self'; style-src 'unsafe-inline'; sandbox",
        "Cache-Control": "max-age=2592000",
      },
    });
  }

  async close(): Promise<void> {
    this.client.destroy();
  }
}
