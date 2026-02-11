import { describe, test, expect } from "bun:test";
import { parseThumbSize, createThumb, isImageFilename } from "./thumb";

describe("Thumbnail", () => {
  test("parseThumbSize — WxH (center crop)", () => {
    const result = parseThumbSize("100x100");
    expect(result).toEqual({ width: 100, height: 100, mode: "center" });
  });

  test("parseThumbSize — WxHt (top crop)", () => {
    const result = parseThumbSize("200x150t");
    expect(result).toEqual({ width: 200, height: 150, mode: "top" });
  });

  test("parseThumbSize — WxHb (bottom crop)", () => {
    const result = parseThumbSize("200x150b");
    expect(result).toEqual({ width: 200, height: 150, mode: "bottom" });
  });

  test("parseThumbSize — WxHf (fit)", () => {
    const result = parseThumbSize("300x200f");
    expect(result).toEqual({ width: 300, height: 200, mode: "fit" });
  });

  test("parseThumbSize — 0xH (resize to height)", () => {
    const result = parseThumbSize("0x200");
    expect(result).toEqual({ width: 0, height: 200, mode: "height" });
  });

  test("parseThumbSize — Wx0 (resize to width)", () => {
    const result = parseThumbSize("300x0");
    expect(result).toEqual({ width: 300, height: 0, mode: "width" });
  });

  test("parseThumbSize — 无效格式返回 null", () => {
    expect(parseThumbSize("invalid")).toBeNull();
    expect(parseThumbSize("0x0")).toBeNull();
    expect(parseThumbSize("abc")).toBeNull();
    expect(parseThumbSize("")).toBeNull();
  });

  test("createThumb — 使用 sharp 生成缩略图", async () => {
    // 创建一个简单的 100x100 红色 PNG
    const sharp = (await import("sharp")).default;
    const input = await sharp({
      create: { width: 100, height: 100, channels: 3, background: { r: 255, g: 0, b: 0 } },
    })
      .png()
      .toBuffer();

    const thumb = await createThumb(new Uint8Array(input), "50x50");

    expect(thumb.length).toBeGreaterThan(0);

    // 验证缩略图尺寸
    const metadata = await sharp(Buffer.from(thumb)).metadata();
    expect(metadata.width).toBe(50);
    expect(metadata.height).toBe(50);
  });

  test("createThumb — fit 模式不裁切", async () => {
    const sharp = (await import("sharp")).default;
    const input = await sharp({
      create: { width: 200, height: 100, channels: 3, background: { r: 0, g: 255, b: 0 } },
    })
      .png()
      .toBuffer();

    const thumb = await createThumb(new Uint8Array(input), "100x100f");

    const metadata = await sharp(Buffer.from(thumb)).metadata();
    // fit 模式：200x100 → fit into 100x100 → 100x50
    expect(metadata.width).toBe(100);
    expect(metadata.height).toBe(50);
  });

  test("createThumb — 无效尺寸抛出错误", async () => {
    const input = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // minimal PNG header
    await expect(createThumb(input, "invalid")).rejects.toThrow("Invalid thumb size");
  });

  test("isImageFilename — 正确识别图片", () => {
    expect(isImageFilename("photo.jpg")).toBe(true);
    expect(isImageFilename("image.PNG")).toBe(true);
    expect(isImageFilename("test.gif")).toBe(true);
    expect(isImageFilename("icon.webp")).toBe(true);
    expect(isImageFilename("doc.pdf")).toBe(false);
    expect(isImageFilename("data.json")).toBe(false);
  });
});
