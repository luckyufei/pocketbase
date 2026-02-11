/**
 * build.test.ts — T127-T128 单二进制编译与部署测试
 * 验证: 构建脚本存在、package.json 配置正确、入口点可解析
 */
import { describe, test, expect } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..", "..");

describe("Build Configuration", () => {
  // T127: 构建脚本
  test("build.sh 脚本存在且可执行", () => {
    const scriptPath = join(ROOT, "scripts", "build.sh");
    expect(existsSync(scriptPath)).toBe(true);

    const content = readFileSync(scriptPath, "utf-8");
    expect(content).toContain("bun build --compile");
    expect(content).toContain("--minify");
    expect(content).toContain("pocketless.ts");
  });

  test("build.sh 支持交叉编译", () => {
    const content = readFileSync(join(ROOT, "scripts", "build.sh"), "utf-8");
    expect(content).toContain("linux-x64");
    expect(content).toContain("darwin-arm64");
    expect(content).toContain("CROSS_COMPILE");
  });

  // T128: 资产嵌入配置
  test("package.json build 脚本配置正确", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8"));
    expect(pkg.scripts.build).toContain("bun build --compile");
    expect(pkg.scripts.build).toContain("--minify");
    expect(pkg.scripts.build).toContain("pocketless");
  });

  test("package.json 入口点指向 pocketless.ts", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8"));
    expect(pkg.main).toContain("pocketless.ts");
    expect(pkg.bin.pocketless).toContain("pocketless.ts");
  });

  test("入口文件 pocketless.ts 存在", () => {
    expect(existsSync(join(ROOT, "src", "pocketless.ts"))).toBe(true);
  });

  test("PocketLess 类可导入", async () => {
    const { PocketLess } = await import("../pocketless");
    expect(PocketLess).toBeDefined();
    const pl = new PocketLess();
    expect(pl).toBeDefined();
    expect(pl.isDev).toBeDefined();
    expect(pl.dataDir).toBe("./pb_data");
    expect(pl.httpAddr).toBe("127.0.0.1:8090");
  });

  test("CLI 支持 --dev, --dir, --pg, --http 选项", () => {
    const { PocketLess } = require("../pocketless");
    const pl = new PocketLess();
    pl.parseGlobalOptions({
      dir: "/custom/data",
      dev: true,
      pg: "postgres://localhost:5432/test",
      http: "0.0.0.0:3000",
    });
    expect(pl.dataDir).toBe("/custom/data");
    expect(pl.isDev).toBe(true);
    expect(pl.pgDSN).toBe("postgres://localhost:5432/test");
    expect(pl.httpAddr).toBe("0.0.0.0:3000");
  });

  test("核心依赖全部声明", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8"));
    const deps = pkg.dependencies;
    expect(deps.hono).toBeDefined();
    expect(deps.kysely).toBeDefined();
    expect(deps.jose).toBeDefined();
    expect(deps.arctic).toBeDefined();
    expect(deps.croner).toBeDefined();
    expect(deps.commander).toBeDefined();
    expect(deps.zod).toBeDefined();
    expect(deps.nodemailer).toBeDefined();
    expect(deps["@aws-sdk/client-s3"]).toBeDefined();
    expect(deps.sharp).toBeDefined();
  });
});
