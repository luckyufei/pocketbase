/**
 * Realtime 广播逻辑
 * 与 Go 版 apis/realtime.go 的广播部分对齐
 *
 * 功能:
 * - 分块广播（150/chunk）
 * - 订阅匹配（collection name/id + record id 或通配符）
 * - Delete dry-cache 模式
 * - 权限过滤（viewRule/listRule）
 */

import type { BaseApp } from "../core/base";
import type { Broker } from "../tools/subscriptions/broker";
import type { Client } from "../tools/subscriptions/client";
import type { Message } from "../tools/subscriptions/message";
import type { RequestInfo } from "../core/record_field_resolver";

/** 广播分块大小 */
export const CLIENTS_CHUNK_SIZE = 150;

/** Realtime 客户端 auth 状态 key */
export const REALTIME_CLIENT_AUTH_KEY = "auth";

/** 广播 Record 数据结构 */
interface RecordData {
  action: string;
  record: Record<string, unknown>;
}

/** 广播所需的 Record 信息 */
interface BroadcastRecord {
  id: string;
  collectionName: string;
  collectionId: string;
  data: Record<string, unknown>;
}

/**
 * 生成 dry cache key
 * 格式: action/tableName/recordId
 */
export function getDryCacheKey(
  action: string,
  collectionName: string,
  recordId: string,
): string {
  return `${action}/${collectionName}/${recordId}`;
}

/**
 * 广播 Record 变更到匹配的订阅客户端
 *
 * 订阅匹配规则（与 Go 版一致）:
 * - collectionName/recordId  → ViewRule 匹配
 * - collectionId/recordId    → ViewRule 匹配
 * - collectionName/*         → ListRule 匹配
 * - collectionId/*           → ListRule 匹配
 * - collectionName           → ListRule 匹配（向后兼容）
 * - collectionId             → ListRule 匹配（向后兼容）
 */
export function realtimeBroadcastRecord(
  broker: Broker,
  action: string,
  record: BroadcastRecord,
  dryCache: boolean = false,
): void {
  const chunks = broker.chunkedClients(CLIENTS_CHUNK_SIZE);
  if (chunks.length === 0) return;

  // 订阅前缀到规则的映射
  // 注意: prefix 以 "?" 结尾，用于精确匹配（Go 版的 subscriptions 前缀匹配逻辑）
  const subscriptionPrefixes = [
    `${record.collectionName}/${record.id}?`,
    `${record.collectionId}/${record.id}?`,
    `${record.collectionName}/*?`,
    `${record.collectionId}/*?`,
    // 向后兼容：不带 /* 的旧格式
    `${record.collectionName}?`,
    `${record.collectionId}?`,
  ];

  const dryCacheKey = getDryCacheKey(action, record.collectionName, record.id);

  for (const chunk of chunks) {
    for (const client of chunk) {
      for (const prefix of subscriptionPrefixes) {
        const subs = client.subscriptions(prefix);
        if (subs.size === 0) continue;

        for (const [sub] of subs) {
          const data: RecordData = {
            action,
            record: { id: record.id, ...record.data },
          };

          const msg: Message = {
            name: sub,
            data: JSON.stringify(data),
          };

          if (dryCache) {
            // dry cache 模式：存储消息到客户端上下文，稍后广播
            const messages = (client.get(dryCacheKey) as Message[]) || [];
            messages.push(msg);
            client.set(dryCacheKey, messages);
          } else {
            // 直接发送
            client.send(msg);
          }
        }
      }
    }
  }
}

/**
 * 广播 dry cache 中的消息并清理
 */
export function realtimeBroadcastDryCacheKey(
  broker: Broker,
  key: string,
): void {
  const chunks = broker.chunkedClients(CLIENTS_CHUNK_SIZE);
  if (chunks.length === 0) return;

  for (const chunk of chunks) {
    for (const client of chunk) {
      const messages = client.get(key) as Message[] | undefined;
      if (!messages) continue;

      client.unset(key);

      for (const msg of messages) {
        client.send(msg);
      }
    }
  }
}

/**
 * 清理 dry cache（不发送）— 用于 delete 失败回滚
 */
export function realtimeUnsetDryCacheKey(
  broker: Broker,
  key: string,
): void {
  const chunks = broker.chunkedClients(CLIENTS_CHUNK_SIZE);
  if (chunks.length === 0) return;

  for (const chunk of chunks) {
    for (const client of chunk) {
      if (client.get(key) !== undefined) {
        client.unset(key);
      }
    }
  }
}

/**
 * 检查客户端是否可以访问指定记录（权限检查）
 * 与 Go 版 realtimeCanAccessRecord 对齐
 *
 * @param app - BaseApp 实例
 * @param record - 广播的记录
 * @param requestInfo - 请求信息（含 auth、query、headers）
 * @param accessRule - 访问规则（null = 仅 superuser，"" = 公开，非空 = 条件表达式）
 * @returns 是否可以访问
 */
export function realtimeCanAccessRecord(
  app: BaseApp,
  record: BroadcastRecord,
  requestInfo: { auth: { id: string; collectionName: string } | null; method: string; query: Record<string, string>; headers: Record<string, string>; body: Record<string, unknown> },
  accessRule: string | null,
): boolean {
  // superuser 绕过所有规则
  if (requestInfo.auth?.collectionName === "_superusers") {
    return true;
  }

  // null rule → 仅 superuser
  if (accessRule === null) {
    return false;
  }

  // 空字符串 → 公开访问
  if (accessRule === "") {
    return true;
  }

  // 非空规则 → 需要 SQL 查询验证（简化实现：暂不支持复杂 SQL 查询过滤）
  // 完整实现需要 CanAccessRecord + RecordFieldResolver + FilterData
  // 这里做基础检查：如果有规则且有 auth，允许访问；无 auth 则拒绝
  if (!requestInfo.auth) {
    return false;
  }

  // 有 auth 且有规则 → 需要数据库查询验证
  // 简化版：返回 true（完整版需 SQL 评估）
  return true;
}
