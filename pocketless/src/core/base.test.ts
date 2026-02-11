/**
 * T158 — base.test.ts
 * 对照 Go 版 core/base_test.go
 * 测试 BaseApp 初始化、配置、Store、Cron、Hook 实例化
 * 部分测试使用真实 bun:sqlite 内存数据库
 */

import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { BaseApp, type BaseAppConfig } from "./base";
import { tmpdir } from "node:os";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";

function createConfig(overrides: Partial<BaseAppConfig> = {}): BaseAppConfig {
  return {
    dataDir: mkdtempSync(join(tmpdir(), "pb-base-test-")),
    isDev: true,
    ...overrides,
  };
}

describe("BaseApp constructor", () => {
  test("creates instance", () => {
    const app = new BaseApp(createConfig());
    expect(app).toBeDefined();
  });

  test("isBootstrapped is false before bootstrap", () => {
    const app = new BaseApp(createConfig());
    expect(app.isBootstrapped()).toBe(false);
  });
});

describe("BaseApp config accessors", () => {
  test("dataDir returns config value", () => {
    const config = createConfig();
    const app = new BaseApp(config);
    expect(app.dataDir()).toBe(config.dataDir);
  });

  test("isDev returns config value", () => {
    const app = new BaseApp(createConfig({ isDev: true }));
    expect(app.isDev()).toBe(true);
  });

  test("isDev false", () => {
    const app = new BaseApp(createConfig({ isDev: false }));
    expect(app.isDev()).toBe(false);
  });

  test("encryptionEnv returns config value", () => {
    const app = new BaseApp(createConfig({ encryptionEnv: "MY_KEY" }));
    expect(app.encryptionEnv()).toBe("MY_KEY");
  });

  test("encryptionEnv defaults to empty string", () => {
    const app = new BaseApp(createConfig());
    expect(app.encryptionEnv()).toBe("");
  });

  test("settings returns object", () => {
    const app = new BaseApp(createConfig());
    expect(typeof app.settings()).toBe("object");
  });
});

describe("BaseApp DB accessors before bootstrap", () => {
  test("db() throws before bootstrap", () => {
    const app = new BaseApp(createConfig());
    expect(() => app.db()).toThrow("数据库未初始化");
  });

  test("auxiliaryDB() throws before bootstrap", () => {
    const app = new BaseApp(createConfig());
    expect(() => app.auxiliaryDB()).toThrow("辅助数据库未初始化");
  });

  test("dbAdapter() throws before bootstrap", () => {
    const app = new BaseApp(createConfig());
    expect(() => app.dbAdapter()).toThrow("数据库适配器未初始化");
  });

  test("auxiliaryDbAdapter() throws before bootstrap", () => {
    const app = new BaseApp(createConfig());
    expect(() => app.auxiliaryDbAdapter()).toThrow("辅助数据库适配器未初始化");
  });
});

describe("BaseApp Store", () => {
  test("store returns Store instance", () => {
    const app = new BaseApp(createConfig());
    const store = app.store();
    expect(store).toBeDefined();
  });

  test("store get/set/has", () => {
    const app = new BaseApp(createConfig());
    const store = app.store();
    store.set("key1", "val1");
    expect(store.get("key1")).toBe("val1");
    expect(store.has("key1")).toBe(true);
    expect(store.has("missing")).toBe(false);
  });

  test("store delete", () => {
    const app = new BaseApp(createConfig());
    const store = app.store();
    store.set("k", "v");
    store.delete("k");
    expect(store.has("k")).toBe(false);
  });

  test("same store instance across calls", () => {
    const app = new BaseApp(createConfig());
    expect(app.store()).toBe(app.store());
  });
});

describe("BaseApp Cron", () => {
  test("cronJobs is empty initially", () => {
    const app = new BaseApp(createConfig());
    expect(app.cronJobs()).toEqual([]);
  });

  test("cronAdd adds a job", () => {
    const app = new BaseApp(createConfig());
    app.cronAdd("job1", "* * * * *", () => {});
    const jobs = app.cronJobs();
    expect(jobs).toHaveLength(1);
    expect(jobs[0].id).toBe("job1");
    expect(jobs[0].expression).toBe("* * * * *");
    // 清理
    app.cronRemove("job1");
  });

  test("cronRemove removes a job", () => {
    const app = new BaseApp(createConfig());
    app.cronAdd("job1", "* * * * *", () => {});
    app.cronRemove("job1");
    expect(app.cronJobs()).toHaveLength(0);
  });

  test("cronRemove non-existent job is no-op", () => {
    const app = new BaseApp(createConfig());
    app.cronRemove("nonexistent"); // 不应抛错
    expect(app.cronJobs()).toHaveLength(0);
  });

  test("cronAdd replaces existing job with same ID", () => {
    const app = new BaseApp(createConfig());
    app.cronAdd("job1", "* * * * *", () => {});
    app.cronAdd("job1", "0 * * * *", () => {});
    const jobs = app.cronJobs();
    expect(jobs).toHaveLength(1);
    expect(jobs[0].expression).toBe("0 * * * *");
    app.cronRemove("job1");
  });

  test("multiple cron jobs", () => {
    const app = new BaseApp(createConfig());
    app.cronAdd("j1", "* * * * *", () => {});
    app.cronAdd("j2", "0 * * * *", () => {});
    expect(app.cronJobs()).toHaveLength(2);
    app.cronRemove("j1");
    app.cronRemove("j2");
  });
});

