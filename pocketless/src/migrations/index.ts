/**
 * 系统迁移索引 — 12 个系统迁移
 * 与 Go 版 migrations/ 对齐
 */

import type { DBAdapter } from "../core/db_adapter";
import { generateId } from "../tools/security/random";
import { DateTime } from "../tools/types/datetime";

export interface Migration {
  file: string;
  up: (mainAdapter: DBAdapter, auxAdapter: DBAdapter) => void;
  down?: (mainAdapter: DBAdapter, auxAdapter: DBAdapter) => void;
}

/** 获取所有系统迁移（按顺序） */
export function getSystemMigrations(): Migration[] {
  return [
    // 1. _params 表
    {
      file: "1_init_params.js",
      up: (adapter) => {
        adapter.exec(`
          CREATE TABLE IF NOT EXISTS _params (
            id      TEXT PRIMARY KEY,
            key     TEXT UNIQUE NOT NULL,
            value   JSON DEFAULT NULL,
            created TEXT DEFAULT '',
            updated TEXT DEFAULT ''
          )
        `);
      },
      down: (adapter) => {
        adapter.exec("DROP TABLE IF EXISTS _params");
      },
    },

    // 2. _collections 表
    {
      file: "2_init_collections.js",
      up: (adapter) => {
        adapter.exec(`
          CREATE TABLE IF NOT EXISTS _collections (
            id         TEXT PRIMARY KEY,
            type       TEXT NOT NULL DEFAULT 'base',
            name       TEXT UNIQUE NOT NULL,
            system     BOOLEAN DEFAULT FALSE,
            fields     JSON DEFAULT '[]',
            indexes    JSON DEFAULT '[]',
            created    TEXT DEFAULT '',
            updated    TEXT DEFAULT '',
            listRule   TEXT DEFAULT NULL,
            viewRule   TEXT DEFAULT NULL,
            createRule TEXT DEFAULT NULL,
            updateRule TEXT DEFAULT NULL,
            deleteRule TEXT DEFAULT NULL,
            options    JSON DEFAULT '{}'
          )
        `);
      },
      down: (adapter) => {
        adapter.exec("DROP TABLE IF EXISTS _collections");
      },
    },

    // 3. _superusers 表（Auth 集合）
    {
      file: "3_init_superusers.js",
      up: (adapter) => {
        adapter.exec(`
          CREATE TABLE IF NOT EXISTS _superusers (
            id              TEXT PRIMARY KEY,
            email           TEXT UNIQUE NOT NULL,
            emailVisibility BOOLEAN DEFAULT FALSE,
            verified        BOOLEAN DEFAULT FALSE,
            tokenKey        TEXT NOT NULL,
            password        TEXT NOT NULL,
            created         TEXT DEFAULT '',
            updated         TEXT DEFAULT ''
          )
        `);
        const id = generateId();
        const now = DateTime.now().toSQLite();
        const fields = JSON.stringify([
          { id: generateId(), name: "email", type: "email", required: true, options: {} },
          { id: generateId(), name: "emailVisibility", type: "bool", required: false, options: {} },
          { id: generateId(), name: "verified", type: "bool", required: false, options: {} },
          { id: generateId(), name: "tokenKey", type: "text", required: true, options: { hidden: true } },
          { id: generateId(), name: "password", type: "password", required: true, options: { cost: 12 } },
        ]);
        adapter.exec(
          `INSERT OR IGNORE INTO _collections (id, type, name, system, fields, created, updated) VALUES (?, 'auth', '_superusers', 1, ?, ?, ?)`,
          id, fields, now, now,
        );
      },
    },

    // 4. users 表（默认 Auth 集合）
    {
      file: "4_init_users.js",
      up: (adapter) => {
        adapter.exec(`
          CREATE TABLE IF NOT EXISTS users (
            id              TEXT PRIMARY KEY,
            email           TEXT UNIQUE,
            emailVisibility BOOLEAN DEFAULT FALSE,
            verified        BOOLEAN DEFAULT FALSE,
            tokenKey        TEXT NOT NULL,
            password        TEXT NOT NULL,
            name            TEXT DEFAULT '',
            avatar          TEXT DEFAULT '',
            created         TEXT DEFAULT '',
            updated         TEXT DEFAULT ''
          )
        `);
        const id = generateId();
        const now = DateTime.now().toSQLite();
        const fields = JSON.stringify([
          { id: generateId(), name: "email", type: "email", required: false, options: {} },
          { id: generateId(), name: "emailVisibility", type: "bool", required: false, options: {} },
          { id: generateId(), name: "verified", type: "bool", required: false, options: {} },
          { id: generateId(), name: "tokenKey", type: "text", required: true, options: { hidden: true } },
          { id: generateId(), name: "password", type: "password", required: true, options: { cost: 12 } },
          { id: generateId(), name: "name", type: "text", required: false, options: {} },
          { id: generateId(), name: "avatar", type: "file", required: false, options: { maxSelect: 1 } },
        ]);
        adapter.exec(
          `INSERT OR IGNORE INTO _collections (id, type, name, system, fields, created, updated) VALUES (?, 'auth', 'users', 0, ?, ?, ?)`,
          id, fields, now, now,
        );
      },
    },

    // 5. _mfas 表
    {
      file: "5_init_mfas.js",
      up: (adapter) => {
        adapter.exec(`
          CREATE TABLE IF NOT EXISTS _mfas (
            id            TEXT PRIMARY KEY,
            collectionRef TEXT NOT NULL,
            recordRef     TEXT NOT NULL,
            method        TEXT NOT NULL,
            created       TEXT DEFAULT '',
            updated       TEXT DEFAULT ''
          )
        `);
      },
    },

    // 6. _otps 表
    {
      file: "6_init_otps.js",
      up: (adapter) => {
        adapter.exec(`
          CREATE TABLE IF NOT EXISTS _otps (
            id            TEXT PRIMARY KEY,
            collectionRef TEXT NOT NULL,
            recordRef     TEXT NOT NULL,
            password      TEXT NOT NULL,
            sentTo        TEXT DEFAULT '',
            created       TEXT DEFAULT '',
            updated       TEXT DEFAULT ''
          )
        `);
      },
    },

    // 7. _externalAuths 表
    {
      file: "7_init_external_auths.js",
      up: (adapter) => {
        adapter.exec(`
          CREATE TABLE IF NOT EXISTS _externalAuths (
            id            TEXT PRIMARY KEY,
            collectionRef TEXT NOT NULL,
            recordRef     TEXT NOT NULL,
            provider      TEXT NOT NULL,
            providerId    TEXT NOT NULL,
            created       TEXT DEFAULT '',
            updated       TEXT DEFAULT ''
          )
        `);
        adapter.exec(`
          CREATE UNIQUE INDEX IF NOT EXISTS idx_externalAuths_provider_providerId
          ON _externalAuths (provider, providerId)
        `);
      },
    },

    // 8. _authOrigins 表
    {
      file: "8_init_auth_origins.js",
      up: (adapter) => {
        adapter.exec(`
          CREATE TABLE IF NOT EXISTS _authOrigins (
            id            TEXT PRIMARY KEY,
            collectionRef TEXT NOT NULL,
            recordRef     TEXT NOT NULL,
            fingerprint   TEXT NOT NULL,
            created       TEXT DEFAULT '',
            updated       TEXT DEFAULT ''
          )
        `);
      },
    },

    // 9. _logs 表（辅助数据库）
    {
      file: "9_init_logs.js",
      up: (_mainAdapter, auxAdapter) => {
        auxAdapter.exec(`
          CREATE TABLE IF NOT EXISTS _logs (
            id      TEXT PRIMARY KEY,
            level   INTEGER NOT NULL DEFAULT 0,
            message TEXT DEFAULT '',
            data    JSON DEFAULT '{}',
            created TEXT DEFAULT ''
          )
        `);
      },
    },

    // 10. 创建索引
    {
      file: "10_init_indexes.js",
      up: (adapter) => {
        adapter.exec(`CREATE INDEX IF NOT EXISTS idx_mfas_recordRef ON _mfas (recordRef)`);
        adapter.exec(`CREATE INDEX IF NOT EXISTS idx_otps_recordRef ON _otps (recordRef)`);
        adapter.exec(`CREATE INDEX IF NOT EXISTS idx_authOrigins_recordRef ON _authOrigins (recordRef)`);
      },
    },

    // 11. 初始化默认 Settings
    {
      file: "11_init_settings.js",
      up: (adapter) => {
        const now = DateTime.now().toSQLite();
        const defaultSettings = JSON.stringify({
          meta: {
            appName: "Pocketless",
            appURL: "http://localhost:8090",
            senderName: "Support",
            senderAddress: "support@example.com",
            hideControls: false,
          },
          smtp: { enabled: false, host: "", port: 587, username: "", password: "", tls: true },
          s3: { enabled: false, endpoint: "", bucket: "", region: "", accessKey: "", secret: "" },
          rateLimits: [],
          batch: { maxRequests: 50, timeout: 30 },
        });
        adapter.exec(
          `INSERT OR IGNORE INTO _params (id, key, value, created, updated) VALUES (?, 'settings', ?, ?, ?)`,
          generateId(), defaultSettings, now, now,
        );
      },
    },

    // 12. _logs 索引（辅助数据库）
    {
      file: "12_init_logs_indexes.js",
      up: (_mainAdapter, auxAdapter) => {
        auxAdapter.exec(`CREATE INDEX IF NOT EXISTS idx_logs_created ON _logs (created)`);
        auxAdapter.exec(`CREATE INDEX IF NOT EXISTS idx_logs_level ON _logs (level)`);
      },
    },
  ];
}
