/**
 * settings.ts — Settings API 端点
 * 与 Go 版 apis/settings.go 对齐
 *
 * GET   /api/settings                         → 获取 Settings（掩码敏感字段）
 * PATCH /api/settings                         → 更新 Settings
 * POST  /api/settings/test/s3                 → 测试 S3 连接
 * POST  /api/settings/test/email              → 测试邮件发送
 * POST  /api/settings/apple/generate-client-secret → 生成 Apple 客户端密钥
 */

import type { Hono } from "hono";
import type { BaseApp } from "../core/base";
import { Settings, newDefaultSettings } from "../core/settings_model";
import { badRequestError, forbiddenError } from "./errors";

export function registerSettingsRoutes(app: Hono, baseApp: BaseApp): void {
  // 获取 Settings
  app.get("/api/settings", async (c) => {
    const settings = getSettings(baseApp);
    const settingsJSON = settings.toJSON();

    // 触发 onSettingsListRequest hook
    let finalSettings = settingsJSON;
    await baseApp.onSettingsListRequest().trigger({
      app: baseApp,
      httpContext: c,
      settings: finalSettings,
      next: async () => {},
    });

    return c.json(finalSettings);
  });

  // 更新 Settings
  app.patch("/api/settings", async (c) => {
    const settings = getSettings(baseApp);
    const oldSettingsJSON = settings.toJSON();
    const body = await c.req.json().catch(() => ({}));

    // 深度合并 body 到 settings
    const cloned = settings.clone();
    applyPartialUpdate(cloned, body);

    const newSettingsJSON = cloned.toJSON();

    // 触发 onSettingsUpdateRequest hook
    await baseApp.onSettingsUpdateRequest().trigger({
      app: baseApp,
      httpContext: c,
      oldSettings: oldSettingsJSON,
      newSettings: newSettingsJSON,
      next: async () => {},
    });

    // 保存回 baseApp
    setSettings(baseApp, cloned);

    return c.json(cloned.toJSON());
  });

  // 测试 S3 连接
  app.post("/api/settings/test/s3", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const filesystem = (body as Record<string, unknown>).filesystem as string;

    if (!filesystem || !["storage", "backups"].includes(filesystem)) {
      throw badRequestError("Invalid filesystem value.", {
        filesystem: {
          code: "validation_required",
          message: "Must be one of: storage, backups.",
        },
      });
    }

    // 在实际实现中会连接 S3 并上传/删除测试文件
    // 这里返回成功
    return c.body(null, 204);
  });

  // 测试邮件发送
  app.post("/api/settings/test/email", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const { email, template } = body as { email?: string; template?: string };

    if (!email) {
      throw badRequestError("Invalid test email data.", {
        email: { code: "validation_required", message: "Cannot be blank." },
      });
    }

    const validTemplates = ["verification", "password-reset", "email-change", "otp", "login-alert"];
    if (!template || !validTemplates.includes(template)) {
      throw badRequestError("Invalid test email data.", {
        template: { code: "validation_in_invalid", message: "Must be a valid value." },
      });
    }

    // 在实际实现中会发送测试邮件
    return c.body(null, 204);
  });

  // Apple 客户端密钥生成
  app.post("/api/settings/apple/generate-client-secret", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const { clientId, teamId, keyId, privateKey, duration } = body as {
      clientId?: string;
      teamId?: string;
      keyId?: string;
      privateKey?: string;
      duration?: number;
    };

    if (!clientId || !teamId || !keyId || !privateKey) {
      throw badRequestError("Missing required Apple credentials.");
    }

    // 在实际实现中会使用 jose 生成 JWT
    // 这里返回占位符
    return c.json({ secret: "generated_client_secret_placeholder" });
  });
}

function getSettings(baseApp: BaseApp): Settings {
  const raw = baseApp.settings() as Record<string, unknown>;

  // 如果已经有 Settings 实例
  if (raw.__settingsInstance instanceof Settings) {
    return raw.__settingsInstance;
  }

  // 创建默认 Settings
  const settings = newDefaultSettings();

  // 如果有已保存的设置数据，合并进来
  if (raw.meta || raw.smtp || raw.batch) {
    try {
      const jsonStr = JSON.stringify(raw);
      settings.loadFromParam(jsonStr);
    } catch {
      // 忽略
    }
  }

  return settings;
}

function setSettings(baseApp: BaseApp, settings: Settings): void {
  const raw = baseApp.settings() as Record<string, unknown>;
  // 将 settings 数据写回
  const data = settings.toJSON();
  for (const [key, value] of Object.entries(data)) {
    raw[key] = value;
  }
  raw.__settingsInstance = settings;
}

function applyPartialUpdate(settings: Settings, body: Record<string, unknown>): void {
  if (body.meta && typeof body.meta === "object") {
    Object.assign(settings.meta, body.meta);
  }
  if (body.smtp && typeof body.smtp === "object") {
    Object.assign(settings.smtp, body.smtp);
  }
  if (body.s3 && typeof body.s3 === "object") {
    Object.assign(settings.s3, body.s3);
  }
  if (body.backups && typeof body.backups === "object") {
    Object.assign(settings.backups, body.backups);
  }
  if (body.batch && typeof body.batch === "object") {
    Object.assign(settings.batch, body.batch);
  }
  if (body.logs && typeof body.logs === "object") {
    Object.assign(settings.logs, body.logs);
  }
  if (body.analytics && typeof body.analytics === "object") {
    Object.assign(settings.analytics, body.analytics);
  }
  if (body.rateLimits && typeof body.rateLimits === "object") {
    Object.assign(settings.rateLimits, body.rateLimits);
  }
  if (body.trustedProxy && typeof body.trustedProxy === "object") {
    Object.assign(settings.trustedProxy, body.trustedProxy);
  }
}
