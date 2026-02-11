/**
 * T162 — app.test.ts
 * App 接口完整性验证
 * 验证 BaseApp 实现了 App 接口的所有方法签名
 */

import { describe, expect, test } from "bun:test";
import { BaseApp } from "./base";

describe("App interface — BaseApp implementation", () => {
  const app = new BaseApp({ dataDir: "/tmp/test-app-interface", isDev: true });

  describe("lifecycle methods", () => {
    test("bootstrap is function", () => expect(typeof app.bootstrap).toBe("function"));
    test("shutdown is function", () => expect(typeof app.shutdown).toBe("function"));
    test("isBootstrapped is function", () => expect(typeof app.isBootstrapped).toBe("function"));
    test("isBootstrapped returns false initially", () => expect(app.isBootstrapped()).toBe(false));
  });

  describe("config methods", () => {
    test("dataDir returns string", () => expect(app.dataDir()).toBe("/tmp/test-app-interface"));
    test("isDev returns boolean", () => expect(app.isDev()).toBe(true));
    test("settings returns object", () => expect(typeof app.settings()).toBe("object"));
    test("encryptionEnv returns string", () => expect(typeof app.encryptionEnv()).toBe("string"));
  });

  describe("db methods exist (throw before bootstrap)", () => {
    test("db throws before init", () => expect(() => app.db()).toThrow());
    test("auxiliaryDB throws before init", () => expect(() => app.auxiliaryDB()).toThrow());
    test("dbAdapter throws before init", () => expect(() => app.dbAdapter()).toThrow());
    test("runInTransaction is function", () => expect(typeof app.runInTransaction).toBe("function"));
  });

  describe("CRUD methods", () => {
    test("save is function", () => expect(typeof app.save).toBe("function"));
    test("delete is function", () => expect(typeof app.delete).toBe("function"));
    test("validate is function", () => expect(typeof app.validate).toBe("function"));
  });

  describe("query methods", () => {
    test("findCollectionByNameOrId is function", () => expect(typeof app.findCollectionByNameOrId).toBe("function"));
    test("findAllCollections is function", () => expect(typeof app.findAllCollections).toBe("function"));
    test("findRecordById is function", () => expect(typeof app.findRecordById).toBe("function"));
    test("findRecordsByFilter is function", () => expect(typeof app.findRecordsByFilter).toBe("function"));
    test("countRecords is function", () => expect(typeof app.countRecords).toBe("function"));
    test("findAuthRecordByEmail is function", () => expect(typeof app.findAuthRecordByEmail).toBe("function"));
  });

  describe("store", () => {
    test("store returns Store instance", () => {
      const store = app.store();
      expect(store).toBeDefined();
      expect(typeof store.get).toBe("function");
      expect(typeof store.set).toBe("function");
      expect(typeof store.has).toBe("function");
      expect(typeof store.delete).toBe("function");
    });
  });

  describe("cron methods", () => {
    test("cronAdd is function", () => expect(typeof app.cronAdd).toBe("function"));
    test("cronRemove is function", () => expect(typeof app.cronRemove).toBe("function"));
    test("cronJobs is function", () => expect(typeof app.cronJobs).toBe("function"));
    test("cronJobs returns empty array initially", () => expect(app.cronJobs()).toEqual([]));
  });

  describe("Hook accessors — lifecycle", () => {
    test("onBootstrap returns Hook", () => {
      const hook = app.onBootstrap();
      expect(hook).toBeDefined();
      expect(typeof hook.bindFunc).toBe("function");
      expect(typeof hook.trigger).toBe("function");
    });
    test("onServe returns Hook", () => expect(typeof app.onServe().bindFunc).toBe("function"));
    test("onBeforeServe returns Hook", () => expect(typeof app.onBeforeServe().bindFunc).toBe("function"));
    test("onTerminate returns Hook", () => expect(typeof app.onTerminate().bindFunc).toBe("function"));
  });

  describe("Hook accessors — Model", () => {
    const modelHooks = [
      "onModelCreate", "onModelCreateExecute", "onModelAfterCreateSuccess", "onModelAfterCreateError",
      "onModelUpdate", "onModelUpdateExecute", "onModelAfterUpdateSuccess", "onModelAfterUpdateError",
      "onModelDelete", "onModelDeleteExecute", "onModelAfterDeleteSuccess", "onModelAfterDeleteError",
      "onModelValidate",
    ] as const;

    for (const name of modelHooks) {
      test(`${name} returns Hook`, () => {
        const hook = (app as any)[name]();
        expect(hook).toBeDefined();
        expect(typeof hook.bindFunc).toBe("function");
      });
    }
  });

  describe("Hook accessors — Record (tagged)", () => {
    const recordHooks = [
      "onRecordCreate", "onRecordCreateExecute", "onRecordAfterCreateSuccess",
      "onRecordUpdate", "onRecordUpdateExecute", "onRecordAfterUpdateSuccess",
      "onRecordDelete", "onRecordDeleteExecute", "onRecordAfterDeleteSuccess",
      "onRecordValidate",
    ] as const;

    for (const name of recordHooks) {
      test(`${name}() returns TaggedHook`, () => {
        const hook = (app as any)[name]();
        expect(hook).toBeDefined();
        expect(typeof hook.bindFunc).toBe("function");
      });

      test(`${name}("users") returns TaggedHookView`, () => {
        const view = (app as any)[name]("users");
        expect(view).toBeDefined();
        expect(typeof view.bindFunc).toBe("function");
        expect(typeof view.getTags).toBe("function");
        expect(view.getTags()).toContain("users");
      });
    }
  });

  describe("Hook accessors — Collection", () => {
    const colHooks = [
      "onCollectionCreate", "onCollectionCreateExecute", "onCollectionAfterCreateSuccess",
      "onCollectionUpdate", "onCollectionUpdateExecute", "onCollectionAfterUpdateSuccess",
      "onCollectionDelete", "onCollectionDeleteExecute", "onCollectionAfterDeleteSuccess",
      "onCollectionValidate",
    ] as const;

    for (const name of colHooks) {
      test(`${name} returns Hook`, () => {
        const hook = (app as any)[name]();
        expect(hook).toBeDefined();
        expect(typeof hook.bindFunc).toBe("function");
      });
    }
  });

  describe("Hook accessors — Mail", () => {
    const mailHooks = [
      "onMailerSend",
      "onMailerRecordPasswordResetSend",
      "onMailerRecordVerificationSend",
      "onMailerRecordEmailChangeSend",
      "onMailerRecordOTPSend",
      "onMailerRecordAuthAlertSend",
    ] as const;

    for (const name of mailHooks) {
      test(`${name}() returns TaggedHook`, () => {
        const hook = (app as any)[name]();
        expect(hook).toBeDefined();
        expect(typeof hook.bindFunc).toBe("function");
      });
    }
  });
});
