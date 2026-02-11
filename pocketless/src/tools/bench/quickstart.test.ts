/**
 * Quickstart 验证测试 — T134
 * 验证 quickstart.md 中描述的所有模块和接口都可正常导入和使用
 */

import { describe, test, expect } from "bun:test";
import { existsSync } from "fs";
import { resolve } from "path";

const PROJECT_ROOT = resolve(import.meta.dir, "../../..");

// ==================== 模块导入验证 ====================

describe("Quickstart validation (T134)", () => {
  test("CLI entry point exists", () => {
    const entryPath = resolve(PROJECT_ROOT, "src/pocketless.ts");
    expect(existsSync(entryPath)).toBe(true);
  });

  test("PocketLess class can be imported", async () => {
    const mod = await import("../../pocketless");
    expect(mod.PocketLess).toBeDefined();
    expect(typeof mod.PocketLess).toBe("function");
  });

  test("package.json has correct structure", async () => {
    const pkg = await import("../../../package.json");
    expect(pkg.default.name).toBe("pocketless");
    expect(pkg.default.bin?.pocketless).toBeDefined();
    expect(pkg.default.scripts?.dev).toBeDefined();
    expect(pkg.default.scripts?.start).toBeDefined();
    expect(pkg.default.scripts?.build).toBeDefined();
    expect(pkg.default.scripts?.test).toBeDefined();
  });

  test("CLI commands: serve, superuser, migrate", async () => {
    // 验证命令模块存在
    const servePath = resolve(PROJECT_ROOT, "src/cmd/serve.ts");
    const superuserPath = resolve(PROJECT_ROOT, "src/cmd/superuser.ts");
    const migratePath = resolve(PROJECT_ROOT, "src/cmd/migrate.ts");

    expect(existsSync(servePath)).toBe(true);
    expect(existsSync(superuserPath)).toBe(true);
    expect(existsSync(migratePath)).toBe(true);
  });

  test("core modules exist", async () => {
    const coreFiles = [
      "src/core/base.ts",
      "src/core/events.ts",
      "src/core/record_model.ts",
      "src/core/collection_model.ts",
      "src/core/settings_model.ts",
    ];

    for (const file of coreFiles) {
      const fullPath = resolve(PROJECT_ROOT, file);
      expect(existsSync(fullPath)).toBe(true);
    }
  });

  test("API modules exist", async () => {
    const apiFiles = [
      "src/apis/base.ts",
      "src/apis/health.ts",
      "src/apis/record_crud.ts",
      "src/apis/collection.ts",
      "src/apis/batch.ts",
    ];

    for (const file of apiFiles) {
      const fullPath = resolve(PROJECT_ROOT, file);
      expect(existsSync(fullPath)).toBe(true);
    }
  });

  test("tools modules exist", async () => {
    const toolFiles = [
      "src/tools/router/router.ts",
      "src/tools/cron/cron.ts",
      "src/tools/mailer/mailer.ts",
      "src/tools/hook/hook.ts",
      "src/tools/security/crypto.ts",
      "src/tools/security/jwt.ts",
      "src/tools/store/store.ts",
      "src/tools/search/provider.ts",
      "src/tools/filesystem/filesystem.ts",
      "src/tools/subscriptions/broker.ts",
      "src/tools/types/datetime.ts",
    ];

    for (const file of toolFiles) {
      const fullPath = resolve(PROJECT_ROOT, file);
      expect(existsSync(fullPath)).toBe(true);
    }
  });

  test("plugin modules exist", async () => {
    const pluginFiles = [
      "src/plugins/secrets/register.ts",
      "src/plugins/jobs/register.ts",
      "src/plugins/kv/register.ts",
    ];

    for (const file of pluginFiles) {
      const fullPath = resolve(PROJECT_ROOT, file);
      expect(existsSync(fullPath)).toBe(true);
    }
  });

  test("dependencies are declared in package.json", async () => {
    const pkg = await import("../../../package.json");
    const deps = pkg.default.dependencies;

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

  test("build script supports compile", async () => {
    const pkg = await import("../../../package.json");
    const buildScript = pkg.default.scripts?.build;
    expect(buildScript).toContain("bun build");
    expect(buildScript).toContain("--compile");
    expect(buildScript).toContain("--minify");
  });

  test("Router wrapper exports correct API", async () => {
    const mod = await import("../router/router");

    expect(mod.Router).toBeDefined();
    expect(mod.ApiError).toBeDefined();
    expect(mod.toApiError).toBeDefined();
    expect(mod.NewNotFoundError).toBeDefined();
    expect(mod.NewBadRequestError).toBeDefined();
    expect(mod.NewForbiddenError).toBeDefined();
    expect(mod.NewUnauthorizedError).toBeDefined();
    expect(mod.NewInternalServerError).toBeDefined();
    expect(mod.NewTooManyRequestsError).toBeDefined();
  });

  test("Cron wrapper exports correct API", async () => {
    const mod = await import("../cron/cron");

    expect(mod.Cron).toBeDefined();
    expect(mod.Job).toBeDefined();
    expect(mod.Schedule).toBeDefined();
    expect(mod.newMoment).toBeDefined();
  });

  test("Mailer exports correct API", async () => {
    const mod = await import("../mailer/mailer");

    expect(mod.SMTPClient).toBeDefined();
    expect(mod.Sendmail).toBeDefined();
    expect(mod.html2Text).toBeDefined();
    expect(mod.SMTPAuthPlain).toBe("PLAIN");
    expect(mod.SMTPAuthLogin).toBe("LOGIN");
  });

  test("Hook system exports correct API", async () => {
    const mod = await import("../hook/hook");

    expect(mod.Hook).toBeDefined();
    expect(mod.TaggedHook).toBeDefined();
    expect(mod.TaggedHookView).toBeDefined();
  });

  test("global CLI flags match quickstart.md", async () => {
    // 验证 PocketLess CLI 支持 quickstart.md 中描述的所有标志
    const expectedFlags = ["--dir", "--dev", "--pg", "--encryptionEnv", "--queryTimeout", "--http"];
    const entrySource = await Bun.file(resolve(PROJECT_ROOT, "src/pocketless.ts")).text();

    for (const flag of expectedFlags) {
      const flagName = flag.replace("--", "");
      expect(entrySource).toContain(flagName);
    }
  });
});
