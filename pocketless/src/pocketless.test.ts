/**
 * PocketLess 类测试 — 构造、CLI 集成、dev 模式检测
 * T204
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { PocketLess } from "./pocketless";

describe("PocketLess 构造", () => {
  test("创建实例", () => {
    const pl = new PocketLess();
    expect(pl).toBeDefined();
  });

  test("默认 app 为 null", () => {
    const pl = new PocketLess();
    expect(pl.app).toBeNull();
  });

  test("默认 dataDir", () => {
    const pl = new PocketLess();
    expect(pl.dataDir).toBe("./pb_data");
  });

  test("默认 httpAddr", () => {
    const pl = new PocketLess();
    expect(pl.httpAddr).toBe("127.0.0.1:8090");
  });

  test("默认 queryTimeout", () => {
    const pl = new PocketLess();
    expect(pl.queryTimeout).toBe(30);
  });

  test("默认 encryptionEnv 为空", () => {
    const pl = new PocketLess();
    expect(pl.encryptionEnv).toBe("");
  });
});

describe("PocketLess dev 模式检测", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    // 恢复环境变量
    process.env.BUN_ENV = originalEnv.BUN_ENV;
    process.env.PB_DEV = originalEnv.PB_DEV;
  });

  test("默认非 dev 模式（无环境变量）", () => {
    delete process.env.BUN_ENV;
    delete process.env.PB_DEV;
    const pl = new PocketLess();
    expect(pl.isDev).toBe(false);
  });

  test("BUN_ENV=development 启用 dev 模式", () => {
    process.env.BUN_ENV = "development";
    const pl = new PocketLess();
    expect(pl.isDev).toBe(true);
  });

  test("PB_DEV=true 启用 dev 模式", () => {
    delete process.env.BUN_ENV;
    process.env.PB_DEV = "true";
    const pl = new PocketLess();
    expect(pl.isDev).toBe(true);
  });

  test("PB_DEV=1 启用 dev 模式", () => {
    delete process.env.BUN_ENV;
    process.env.PB_DEV = "1";
    const pl = new PocketLess();
    expect(pl.isDev).toBe(true);
  });
});

describe("PocketLess.parseGlobalOptions", () => {
  test("解析 dir 选项", () => {
    const pl = new PocketLess();
    pl.parseGlobalOptions({ dir: "/custom/path" });
    expect(pl.dataDir).toBe("/custom/path");
  });

  test("解析 dev 选项", () => {
    const pl = new PocketLess();
    pl.parseGlobalOptions({ dev: true });
    expect(pl.isDev).toBe(true);
  });

  test("解析 http 选项", () => {
    const pl = new PocketLess();
    pl.parseGlobalOptions({ http: "0.0.0.0:9090" });
    expect(pl.httpAddr).toBe("0.0.0.0:9090");
  });

  test("解析 queryTimeout 选项", () => {
    const pl = new PocketLess();
    pl.parseGlobalOptions({ queryTimeout: "60" });
    expect(pl.queryTimeout).toBe(60);
  });

  test("解析 encryptionEnv 选项", () => {
    const pl = new PocketLess();
    pl.parseGlobalOptions({ encryptionEnv: "PB_ENCRYPTION_KEY" });
    expect(pl.encryptionEnv).toBe("PB_ENCRYPTION_KEY");
  });

  test("不设置的选项保持默认", () => {
    const pl = new PocketLess();
    pl.parseGlobalOptions({});
    expect(pl.dataDir).toBe("./pb_data");
    expect(pl.httpAddr).toBe("127.0.0.1:8090");
    expect(pl.queryTimeout).toBe(30);
  });
});

describe("PocketLess.setApp", () => {
  test("设置并获取 app", () => {
    const pl = new PocketLess();
    const mockApp = { isTransactional: false } as any;
    pl.setApp(mockApp);
    expect(pl.app).toBe(mockApp);
  });
});

describe("PocketLess.pgDSN", () => {
  const originalEnv = process.env.PB_POSTGRES_DSN;

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.PB_POSTGRES_DSN = originalEnv;
    } else {
      delete process.env.PB_POSTGRES_DSN;
    }
  });

  test("默认空字符串", () => {
    delete process.env.PB_POSTGRES_DSN;
    const pl = new PocketLess();
    expect(pl.pgDSN).toBe("");
  });

  test("通过 parseGlobalOptions 设置", () => {
    const pl = new PocketLess();
    pl.parseGlobalOptions({ pg: "postgres://localhost:5432/test" });
    expect(pl.pgDSN).toBe("postgres://localhost:5432/test");
  });

  test("通过环境变量 fallback", () => {
    process.env.PB_POSTGRES_DSN = "postgres://env:5432/db";
    const pl = new PocketLess();
    expect(pl.pgDSN).toBe("postgres://env:5432/db");
  });
});
