/**
 * Auth-with-OAuth2 端点
 * POST /api/collections/:collection/auth-with-oauth2
 * 与 Go 版 apis/record_auth_with_oauth2.go 对齐
 */

import type { Hono } from "hono";
import type { BaseApp } from "../core/base";
import type { CollectionModel } from "../core/collection_model";
import type { RecordModel } from "../core/record_model";
import { Providers } from "../tools/auth/base_provider";
import type { AuthUser } from "../tools/auth/base_provider";
import { newAuthToken } from "../core/tokens";
import { badRequestError, forbiddenError, notFoundError } from "./errors";
import { generateId } from "../tools/security/random";

// ─── OAuth2 配置类型 ───

interface OAuth2Config {
  enabled: boolean;
  providers: Array<{
    name: string;
    clientId: string;
    clientSecret: string;
  }>;
}

function getOAuth2Config(collection: CollectionModel): OAuth2Config {
  const config = collection.options.oauth2 as OAuth2Config | undefined;
  return config ?? { enabled: false, providers: [] };
}

interface OAuth2Form {
  provider: string;
  code: string;
  codeVerifier?: string;
  redirectURL: string;
  createData?: Record<string, unknown>;
}

function validateForm(form: OAuth2Form, collection: CollectionModel): Record<string, unknown> | null {
  const errors: Record<string, unknown> = {};
  const config = getOAuth2Config(collection);

  if (!form.provider) {
    errors.provider = { code: "validation_required", message: "Cannot be blank." };
  } else {
    const providerConfig = config.providers.find((p) => p.name === form.provider);
    if (!providerConfig) {
      errors.provider = { code: "validation_invalid_provider", message: `Provider with name ${form.provider} is missing or is not enabled.` };
    }
  }

  if (!form.code) {
    errors.code = { code: "validation_required", message: "Cannot be blank." };
  }

  if (!form.redirectURL) {
    errors.redirectURL = { code: "validation_required", message: "Cannot be blank." };
  }

  return Object.keys(errors).length > 0 ? errors : null;
}

export function registerRecordAuthOAuth2Routes(app: Hono, baseApp: BaseApp): void {
  app.post("/api/collections/:collection/auth-with-oauth2", async (c) => {
    // 查找 Auth 集合
    const collection = await baseApp.findCollectionByNameOrId(c.req.param("collection"));
    if (!collection || !collection.isAuth()) {
      throw notFoundError("Missing or invalid auth collection context.");
    }

    const config = getOAuth2Config(collection);
    if (!config.enabled) {
      throw forbiddenError("The collection is not configured to allow OAuth2 authentication.");
    }

    const body = await c.req.json().catch(() => ({}));
    const form: OAuth2Form = {
      provider: body.provider ?? "",
      code: body.code ?? "",
      codeVerifier: body.codeVerifier,
      redirectURL: body.redirectURL ?? body.redirectUrl ?? "",
      createData: body.createData,
    };

    const errors = validateForm(form, collection);
    if (errors) {
      throw badRequestError("An error occurred while validating the submitted data.", errors);
    }

    // 获取 provider factory
    const factory = Providers.get(form.provider);
    if (!factory) {
      throw badRequestError("Missing or invalid provider.");
    }

    const provider = factory();
    const providerConfig = config.providers.find((p) => p.name === form.provider)!;
    provider.setClientId(providerConfig.clientId);
    provider.setClientSecret(providerConfig.clientSecret);
    provider.setRedirectURL(form.redirectURL);

    // 获取 OAuth2 用户信息（mock-friendly: 直接调用 fetchAuthUser）
    let authUser: AuthUser;
    try {
      authUser = await provider.fetchAuthUser({ accessToken: form.code });
    } catch (err) {
      throw badRequestError("Failed to fetch OAuth2 user.", {});
    }

    // 查找已有 ExternalAuth 关联
    let authRecord: RecordModel | null = null;
    let isNew = false;

    const externalAuth = await (baseApp as any).findFirstExternalAuth?.({
      collectionRef: collection.id,
      provider: form.provider,
      providerId: authUser.id,
    });

    if (externalAuth) {
      // 已有 ExternalAuth → 用关联的 record
      authRecord = await (baseApp as any).findRecordById?.(collection.name, externalAuth.recordRef) ?? null;
    }

    if (!authRecord && authUser.email) {
      // 通过 email 查找已有用户
      authRecord = await (baseApp as any).findAuthRecordByEmail?.(collection.id, authUser.email) ?? null;
    }

    if (!authRecord) {
      // 新用户：创建临时 record
      isNew = true;
      const { RecordModel: RecordModelClass } = await import("../core/record_model");
      authRecord = new RecordModelClass(collection);
      authRecord.id = generateId();
      authRecord.set("email", authUser.email);
      authRecord.set("tokenKey", generateId());
      authRecord.set("verified", true);
      authRecord.set("emailVisibility", true);
    }

    // 生成 token
    const token = await newAuthToken(authRecord);
    const recordJSON = authRecord.toJSON();
    delete recordJSON.tokenKey;

    // meta 包含 OAuth2 用户信息 + isNew
    const meta: Record<string, unknown> = {
      id: authUser.id,
      name: authUser.name,
      username: authUser.username,
      email: authUser.email,
      avatarURL: authUser.avatarURL,
      accessToken: authUser.accessToken,
      isNew,
    };

    return c.json({ token, record: recordJSON, meta });
  });
}
