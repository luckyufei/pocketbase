/**
 * superuser 命令测试 — 子命令注册 + 执行逻辑
 * T054: 覆盖 create/upsert/update/delete/otp 子命令的实际执行场景
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { Command } from "commander";
import { registerSuperuserCommand } from "./superuser";
import { BaseApp } from "../core/base";
import { RecordModel } from "../core/record_model";
import { existsSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// ============================================================
// 子命令注册测试（已有）
// ============================================================

describe("registerSuperuserCommand", () => {
  test("注册 superuser 命令", () => {
    const program = new Command();
    const pl = { parseGlobalOptions: () => {} } as any;
    registerSuperuserCommand(program, pl);
    const cmd = program.commands.find((c) => c.name() === "superuser");
    expect(cmd).toBeDefined();
    expect(cmd!.description()).toBe("管理超级用户");
  });

  test("包含 5 个子命令", () => {
    const program = new Command();
    const pl = { parseGlobalOptions: () => {} } as any;
    registerSuperuserCommand(program, pl);
    const su = program.commands.find((c) => c.name() === "superuser")!;
    expect(su.commands.length).toBe(5);
  });

  test("create 子命令", () => {
    const program = new Command();
    registerSuperuserCommand(program, { parseGlobalOptions: () => {} } as any);
    const su = program.commands.find((c) => c.name() === "superuser")!;
    expect(su.commands.find((c) => c.name() === "create")).toBeDefined();
  });

  test("upsert 子命令", () => {
    const program = new Command();
    registerSuperuserCommand(program, { parseGlobalOptions: () => {} } as any);
    const su = program.commands.find((c) => c.name() === "superuser")!;
    expect(su.commands.find((c) => c.name() === "upsert")).toBeDefined();
  });

  test("update 子命令", () => {
    const program = new Command();
    registerSuperuserCommand(program, { parseGlobalOptions: () => {} } as any);
    const su = program.commands.find((c) => c.name() === "superuser")!;
    expect(su.commands.find((c) => c.name() === "update")).toBeDefined();
  });

  test("delete 子命令", () => {
    const program = new Command();
    registerSuperuserCommand(program, { parseGlobalOptions: () => {} } as any);
    const su = program.commands.find((c) => c.name() === "superuser")!;
    expect(su.commands.find((c) => c.name() === "delete")).toBeDefined();
  });

  test("otp 子命令", () => {
    const program = new Command();
    registerSuperuserCommand(program, { parseGlobalOptions: () => {} } as any);
    const su = program.commands.find((c) => c.name() === "superuser")!;
    expect(su.commands.find((c) => c.name() === "otp")).toBeDefined();
  });
});

// ============================================================
// T054: 执行逻辑单元测试
// ============================================================

describe("superuser 执行逻辑 (T054)", () => {
  let app: BaseApp;
  let dataDir: string;

  beforeEach(async () => {
    dataDir = join(tmpdir(), `pb_test_su_${Date.now()}_${Math.random().toString(36).slice(2)}`);
    mkdirSync(dataDir, { recursive: true });
    app = new BaseApp({ dataDir, isDev: true });
    await app.bootstrap();
  });

  afterEach(async () => {
    await app.shutdown();
    if (existsSync(dataDir)) {
      rmSync(dataDir, { recursive: true, force: true });
    }
  });

  // --- create ---

  test("superuserCreate — 创建新超级用户", async () => {
    const { superuserCreate } = await import("./superuser");
    await superuserCreate(app, "admin@test.com", "password123");

    const record = await app.findAuthRecordByEmail("_superusers", "admin@test.com");
    expect(record).not.toBeNull();
    expect(record!.getEmail()).toBe("admin@test.com");
  });

  test("superuserCreate — 重复 email 报错", async () => {
    const { superuserCreate } = await import("./superuser");
    await superuserCreate(app, "admin@test.com", "password123");

    // 第二次创建同 email 应报错
    await expect(superuserCreate(app, "admin@test.com", "password456")).rejects.toThrow();
  });

  // --- upsert ---

  test("superuserUpsert — 不存在时创建", async () => {
    const { superuserUpsert } = await import("./superuser");
    await superuserUpsert(app, "new@test.com", "pass123");

    const record = await app.findAuthRecordByEmail("_superusers", "new@test.com");
    expect(record).not.toBeNull();
    expect(record!.getEmail()).toBe("new@test.com");
  });

  test("superuserUpsert — 已存在时更新密码", async () => {
    const { superuserCreate, superuserUpsert } = await import("./superuser");
    await superuserCreate(app, "admin@test.com", "oldpass");

    const before = await app.findAuthRecordByEmail("_superusers", "admin@test.com");
    const oldId = before!.id;

    await superuserUpsert(app, "admin@test.com", "newpass");

    const after = await app.findAuthRecordByEmail("_superusers", "admin@test.com");
    expect(after).not.toBeNull();
    expect(after!.id).toBe(oldId); // 同一条记录
  });

  // --- update ---

  test("superuserUpdate — 更新已有超级用户密码", async () => {
    const { superuserCreate, superuserUpdate } = await import("./superuser");
    await superuserCreate(app, "admin@test.com", "oldpass");

    await superuserUpdate(app, "admin@test.com", "newpass");

    const record = await app.findAuthRecordByEmail("_superusers", "admin@test.com");
    expect(record).not.toBeNull();
  });

  test("superuserUpdate — 不存在的 email 报错", async () => {
    const { superuserUpdate } = await import("./superuser");
    await expect(superuserUpdate(app, "nonexist@test.com", "pass")).rejects.toThrow(
      /doesn't exist/,
    );
  });

  // --- delete ---

  test("superuserDelete — 删除已有超级用户", async () => {
    const { superuserCreate, superuserDelete } = await import("./superuser");
    await superuserCreate(app, "admin@test.com", "password123");

    await superuserDelete(app, "admin@test.com");

    const record = await app.findAuthRecordByEmail("_superusers", "admin@test.com");
    expect(record).toBeNull();
  });

  test("superuserDelete — 不存在的 email 不报错（幂等）", async () => {
    const { superuserDelete } = await import("./superuser");
    // 不应抛出异常
    await superuserDelete(app, "nonexist@test.com");
  });

  // --- otp ---

  test("superuserOTP — 为已有超级用户生成 OTP", async () => {
    const { superuserCreate, superuserOTP } = await import("./superuser");
    await superuserCreate(app, "admin@test.com", "password123");

    const result = await superuserOTP(app, "admin@test.com");
    expect(result).toBeDefined();
    expect(result.otpId).toBeTruthy();
    expect(result.password).toBeTruthy();
    expect(result.password.length).toBeGreaterThan(0);
  });

  test("superuserOTP — 不存在的 email 报错", async () => {
    const { superuserOTP } = await import("./superuser");
    await expect(superuserOTP(app, "nonexist@test.com")).rejects.toThrow(/doesn't exist/);
  });
});
