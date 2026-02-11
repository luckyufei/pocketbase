/**
 * Thumbnail 生成 — 使用 sharp
 * 与 Go 版 filesystem.go 的 CreateThumb 对齐
 *
 * 支持 6 种格式:
 * - WxH   — fill+crop from center
 * - WxHt  — fill+crop from top
 * - WxHb  — fill+crop from bottom
 * - WxHf  — fit inside viewbox (no crop)
 * - 0xH   — resize to height, preserve aspect
 * - Wx0   — resize to width, preserve aspect
 */

import sharp from "sharp";

/** 解析缩略图尺寸字符串 */
export function parseThumbSize(size: string): {
  width: number;
  height: number;
  mode: "center" | "top" | "bottom" | "fit" | "width" | "height";
} | null {
  // 匹配 WxH, WxHt, WxHb, WxHf, 0xH, Wx0
  const match = size.match(/^(\d+)x(\d+)(t|b|f)?$/);
  if (!match) return null;

  const w = parseInt(match[1], 10);
  const h = parseInt(match[2], 10);
  const suffix = match[3] as "t" | "b" | "f" | undefined;

  if (w === 0 && h === 0) return null;

  if (w === 0) return { width: 0, height: h, mode: "height" };
  if (h === 0) return { width: w, height: 0, mode: "width" };

  switch (suffix) {
    case "t":
      return { width: w, height: h, mode: "top" };
    case "b":
      return { width: w, height: h, mode: "bottom" };
    case "f":
      return { width: w, height: h, mode: "fit" };
    default:
      return { width: w, height: h, mode: "center" };
  }
}

/**
 * 创建缩略图
 * 输入原始图片 buffer，输出缩略图 buffer
 */
export async function createThumb(
  input: Uint8Array,
  thumbSize: string,
): Promise<Uint8Array> {
  const parsed = parseThumbSize(thumbSize);
  if (!parsed) {
    throw new Error(`Invalid thumb size: ${thumbSize}`);
  }

  let img = sharp(Buffer.from(input));

  switch (parsed.mode) {
    case "width":
      img = img.resize(parsed.width, null, { fit: "inside" });
      break;
    case "height":
      img = img.resize(null, parsed.height, { fit: "inside" });
      break;
    case "fit":
      img = img.resize(parsed.width, parsed.height, { fit: "inside" });
      break;
    case "top":
      img = img.resize(parsed.width, parsed.height, {
        fit: "cover",
        position: "top",
      });
      break;
    case "bottom":
      img = img.resize(parsed.width, parsed.height, {
        fit: "cover",
        position: "bottom",
      });
      break;
    case "center":
    default:
      img = img.resize(parsed.width, parsed.height, {
        fit: "cover",
        position: "center",
      });
      break;
  }

  // 保持原始格式输出，默认 PNG
  const result = await img.toBuffer();
  return new Uint8Array(result);
}

/** 检查文件名是否为图片（支持生成缩略图） */
export function isImageFilename(filename: string): boolean {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  return ["jpg", "jpeg", "png", "gif", "webp", "tiff", "bmp", "svg"].includes(ext);
}
