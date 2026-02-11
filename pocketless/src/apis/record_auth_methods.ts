/**
 * Auth Methods 端点
 * GET /api/collections/:col/auth-methods
 * 与 Go 版 apis/record_auth_methods.go 对齐
 */

import type { Hono } from "hono";
import type { BaseApp } from "../core/base";
import type { CollectionModel } from "../core/collection_model";
import { notFoundError } from "./errors";

interface PasswordAuthConfig {
  enabled: boolean;
  identityFields: string[];
}

interface OAuth2Config {
  enabled: boolean;
  providers: Array<{ name: string; clientId: string; clientSecret: string }>;
}

interface MFAConfig {
  enabled: boolean;
  duration: number;
}

interface OTPConfig {
  enabled: boolean;
  duration: number;
}

function getPasswordAuth(col: CollectionModel): PasswordAuthConfig {
  return (col.options.passwordAuth as PasswordAuthConfig) ?? { enabled: false, identityFields: [] };
}

function getOAuth2(col: CollectionModel): OAuth2Config {
  return (col.options.oauth2 as OAuth2Config) ?? { enabled: false, providers: [] };
}

function getMFA(col: CollectionModel): MFAConfig {
  return (col.options.mfa as MFAConfig) ?? { enabled: false, duration: 0 };
}

function getOTP(col: CollectionModel): OTPConfig {
  return (col.options.otp as OTPConfig) ?? { enabled: false, duration: 0 };
}

export function registerAuthMethodsRoutes(app: Hono, baseApp: BaseApp): void {
  app.get("/api/collections/:collection/auth-methods", async (c) => {
    const collection = await baseApp.findCollectionByNameOrId(c.req.param("collection"));
    if (!collection || !collection.isAuth()) {
      throw notFoundError("Missing or invalid auth collection context.");
    }

    const passwordAuth = getPasswordAuth(collection);
    const oauth2 = getOAuth2(collection);
    const mfa = getMFA(collection);
    const otp = getOTP(collection);

    // 构建 OAuth2 providers 信息（不含 clientSecret）
    const providerInfos = oauth2.providers.map((p) => ({
      name: p.name,
      displayName: p.name.charAt(0).toUpperCase() + p.name.slice(1),
      state: "", // 由客户端生成
    }));

    return c.json({
      password: {
        enabled: passwordAuth.enabled,
        identityFields: passwordAuth.identityFields,
      },
      oauth2: {
        enabled: oauth2.enabled,
        providers: providerInfos,
      },
      mfa: {
        enabled: mfa.enabled,
        duration: mfa.duration,
      },
      otp: {
        enabled: otp.enabled,
        duration: otp.duration,
      },
    });
  });
}
