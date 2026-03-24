/**
 * Installer — 与 Go 版 apis/installer.go 对齐
 * 首次启动时，如果没有超级用户记录，生成一个安装器 URL 供用户创建首个超级用户。
 */

import type { BaseApp } from "../core/base";
import type { RecordModel } from "../core/record_model";
import { newStaticAuthToken } from "../core/tokens";
import { generateId, generateTokenKey } from "../tools/security/random";
import { hashPassword } from "../tools/security/password";

const SUPERUSERS_COLLECTION = "_superusers";
const DEFAULT_INSTALLER_EMAIL = "__pbinstaller@example.com";

/**
 * DefaultInstallerFunc — the default installer function.
 * Generates a short-lived auth token for the system superuser
 * and prints the installer URL to the console.
 */
export async function defaultInstallerFunc(
  app: BaseApp,
  systemSuperuser: RecordModel,
  baseURL: string,
): Promise<void> {
  const token = await newStaticAuthToken(systemSuperuser, 30 * 60); // 30 minutes

  const url = `${baseURL.replace(/\/+$/, "")}/_/pbinstall/${token}`;

  console.log(
    "\n\x1b[35m(!) Launch the URL below in the browser if it hasn't been open already to create your first superuser account:\x1b[0m",
  );
  console.log(`\x1b[1m\x1b[36m${url}\x1b[0m`);
  console.log(
    `\x1b[90m\x1b[3m(you can also create your first superuser by running: pocketless superuser upsert EMAIL PASS)\x1b[0m\n`,
  );
}

/**
 * loadInstaller — checks if installer is needed and runs the installer function.
 * Called after the server starts listening.
 */
export async function loadInstaller(
  app: BaseApp,
  baseURL: string,
  installerFunc?: typeof defaultInstallerFunc,
): Promise<void> {
  const fn = installerFunc ?? defaultInstallerFunc;

  if (!needInstallerSuperuser(app)) {
    return;
  }

  const superuser = await findOrCreateInstallerSuperuser(app);
  if (!superuser) {
    console.warn("Failed to create installer superuser");
    return;
  }

  await fn(app, superuser, baseURL);
}

/**
 * needInstallerSuperuser — returns true if there are no superuser records
 * other than the default installer email.
 */
function needInstallerSuperuser(app: BaseApp): boolean {
  try {
    const adapter = app.dbAdapter();
    const row = adapter.queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM ${SUPERUSERS_COLLECTION} WHERE email != ?`,
      DEFAULT_INSTALLER_EMAIL,
    );
    return (row?.count ?? 0) === 0;
  } catch {
    return false;
  }
}

/**
 * findOrCreateInstallerSuperuser — finds or creates the system installer superuser.
 */
async function findOrCreateInstallerSuperuser(app: BaseApp): Promise<RecordModel | null> {
  // Try to find existing installer superuser
  const existing = await app.findAuthRecordByEmail(SUPERUSERS_COLLECTION, DEFAULT_INSTALLER_EMAIL);
  if (existing) {
    return existing;
  }

  // Create a new installer superuser
  try {
    const col = await app.findCollectionByNameOrId(SUPERUSERS_COLLECTION);
    if (!col) return null;

    const { RecordModel } = await import("../core/record_model");
    const record = new RecordModel(col);
    record.id = generateId();
    record.setEmail(DEFAULT_INSTALLER_EMAIL);
    record.set("password", await hashPassword(generateTokenKey())); // random password
    record.set("tokenKey", generateTokenKey());
    record.set("verified", false);

    await app.save(record);
    return record;
  } catch (err) {
    console.warn("Failed to create installer superuser:", err);
    return null;
  }
}
