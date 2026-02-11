/**
 * superuser 命令 — 管理超级用户
 * 与 Go 版 cmd/superuser.go 对齐
 */

import type { Command } from "commander";
import type PocketLess from "../pocketless";
import type { BaseApp } from "../core/base";
import { RecordModel } from "../core/record_model";
import { hashPassword } from "../tools/security/password";
import { generateId, randomStringWithAlphabet, generateTokenKey } from "../tools/security/random";

const SUPERUSERS_COLLECTION = "_superusers";

/**
 * 创建超级用户
 */
export async function superuserCreate(app: BaseApp, email: string, password: string): Promise<RecordModel> {
  const col = await app.findCollectionByNameOrId(SUPERUSERS_COLLECTION);
  if (!col) throw new Error(`集合 "${SUPERUSERS_COLLECTION}" 不存在`);

  const record = new RecordModel(col);
  record.id = generateId();
  record.setEmail(email);
  record.set("password", await hashPassword(password));
  record.set("tokenKey", generateTokenKey());
  record.set("verified", true);

  await app.save(record);
  return record;
}

/**
 * 创建或更新超级用户（Upsert）
 */
export async function superuserUpsert(app: BaseApp, email: string, password: string): Promise<RecordModel> {
  const existing = await app.findAuthRecordByEmail(SUPERUSERS_COLLECTION, email);
  if (existing) {
    existing.set("password", await hashPassword(password));
    existing.set("tokenKey", generateTokenKey());
    await app.save(existing);
    return existing;
  }
  return superuserCreate(app, email, password);
}

/**
 * 更新超级用户密码
 */
export async function superuserUpdate(app: BaseApp, email: string, password: string): Promise<RecordModel> {
  const record = await app.findAuthRecordByEmail(SUPERUSERS_COLLECTION, email);
  if (!record) throw new Error(`superuser with email "${email}" doesn't exist`);

  record.set("password", await hashPassword(password));
  record.set("tokenKey", generateTokenKey());
  await app.save(record);
  return record;
}

/**
 * 删除超级用户（幂等：不存在时不报错）
 */
export async function superuserDelete(app: BaseApp, email: string): Promise<void> {
  const record = await app.findAuthRecordByEmail(SUPERUSERS_COLLECTION, email);
  if (!record) return;
  await app.delete(record);
}

/**
 * 为超级用户生成 OTP
 */
export async function superuserOTP(
  app: BaseApp,
  email: string,
): Promise<{ otpId: string; password: string; duration: number }> {
  const record = await app.findAuthRecordByEmail(SUPERUSERS_COLLECTION, email);
  if (!record) throw new Error(`superuser with email "${email}" doesn't exist`);

  const otpLength = 8;
  const otpDuration = 300; // 5 分钟
  const pass = randomStringWithAlphabet(otpLength, "1234567890");
  const otpId = generateId();

  // 存储 OTP 到 _otps 表
  const adapter = app.dbAdapter();
  const now = new Date().toISOString().replace("T", " ").slice(0, 23) + "Z";
  adapter.exec(
    `INSERT INTO _otps (id, collectionRef, recordRef, password, created, updated) VALUES (?, ?, ?, ?, ?, ?)`,
    otpId, record.collectionId, record.id, await hashPassword(pass), now, now,
  );

  return { otpId, password: pass, duration: otpDuration };
}

// ─── CLI 命令注册 ───

export function registerSuperuserCommand(program: Command, pl: PocketLess): void {
  const su = program.command("superuser").description("管理超级用户");

  su.command("create <email> <password>")
    .description("创建超级用户")
    .action(async (email: string, password: string, _opts: unknown, cmd: Command) => {
      const globalOpts = cmd.optsWithGlobals();
      pl.parseGlobalOptions(globalOpts);
      const app = await bootstrapApp(pl);
      try {
        const record = await superuserCreate(app, email, password);
        console.log(`Successfully created new superuser "${record.getEmail()}"!`);
      } finally {
        await app.shutdown();
      }
    });

  su.command("upsert <email> <password>")
    .description("创建或更新超级用户")
    .action(async (email: string, password: string, _opts: unknown, cmd: Command) => {
      const globalOpts = cmd.optsWithGlobals();
      pl.parseGlobalOptions(globalOpts);
      const app = await bootstrapApp(pl);
      try {
        const record = await superuserUpsert(app, email, password);
        console.log(`Successfully saved superuser "${record.getEmail()}"!`);
      } finally {
        await app.shutdown();
      }
    });

  su.command("update <email> <password>")
    .description("更新超级用户密码")
    .action(async (email: string, password: string, _opts: unknown, cmd: Command) => {
      const globalOpts = cmd.optsWithGlobals();
      pl.parseGlobalOptions(globalOpts);
      const app = await bootstrapApp(pl);
      try {
        const record = await superuserUpdate(app, email, password);
        console.log(`Successfully changed superuser "${record.getEmail()}" password!`);
      } finally {
        await app.shutdown();
      }
    });

  su.command("delete <email>")
    .description("删除超级用户")
    .action(async (email: string, _opts: unknown, cmd: Command) => {
      const globalOpts = cmd.optsWithGlobals();
      pl.parseGlobalOptions(globalOpts);
      const app = await bootstrapApp(pl);
      try {
        await superuserDelete(app, email);
        console.log(`Successfully deleted superuser "${email}"!`);
      } finally {
        await app.shutdown();
      }
    });

  su.command("otp <email>")
    .description("生成超级用户 OTP")
    .action(async (email: string, _opts: unknown, cmd: Command) => {
      const globalOpts = cmd.optsWithGlobals();
      pl.parseGlobalOptions(globalOpts);
      const app = await bootstrapApp(pl);
      try {
        const result = await superuserOTP(app, email);
        console.log(`Successfully created OTP for superuser "${email}":`);
        console.log(`├─ Id:    ${result.otpId}`);
        console.log(`├─ Pass:  ${result.password}`);
        console.log(`└─ Valid: ${result.duration}s`);
      } finally {
        await app.shutdown();
      }
    });
}

async function bootstrapApp(pl: PocketLess): Promise<BaseApp> {
  const { BaseApp } = await import("../core/base");
  const app = new BaseApp({
    dataDir: pl.dataDir,
    isDev: pl.isDev,
    pgDSN: pl.pgDSN || undefined,
    encryptionEnv: pl.encryptionEnv || undefined,
    queryTimeout: pl.queryTimeout,
  });
  await app.bootstrap();
  return app;
}
