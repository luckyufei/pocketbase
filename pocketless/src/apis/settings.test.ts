/**
 * T169 — settings.test.ts
 * 对照 Go 版 apis/settings_test.go
 * 测试 Settings API 5 个路由端点
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { Hono } from "hono";
import { registerSettingsRoutes } from "./settings";
import { toApiError } from "./errors";
import { BaseApp } from "../core/base";
import { SQLiteAdapter } from "../core/db_adapter_sqlite";
import { tmpdir } from "node:os";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";

function createTestApp(): { app: BaseApp; hono: Hono; tmpDir: string } {
  const tmpDir = mkdtempSync(join(tmpdir(), "pb-set-"));
  const app = new BaseApp({ dataDir: tmpDir, isDev: true });
  const adapter = new SQLiteAdapter(":memory:");
  (app as any)._adapter = adapter;
  (app as any)._auxiliaryAdapter = adapter;

  const hono = new Hono();
  hono.onError((err, c) => {
    const apiErr = toApiError(err);
    return c.json(apiErr.toJSON(), apiErr.status as any);
  });
  registerSettingsRoutes(hono, app);
  return { app, hono, tmpDir };
}

describe("Settings API", () => {
  let baseApp: BaseApp;
  let hono: Hono;
  let tmpDir: string;

  beforeEach(() => {
    const result = createTestApp();
    baseApp = result.app;
    hono = result.hono;
    tmpDir = result.tmpDir;
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  // ─── GET /api/settings ───

  describe("GET /api/settings", () => {
    test("returns default settings", async () => {
      const res = await hono.request("/api/settings");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty("meta");
      expect(body).toHaveProperty("smtp");
      expect(body).toHaveProperty("s3");
      expect(body).toHaveProperty("backups");
      expect(body).toHaveProperty("batch");
      expect(body).toHaveProperty("logs");
    });

    test("default meta has appName", async () => {
      const res = await hono.request("/api/settings");
      const body = await res.json();
      expect(body.meta.appName).toBeDefined();
      expect(typeof body.meta.appName).toBe("string");
    });

    test("sensitive fields are masked in toJSON", async () => {
      // 先通过 PATCH 设置带密码的 SMTP
      await hono.request("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          smtp: { enabled: true, host: "smtp.test.com", password: "secret123" },
        }),
      });

      const res = await hono.request("/api/settings");
      const body = await res.json();
      // toJSON 会掩码 password（Settings.toJSON 将 password 清空）
      expect(body.smtp).toBeDefined();
      expect(body.smtp.password).toBe("");
      // host 应该保留
      expect(body.smtp.host).toBe("smtp.test.com");
    });
  });

  // ─── PATCH /api/settings ───

  describe("PATCH /api/settings", () => {
    test("partial update meta", async () => {
      const res = await hono.request("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meta: { appName: "MyApp" } }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.meta.appName).toBe("MyApp");
    });

    test("partial update smtp", async () => {
      const res = await hono.request("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ smtp: { host: "new.smtp.com" } }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.smtp.host).toBe("new.smtp.com");
    });

    test("empty body does not throw", async () => {
      const res = await hono.request("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(200);
    });
  });

  // ─── POST /api/settings/test/s3 ───

  describe("POST /api/settings/test/s3", () => {
    test("valid filesystem=storage → 204", async () => {
      const res = await hono.request("/api/settings/test/s3", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filesystem: "storage" }),
      });
      expect(res.status).toBe(204);
    });

    test("valid filesystem=backups → 204", async () => {
      const res = await hono.request("/api/settings/test/s3", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filesystem: "backups" }),
      });
      expect(res.status).toBe(204);
    });

    test("invalid filesystem → 400", async () => {
      const res = await hono.request("/api/settings/test/s3", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filesystem: "invalid" }),
      });
      expect(res.status).toBe(400);
    });

    test("missing filesystem → 400", async () => {
      const res = await hono.request("/api/settings/test/s3", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
    });
  });

  // ─── POST /api/settings/test/email ───

  describe("POST /api/settings/test/email", () => {
    test("valid request → 204", async () => {
      const res = await hono.request("/api/settings/test/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "test@example.com", template: "verification" }),
      });
      expect(res.status).toBe(204);
    });

    test("all valid templates", async () => {
      for (const template of ["verification", "password-reset", "email-change", "otp", "login-alert"]) {
        const res = await hono.request("/api/settings/test/email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "test@example.com", template }),
        });
        expect(res.status).toBe(204);
      }
    });

    test("missing email → 400", async () => {
      const res = await hono.request("/api/settings/test/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template: "verification" }),
      });
      expect(res.status).toBe(400);
    });

    test("invalid template → 400", async () => {
      const res = await hono.request("/api/settings/test/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "test@example.com", template: "invalid" }),
      });
      expect(res.status).toBe(400);
    });

    test("missing template → 400", async () => {
      const res = await hono.request("/api/settings/test/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "test@example.com" }),
      });
      expect(res.status).toBe(400);
    });
  });

  // ─── T027: Hook 触发测试 ───

  describe("Hook triggers (T027)", () => {
    test("GET /api/settings triggers onSettingsListRequest", async () => {
      let hookCalled = false;
      baseApp.onSettingsListRequest().bindFunc(async (e) => {
        hookCalled = true;
        await e.next();
      });

      const res = await hono.request("/api/settings");
      expect(res.status).toBe(200);
      expect(hookCalled).toBe(true);
    });

    test("PATCH /api/settings triggers onSettingsUpdateRequest", async () => {
      let hookCalled = false;
      let capturedOldSettings: any = null;
      let capturedNewSettings: any = null;
      baseApp.onSettingsUpdateRequest().bindFunc(async (e) => {
        hookCalled = true;
        capturedOldSettings = (e as any).oldSettings;
        capturedNewSettings = (e as any).newSettings;
        await e.next();
      });

      const res = await hono.request("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meta: { appName: "HookTest" } }),
      });
      expect(res.status).toBe(200);
      expect(hookCalled).toBe(true);
      expect(capturedOldSettings).toBeDefined();
      expect(capturedNewSettings).toBeDefined();
    });

    test("onSettingsListRequest hook can modify response", async () => {
      baseApp.onSettingsListRequest().bindFunc(async (e) => {
        // 修改 settings 数据
        (e as any).settings.meta = { appName: "Modified by hook" };
        await e.next();
      });

      const res = await hono.request("/api/settings");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.meta.appName).toBe("Modified by hook");
    });
  });

  // ─── POST /api/settings/apple/generate-client-secret ───

  describe("POST /api/settings/apple/generate-client-secret", () => {
    test("valid request → returns secret", async () => {
      const res = await hono.request("/api/settings/apple/generate-client-secret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: "com.example.app",
          teamId: "TEAMID1234",
          keyId: "KEYID12345",
          privateKey: "-----BEGIN PRIVATE KEY-----\nfakekey\n-----END PRIVATE KEY-----",
          duration: 15777000,
        }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.secret).toBeDefined();
      expect(typeof body.secret).toBe("string");
    });

    test("missing clientId → 400", async () => {
      const res = await hono.request("/api/settings/apple/generate-client-secret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId: "T", keyId: "K", privateKey: "P",
        }),
      });
      expect(res.status).toBe(400);
    });

    test("missing all fields → 400", async () => {
      const res = await hono.request("/api/settings/apple/generate-client-secret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
    });
  });
});
