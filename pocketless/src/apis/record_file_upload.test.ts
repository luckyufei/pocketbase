import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { LocalFilesystem } from "../tools/filesystem/local";
import {
  uploadRecordFiles,
  deleteRecordFiles,
  deleteAllRecordFiles,
} from "./record_file_upload";

let testDir: string;
let fsys: LocalFilesystem;

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), "pocketless-upload-"));
  fsys = new LocalFilesystem(testDir);
});

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true });
});

describe("Record File Upload", () => {
  test("uploadRecordFiles — 上传文件并返回信息", async () => {
    const formData = new FormData();
    formData.append(
      "avatar",
      new File(["hello"], "my_photo.jpg", { type: "image/jpeg" }),
    );

    const result = await uploadRecordFiles(
      fsys,
      "col1",
      "rec1",
      formData,
      ["avatar"],
    );

    expect(result.length).toBe(1);
    expect(result[0].fieldName).toBe("avatar");
    expect(result[0].originalName).toBe("my_photo.jpg");
    expect(result[0].size).toBe(5);
    expect(result[0].filename).toMatch(/^my_photo_.*\.jpg$/);

    // 验证文件已上传
    const exists = await fsys.exists(`col1/rec1/${result[0].filename}`);
    expect(exists).toBe(true);
  });

  test("uploadRecordFiles — 多文件上传", async () => {
    const formData = new FormData();
    formData.append(
      "images",
      new File(["img1"], "photo1.png", { type: "image/png" }),
    );
    formData.append(
      "images",
      new File(["img2"], "photo2.png", { type: "image/png" }),
    );

    const result = await uploadRecordFiles(
      fsys,
      "col1",
      "rec1",
      formData,
      ["images"],
    );

    expect(result.length).toBe(2);
    expect(result[0].originalName).toBe("photo1.png");
    expect(result[1].originalName).toBe("photo2.png");
  });

  test("uploadRecordFiles — 忽略空文件", async () => {
    const formData = new FormData();
    formData.append(
      "avatar",
      new File([], "empty.txt", { type: "text/plain" }),
    );

    const result = await uploadRecordFiles(
      fsys,
      "col1",
      "rec1",
      formData,
      ["avatar"],
    );

    expect(result.length).toBe(0);
  });

  test("deleteRecordFiles — 删除指定文件", async () => {
    await fsys.upload("data", "col1/rec1/file_abc.txt");
    await fsys.upload("thumb", "col1/rec1/thumbs_file_abc.txt/50x50_file_abc.txt");

    expect(await fsys.exists("col1/rec1/file_abc.txt")).toBe(true);

    await deleteRecordFiles(fsys, "col1", "rec1", ["file_abc.txt"]);

    expect(await fsys.exists("col1/rec1/file_abc.txt")).toBe(false);
    // 缩略图也被清理
    expect(await fsys.exists("col1/rec1/thumbs_file_abc.txt/50x50_file_abc.txt")).toBe(false);
  });

  test("deleteAllRecordFiles — 删除所有文件", async () => {
    await fsys.upload("a", "col1/rec1/file_a.txt");
    await fsys.upload("b", "col1/rec1/file_b.txt");
    await fsys.upload("c", "col1/rec2/file_c.txt");

    await deleteAllRecordFiles(fsys, "col1", "rec1");

    expect(await fsys.exists("col1/rec1/file_a.txt")).toBe(false);
    expect(await fsys.exists("col1/rec1/file_b.txt")).toBe(false);
    // 其他 record 的文件不受影响
    expect(await fsys.exists("col1/rec2/file_c.txt")).toBe(true);
  });
});