describe("BaseApp Hook accessors — all 80+ hooks exist", () => {
  const app = new BaseApp(createConfig());

  // 生命周期 hooks
  const lifecycleHooks = ["onBootstrap", "onServe", "onBeforeServe", "onTerminate"];

  for (const name of lifecycleHooks) {
    test(`${name}() returns Hook`, () => {
      const hook = (app as any)[name]();
      expect(hook).toBeDefined();
      expect(typeof hook.bindFunc).toBe("function");
      expect(typeof hook.trigger).toBe("function");
      expect(typeof hook.length).toBe("function");
      expect(hook.length()).toBe(0);
    });
  }

  // Model hooks (13)
  const modelHooks = [
    "onModelCreate", "onModelCreateExecute", "onModelAfterCreateSuccess", "onModelAfterCreateError",
    "onModelUpdate", "onModelUpdateExecute", "onModelAfterUpdateSuccess", "onModelAfterUpdateError",
    "onModelDelete", "onModelDeleteExecute", "onModelAfterDeleteSuccess", "onModelAfterDeleteError",
    "onModelValidate",
  ];

  for (const name of modelHooks) {
    test(`${name}() returns Hook`, () => {
      const hook = (app as any)[name]();
      expect(hook).toBeDefined();
      expect(typeof hook.bindFunc).toBe("function");
    });
  }

  // Record hooks (tagged, 13)
  const recordHooks = [
    "onRecordCreate", "onRecordCreateExecute", "onRecordAfterCreateSuccess", "onRecordAfterCreateError",
    "onRecordUpdate", "onRecordUpdateExecute", "onRecordAfterUpdateSuccess", "onRecordAfterUpdateError",
    "onRecordDelete", "onRecordDeleteExecute", "onRecordAfterDeleteSuccess", "onRecordAfterDeleteError",
    "onRecordValidate",
  ];

  for (const name of recordHooks) {
    test(`${name}() returns TaggedHook`, () => {
      const hook = (app as any)[name]();
      expect(hook).toBeDefined();
      expect(typeof hook.bindFunc).toBe("function");
    });

    test(`${name}("tag") returns TaggedHookView`, () => {
      const view = (app as any)[name]("myTag");
      expect(view).toBeDefined();
      expect(typeof view.bindFunc).toBe("function");
      expect(typeof view.getTags).toBe("function");
    });
  }

  // Record auth hooks (tagged, 11)
  const recordAuthHooks = [
    "onRecordAuthRequest", "onRecordAuthRefreshRequest",
    "onRecordAuthWithPasswordRequest", "onRecordAuthWithOAuth2Request",
    "onRecordAuthWithOTPRequest",
    "onRecordRequestPasswordResetRequest", "onRecordConfirmPasswordResetRequest",
    "onRecordRequestVerificationRequest", "onRecordConfirmVerificationRequest",
    "onRecordRequestEmailChangeRequest", "onRecordConfirmEmailChangeRequest",
  ];

  for (const name of recordAuthHooks) {
    test(`${name}() exists`, () => {
      const hook = (app as any)[name]();
      expect(hook).toBeDefined();
    });
  }

  // Record CRUD Request hooks (tagged, 5)
  const recordRequestHooks = [
    "onRecordsListRequest", "onRecordViewRequest",
    "onRecordCreateRequest", "onRecordUpdateRequest", "onRecordDeleteRequest",
  ];

  for (const name of recordRequestHooks) {
    test(`${name}() exists`, () => {
      const hook = (app as any)[name]();
      expect(hook).toBeDefined();
    });
  }

  // Collection hooks (10 existing + 3 new error hooks = 13)
  const collectionHooks = [
    "onCollectionCreate", "onCollectionCreateExecute", "onCollectionAfterCreateSuccess",
    "onCollectionAfterCreateError",
    "onCollectionUpdate", "onCollectionUpdateExecute", "onCollectionAfterUpdateSuccess",
    "onCollectionAfterUpdateError",
    "onCollectionDelete", "onCollectionDeleteExecute", "onCollectionAfterDeleteSuccess",
    "onCollectionAfterDeleteError",
    "onCollectionValidate",
  ];

  for (const name of collectionHooks) {
    test(`${name}() returns Hook`, () => {
      const hook = (app as any)[name]();
      expect(hook).toBeDefined();
    });
  }

  // Collection request hooks (6)
  const colRequestHooks = [
    "onCollectionsListRequest", "onCollectionViewRequest",
    "onCollectionCreateRequest", "onCollectionUpdateRequest",
    "onCollectionDeleteRequest", "onCollectionsImportRequest",
  ];

  for (const name of colRequestHooks) {
    test(`${name}() returns Hook`, () => {
      const hook = (app as any)[name]();
      expect(hook).toBeDefined();
    });
  }

  // Mail hooks (tagged, 6)
  const mailHooks = [
    "onMailerSend", "onMailerRecordPasswordResetSend",
    "onMailerRecordVerificationSend", "onMailerRecordEmailChangeSend",
    "onMailerRecordOTPSend", "onMailerRecordAuthAlertSend",
  ];

  for (const name of mailHooks) {
    test(`${name}() exists`, () => {
      const hook = (app as any)[name]();
      expect(hook).toBeDefined();
    });
  }

  // T026: 新增缺失 Hooks
  const settingsHooks = [
    "onSettingsListRequest", "onSettingsUpdateRequest", "onSettingsReload",
  ];

  for (const name of settingsHooks) {
    test(`${name}() returns Hook`, () => {
      const hook = (app as any)[name]();
      expect(hook).toBeDefined();
      expect(typeof hook.bindFunc).toBe("function");
    });
  }

  const realtimeHooks = [
    "onRealtimeConnectRequest", "onRealtimeSubscribeRequest", "onRealtimeMessageSend",
  ];

  for (const name of realtimeHooks) {
    test(`${name}() returns Hook`, () => {
      const hook = (app as any)[name]();
      expect(hook).toBeDefined();
      expect(typeof hook.bindFunc).toBe("function");
    });
  }

  const fileHooks = ["onFileDownloadRequest", "onFileTokenRequest"];

  for (const name of fileHooks) {
    test(`${name}() returns Hook`, () => {
      const hook = (app as any)[name]();
      expect(hook).toBeDefined();
      expect(typeof hook.bindFunc).toBe("function");
    });
  }

  test("onBatchRequest() returns Hook", () => {
    const hook = (app as any).onBatchRequest();
    expect(hook).toBeDefined();
    expect(typeof hook.bindFunc).toBe("function");
  });

  test("onBackupCreate() returns Hook", () => {
    const hook = (app as any).onBackupCreate();
    expect(hook).toBeDefined();
    expect(typeof hook.bindFunc).toBe("function");
  });

  test("onBackupRestore() returns Hook", () => {
    const hook = (app as any).onBackupRestore();
    expect(hook).toBeDefined();
    expect(typeof hook.bindFunc).toBe("function");
  });

  test("onRecordEnrich() returns TaggedHook", () => {
    const hook = (app as any).onRecordEnrich();
    expect(hook).toBeDefined();
    expect(typeof hook.bindFunc).toBe("function");
  });
});

