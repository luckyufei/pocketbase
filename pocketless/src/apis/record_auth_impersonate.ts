/**
 * Impersonation 端点
 * POST /api/collections/:collection/impersonate/:id
 * 与 Go 版 apis/record_auth_impersonate.go 对齐
 *
 * 仅 superuser 可调用，生成非刷新的 static auth token
 */

import type { Hono } from "hono";
import type { BaseApp } from "../core/base";
import { newStaticAuthToken } from "../core/tokens";
import { badRequestError, forbiddenError, notFoundError } from "./errors";

export function registerImpersonateRoutes(app: Hono, baseApp: BaseApp): void {
  app.post(
    "/api/collections/:collection/impersonate/:id",
    async (c) => {
      // 查找 Auth 集合
      const collection = await baseApp.findCollectionByNameOrId(
        c.req.param("collection"),
      );
      if (!collection || !collection.isAuth()) {
        throw notFoundError("Missing or invalid auth collection context.");
      }

      // 检查 superuser 权限
      if (!(baseApp as any).isSuperuser?.()) {
        throw forbiddenError("Only superusers can perform this action.");
      }

      // 解析 duration
      const body = await c.req.json().catch(() => ({}));
      const duration: number = body.duration ?? 0;

      if (duration < 0) {
        throw badRequestError(
          "An error occurred while validating the submitted data.",
          {
            duration: {
              code: "validation_min",
              message: "Must be no less than 0.",
            },
          },
        );
      }

      // 查找目标记录
      const recordId = c.req.param("id");
      const record = await (baseApp as any).findRecordById?.(
        collection.name,
        recordId,
      );
      if (!record) {
        throw notFoundError("The requested resource wasn't found.");
      }

      // 生成非刷新的 static auth token
      const token = await newStaticAuthToken(record, duration);

      const recordJSON = record.toJSON();
      delete recordJSON.tokenKey;

      return c.json({ token, record: recordJSON });
    },
  );
}
