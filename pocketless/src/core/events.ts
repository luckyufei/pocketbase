/**
 * 事件类型 — 所有 Hook 事件
 * 与 Go 版 core/events.go 对齐
 */

import type { CollectionModel } from "./collection_model";
import type { RecordModel } from "./record_model";

/** 基础事件 */
export interface BaseEvent {
  next: () => Promise<void>;
}

/** 启动事件 */
export interface BootstrapEvent extends BaseEvent {
  app: unknown;
}

/** HTTP 服务事件 */
export interface ServeEvent extends BaseEvent {
  app: unknown;
  server: unknown;
  router: unknown;
}

/** 终止事件 */
export interface TerminateEvent extends BaseEvent {
  app: unknown;
  isRestart: boolean;
}

/** 模型事件 */
export interface ModelEvent extends BaseEvent {
  app: unknown;
  model: unknown;
}

/** 模型错误事件（对齐 Go 版 ModelErrorEvent） */
export interface ModelErrorEvent extends ModelEvent {
  error: Error;
}

/** Collection 错误事件 */
export interface CollectionErrorEvent extends CollectionEvent {
  error: Error;
}

/** Record 事件 */
export interface RecordEvent extends BaseEvent {
  app: unknown;
  record: RecordModel;
  collection: CollectionModel;
  httpContext?: unknown;
}

/** Collection 事件 */
export interface CollectionEvent extends BaseEvent {
  app: unknown;
  collection: CollectionModel;
  httpContext?: unknown;
}

/** Record CRUD 请求事件 */
export interface RecordRequestEvent extends RecordEvent {
  httpContext: unknown;
}

/** Record 列表请求事件 */
export interface RecordListEvent extends BaseEvent {
  app: unknown;
  collection: CollectionModel;
  records: RecordModel[];
  totalItems: number;
  httpContext: unknown;
}

/** Record 认证事件 */
export interface RecordAuthEvent extends BaseEvent {
  app: unknown;
  record: RecordModel;
  collection: CollectionModel;
  token: string;
  meta: Record<string, unknown>;
  httpContext: unknown;
}

/** 邮件事件 */
export interface MailEvent extends BaseEvent {
  app: unknown;
  record: RecordModel;
  collection: CollectionModel;
  message: unknown;
  meta: Record<string, unknown>;
}

/** Record 错误事件 */
export interface RecordErrorEvent extends RecordEvent {
  error: Error;
}

/** Record Enrich 事件 */
export interface RecordEnrichEvent extends BaseEvent {
  app: unknown;
  record: RecordModel;
  collection: CollectionModel;
  httpContext?: unknown;
}

/** Settings 请求事件 */
export interface SettingsListRequestEvent extends BaseEvent {
  app: unknown;
  httpContext: unknown;
  settings: Record<string, unknown>;
}

export interface SettingsUpdateRequestEvent extends BaseEvent {
  app: unknown;
  httpContext: unknown;
  oldSettings: Record<string, unknown>;
  newSettings: Record<string, unknown>;
}

export interface SettingsReloadEvent extends BaseEvent {
  app: unknown;
}

/** Realtime 事件 */
export interface RealtimeConnectRequestEvent extends BaseEvent {
  app: unknown;
  httpContext: unknown;
  client: unknown;
  idleTimeout: number;
}

export interface RealtimeSubscribeRequestEvent extends BaseEvent {
  app: unknown;
  httpContext: unknown;
  client: unknown;
  subscriptions: string[];
}

export interface RealtimeMessageEvent extends BaseEvent {
  app: unknown;
  client: unknown;
  message: unknown;
  record?: RecordModel;
  collection?: CollectionModel;
}

/** File 事件 */
export interface FileDownloadRequestEvent extends BaseEvent {
  app: unknown;
  httpContext: unknown;
  record: RecordModel;
  collection: CollectionModel;
  fileField: unknown;
  servedPath: string;
  servedName: string;
}

export interface FileTokenRequestEvent extends BaseEvent {
  app: unknown;
  httpContext: unknown;
  token: string;
  record: RecordModel;
  collection: CollectionModel;
}

/** Batch 事件 */
export interface BatchRequestEvent extends BaseEvent {
  app: unknown;
  httpContext: unknown;
  batch: unknown[];
}

/** Backup 事件 */
export interface BackupEvent extends BaseEvent {
  app: unknown;
  name: string;
  exclude: string[];
}

/** 创建事件对象的辅助函数 */
export function createEvent<T extends BaseEvent>(data: Omit<T, "next">): T {
  let nextCalled = false;
  const event = {
    ...data,
    next: async () => {
      nextCalled = true;
    },
  } as T;
  return event;
}