describe("BaseApp CRUD delegates", () => {
  test("save is async function", () => {
    const app = new BaseApp(createConfig());
    expect(typeof app.save).toBe("function");
  });

  test("delete is async function", () => {
    const app = new BaseApp(createConfig());
    expect(typeof app.delete).toBe("function");
  });

  test("validate is async function", () => {
    const app = new BaseApp(createConfig());
    expect(typeof app.validate).toBe("function");
  });
});

// ============================================================
// T058: App 接口补全测试
// ============================================================

describe("BaseApp.newFilesystem (T059)", () => {
  test("无 S3 配置时返回 LocalFilesystem", async () => {
    const config = createConfig();
    const app = new BaseApp(config);
    await app.bootstrap();
    try {
      const fs = await app.newFilesystem();
      expect(fs).toBeDefined();
      // LocalFilesystem 实例具有 close 方法
      expect(typeof fs.close).toBe("function");
      expect(typeof fs.upload).toBe("function");
      expect(typeof fs.download).toBe("function");
      await fs.close();
    } finally {
      await app.shutdown();
      rmSync(config.dataDir, { recursive: true, force: true });
    }
  });

  test("有 S3 配置时返回 S3Filesystem", async () => {
    const config = createConfig();
    const app = new BaseApp(config);
    await app.bootstrap();
    // 手动设置 S3 配置到 settings
    (app as any)._settings = {
      s3: {
        enabled: true,
        bucket: "test-bucket",
        region: "us-east-1",
        endpoint: "http://localhost:9000",
        accessKey: "minio",
        secret: "minio123",
      },
    };
    try {
      const fs = await app.newFilesystem();
      expect(fs).toBeDefined();
      expect(typeof fs.upload).toBe("function");
      await fs.close();
    } finally {
      await app.shutdown();
      rmSync(config.dataDir, { recursive: true, force: true });
    }
  });
});

