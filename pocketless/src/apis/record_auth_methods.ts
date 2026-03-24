/**
 * Auth Methods 端点
 * GET /api/collections/:col/auth-methods
 * 与 Go 版 apis/record_auth_methods.go 对齐
 */

import type { Hono } from "hono";
import type { BaseApp } from "../core/base";
import type { CollectionModel } from "../core/collection_model";
import { Providers } from "../tools/auth/base_provider";
import { randomString } from "../tools/security/random";
import { notFoundError } from "./errors";

// 确保所有 providers 都被注册
import "../tools/auth/providers";

// ─── 类型定义 ───

interface PasswordAuthConfig {
  enabled: boolean;
  identityFields: string[];
}

interface OAuth2ProviderConfig {
  name: string;
  clientId: string;
  clientSecret: string;
}

interface OAuth2Config {
  enabled: boolean;
  providers: OAuth2ProviderConfig[];
}

interface MFAConfig {
  enabled: boolean;
  duration: number;
}

interface OTPConfig {
  enabled: boolean;
  duration: number;
}

interface ProviderInfo {
  name: string;
  displayName: string;
  state: string;
  /** 与 Go 版 AuthURL（新字段）对齐 */
  authURL: string;
  /** 与 Go 版 AuthUrl（遗留字段，v0.22 兼容）对齐 */
  authUrl: string;
  /** 不支持 PKCE 时返回空字符串（与 Go 版保持一致） */
  codeVerifier: string;
  codeChallenge: string;
  codeChallengeMethod: string;
}

// ─── 集合配置提取辅助 ───

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

// ─── OAuth2 Provider Info 构建 ───

/**
 * 为单个 OAuth2 provider 构建完整的 providerInfo。
 * 与 Go 版 recordAuthMethods() 内循环逻辑对齐：
 *   - state: security.RandomString(30)
 *   - PKCE: codeVerifier = RandomString(43), codeChallenge = S256(verifier)
 *   - authURL: provider.BuildAuthURL(state, ...) + "&redirect_uri="
 */
function buildProviderInfo(config: OAuth2ProviderConfig): ProviderInfo | null {
  const factory = Providers.get(config.name);
  if (!factory) {
    return null; // provider 未注册，跳过（与 Go 版 InitProvider 失败时 continue 对齐）
  }

  const provider = factory();
  provider.setClientId(config.clientId);
  provider.setClientSecret(config.clientSecret);

  const state = randomString(30);

  let codeVerifier = "";
  let codeChallenge = "";
  let codeChallengeMethod = "";

  if (provider.getPKCE()) {
    codeVerifier = randomString(43); // Go 版: security.RandomString(43)
    // codeChallenge 由 buildAuthURL 内部通过 s256Challenge(codeVerifier) 计算
    // 这里直接调用 buildAuthURL 并把 verifier 传入，再从 URL 里取回
    // 为了避免重复计算，我们复用 base_provider 里的 s256Challenge 逻辑
    const { createHash } = require("node:crypto") as typeof import("node:crypto");
    codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
    codeChallengeMethod = "S256";
  }

  // buildAuthURL 内部会自动处理 PKCE 参数（当 codeVerifier 传入时）
  const authURL =
    provider.buildAuthURL(state, codeVerifier || undefined) +
    "&redirect_uri="; // 末尾追加空 redirect_uri，让客户端补全（与 Go 版完全一致）

  // Apple 需要 response_mode=form_post（Go 版 switch case）
  // buildAuthURL 不直接支持，需要手动注入
  let finalAuthURL = authURL;
  if (config.name === "apple" && !finalAuthURL.includes("response_mode=")) {
    const sep = finalAuthURL.includes("?") ? "&" : "?";
    finalAuthURL = finalAuthURL.replace("&redirect_uri=", `${sep}response_mode=form_post&redirect_uri=`);
  }

  const displayName = provider.getDisplayName() || config.name;

  return {
    name: config.name,
    displayName,
    state,
    authURL: finalAuthURL,
    authUrl: finalAuthURL, // 遗留字段，v0.22 兼容
    codeVerifier,
    codeChallenge,
    codeChallengeMethod,
  };
}

// ─── 遗留字段填充 ───

/**
 * 填充 v0.22 遗留顶层字段。
 * 与 Go 版 authMethodsResponse.fillLegacyFields() 对齐。
 */
function buildLegacyFields(
  passwordAuth: PasswordAuthConfig,
  oauth2Enabled: boolean,
  providers: ProviderInfo[]
) {
  return {
    authProviders: oauth2Enabled ? providers : [],
    usernamePassword:
      passwordAuth.enabled && passwordAuth.identityFields.includes("username"),
    emailPassword:
      passwordAuth.enabled && passwordAuth.identityFields.includes("email"),
  };
}

// ─── 路由注册 ───

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

    // ─── Password ───
    const passwordResponse = {
      enabled: passwordAuth.enabled,
      identityFields: passwordAuth.enabled ? passwordAuth.identityFields : [],
    };

    // ─── OTP / MFA ───
    // Go 版: duration 仅在 enabled 时写入，但存储值直接读取，始终返回原始配置值
    const otpResponse = {
      enabled: otp.enabled,
      duration: otp.duration,
    };

    const mfaResponse = {
      enabled: mfa.enabled,
      duration: mfa.duration,
    };

    // ─── OAuth2 ───
    const oauth2Providers: ProviderInfo[] = [];

    if (oauth2.enabled) {
      for (const config of oauth2.providers) {
        const info = buildProviderInfo(config);
        if (info) {
          oauth2Providers.push(info);
        }
        // 初始化失败时跳过（与 Go 版 continue 对齐）
      }
    }

    const oauth2Response = {
      enabled: oauth2.enabled,
      providers: oauth2Providers,
    };

    // ─── 遗留字段 ───
    const legacy = buildLegacyFields(passwordAuth, oauth2.enabled, oauth2Providers);

    return c.json({
      password: passwordResponse,
      oauth2: oauth2Response,
      mfa: mfaResponse,
      otp: otpResponse,
      // v0.22 遗留字段
      ...legacy,
    });
  });
}