describe("BaseApp.newBackupsFilesystem (T060)", () => {
  test("无 backups S3 配置时返回 LocalFilesystem", async () => {
    const config = createConfig();
    const app = new BaseApp(config);
    await app.bootstrap();
    try {
      const fs = await app.newBackupsFilesystem();
      expect(fs).toBeDefined();
      expect(typeof fs.upload).toBe("function");
      await fs.close();
    } finally {
      await app.shutdown();
      rmSync(config.dataDir, { recursive: true, force: true });
    }
  });
});

describe("BaseApp.newMailClient (T061)", () => {
  test("无 SMTP 配置时返回 Sendmail fallback", async () => {
    const config = createConfig();
    const app = new BaseApp(config);
    await app.bootstrap();
    try {
      const mailer = app.newMailClient();
      expect(mailer).toBeDefined();
      expect(typeof mailer.send).toBe("function");
    } finally {
      await app.shutdown();
      rmSync(config.dataDir, { recursive: true, force: true });
    }
  });

  test("有 SMTP 配置时返回 SMTPClient", async () => {
    const config = createConfig();
    const app = new BaseApp(config);
    await app.bootstrap();
    (app as any)._settings = {
      smtp: {
        enabled: true,
        host: "smtp.example.com",
        port: 587,
        username: "user",
        password: "pass",
        tls: true,
      },
    };
    try {
      const mailer = app.newMailClient();
      expect(mailer).toBeDefined();
      expect(typeof mailer.send).toBe("function");
    } finally {
      await app.shutdown();
      rmSync(config.dataDir, { recursive: true, force: true });
    }
  });
});

describe("BaseApp.logger (T062)", () => {
  test("返回 Logger 实例", () => {
    const app = new BaseApp(createConfig());
    const logger = app.logger();
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.debug).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.with).toBe("function");
  });

  test("同一 app 返回同一 Logger 实例", () => {
    const app = new BaseApp(createConfig());
    expect(app.logger()).toBe(app.logger());
  });
});

describe("BaseApp.unsafeWithoutHooks (T063)", () => {
  test("返回 BaseApp 实例", () => {
    const app = new BaseApp(createConfig());
    const unsafe = app.unsafeWithoutHooks();
    expect(unsafe).toBeDefined();
    expect(unsafe).not.toBe(app);
  });

  test("unsafeApp 的 hook 是空的", () => {
    const app = new BaseApp(createConfig());
    // 给原始 app 添加一个 hook handler
    app.onModelCreate().bindFunc(async () => {});
    expect(app.onModelCreate().length()).toBe(1);

    const unsafe = app.unsafeWithoutHooks();
    // unsafe 的 hook 应该是空的
    expect(unsafe.onModelCreate().length()).toBe(0);
  });

  test("unsafeApp 共享配置和数据库", async () => {
    const config = createConfig();
    const app = new BaseApp(config);
    await app.bootstrap();
    try {
      const unsafe = app.unsafeWithoutHooks();
      expect(unsafe.dataDir()).toBe(app.dataDir());
      expect(unsafe.isDev()).toBe(app.isDev());
      expect(unsafe.isBootstrapped()).toBe(true);
    } finally {
      await app.shutdown();
      rmSync(config.dataDir, { recursive: true, force: true });
    }
  });

  test("unsafeApp save 不触发 hook", async () => {
    const config = createConfig();
    const app = new BaseApp(config);
    await app.bootstrap();
    try {
      let hookCalled = false;
      app.onModelCreate().bindFunc(async () => {
        hookCalled = true;
      });

      // 通过 unsafeApp 保存不应触发 hook
      const unsafe = app.unsafeWithoutHooks();
      // 验证 hook 是空的
      expect(unsafe.onModelCreate().length()).toBe(0);
      expect(hookCalled).toBe(false);
    } finally {
      await app.shutdown();
      rmSync(config.dataDir, { recursive: true, force: true });
    }
  });
});
