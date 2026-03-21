/**
 * App 接口 — PocketLess 核心契约
 * 与 Go 版 core.App 接口一一对应
 */

import type { Hook, TaggedHook } from "../tools/hook/hook";

// ─── 前向类型声明 ───

export interface Collection {
  id: string;
  type: string;
  name: string;
  system: boolean;
  fields: Field[];
  indexes: string[];
  listRule: string | null;
  viewRule: string | null;
  createRule: string | null;
  updateRule: string | null;
  deleteRule: string | null;
  options: Record<string, unknown>;
  created: string;
  updated: string;
}

export interface Record {
  id: string;
  collectionId: string;
  collectionName: string;
  created: string;
  updated: string;
  get(key: string): unknown;
  set(key: string, value: unknown): void;
  [key: string]: unknown;
}

export interface Field {
  id: string;
  name: string;
  type: string;
  required: boolean;
  options: Record<string, unknown>;
}

export interface Settings {
  meta: {
    appName: string;
    appURL: string;
    senderName: string;
    senderAddress: string;
    hideControls: boolean;
  };
  smtp: {
    enabled: boolean;
    host: string;
    port: number;
    username: string;
    password: string;
    tls: boolean;
  };
  s3: {
    enabled: boolean;
    endpoint: string;
    bucket: string;
    region: string;
    accessKey: string;
    secret: string;
  };
  rateLimits: Array<{
    label: string;
    maxRequests: number;
    duration: number;
  }>;
  batch: {
    maxRequests: number;
    timeout: number;
  };
  [key: string]: unknown;
}

// ─── Event Types ───

export interface BaseEvent {
  next(): Promise<void>;
}

export interface BootstrapEvent extends BaseEvent {
  app: App;
}

export interface ServeEvent extends BaseEvent {
  app: App;
  server: unknown;
}

export interface ModelEvent extends BaseEvent {
  app: App;
  model: unknown;
}

export interface RecordEvent extends BaseEvent {
  app: App;
  record: Record;
  collection: Collection;
}

export interface CollectionEvent extends BaseEvent {
  app: App;
  collection: Collection;
}

// ─── DB 接口 ───

export interface DBAdapter {
  type(): "sqlite" | "postgres";
  boolValue(val: unknown): boolean;
  formatBool(val: boolean): unknown;
  formatTime(val: Date): string;
  jsonExtract(column: string, path: string): string;
  jsonArrayLength(column: string): string;
  noCaseCollation(): string;
  isUniqueViolation(err: Error): boolean;
  isForeignKeyViolation(err: Error): boolean;
}

export interface QueryBuilder {
  select(...columns: string[]): unknown;
  insert(table: string): unknown;
  update(table: string): unknown;
  deleteFrom(table: string): unknown;
  newQuery(sql: string): unknown;
  transaction<T>(fn: (tx: QueryBuilder) => Promise<T>): Promise<T>;
}

// ─── Store 接口 ───

export interface Store<T = unknown> {
  get(key: string): T | undefined;
  set(key: string, value: T): void;
  has(key: string): boolean;
  delete(key: string): void;
  getAll(): Map<string, T>;
  reset(): void;
  length(): number;
}

// ─── Cron 接口 ───

export interface CronScheduler {
  add(jobId: string, expression: string, handler: () => Promise<void> | void): void;
  remove(jobId: string): void;
  start(): void;
  stop(): void;
  jobs(): Array<{ id: string; expression: string }>;
  trigger(jobId: string): Promise<void>;
}

// ─── Subscriptions 接口 ───

export interface SubscriptionsBroker {
  register(controller: ReadableStreamDefaultController): string;
  unregister(clientId: string): void;
  setSubscriptions(clientId: string, subs: string[]): void;
  getSubscriptions(clientId: string): string[];
  broadcast(topic: string, data: unknown): void;
  clientsCount(): number;
}

// ─── App 接口 ───

export interface App {
  // ── 生命周期 ──
  bootstrap(): Promise<void>;
  shutdown(): Promise<void>;
  isBootstrapped(): boolean;

  // ── 配置 ──
  dataDir(): string;
  isDev(): boolean;
  settings(): Settings;
  encryptionEnv(): string;

  // ── 数据库 ──
  db(): QueryBuilder;
  auxiliaryDB(): QueryBuilder;
  dbAdapter(): DBAdapter;
  runInTransaction<T>(fn: (tx: QueryBuilder) => Promise<T>): Promise<T>;

  // ── CRUD ──
  save(model: unknown): Promise<void>;
  delete(model: unknown): Promise<void>;
  validate(model: unknown): Promise<void>;

  // ── Collection 查询 ──
  findCollectionByNameOrId(nameOrId: string): Promise<Collection | null>;
  findAllCollections(...types: string[]): Promise<Collection[]>;

  // ── Record 查询 ──
  findRecordById(collectionNameOrId: string, id: string): Promise<Record | null>;
  findRecordsByFilter(
    collectionNameOrId: string,
    filter: string,
    sort?: string,
    limit?: number,
    offset?: number,
  ): Promise<Record[]>;
  countRecords(collectionNameOrId: string, filter?: string): Promise<number>;

  // ── Store ──
  store(): Store;

  // ── Cron ──
  cron(): CronScheduler;

  // ── Subscriptions ──
  subscriptionsBroker(): SubscriptionsBroker;

  // ── Hooks ──
  onBootstrap(): Hook<BootstrapEvent>;
  onServe(): Hook<ServeEvent>;
  onTerminate(): Hook<BaseEvent>;

  onModelCreate(...tags: string[]): TaggedHook<ModelEvent>;
  onModelCreateExecute(...tags: string[]): TaggedHook<ModelEvent>;
  onModelAfterCreateSuccess(...tags: string[]): TaggedHook<ModelEvent>;
  onModelUpdate(...tags: string[]): TaggedHook<ModelEvent>;
  onModelUpdateExecute(...tags: string[]): TaggedHook<ModelEvent>;
  onModelAfterUpdateSuccess(...tags: string[]): TaggedHook<ModelEvent>;
  onModelDelete(...tags: string[]): TaggedHook<ModelEvent>;
  onModelDeleteExecute(...tags: string[]): TaggedHook<ModelEvent>;
  onModelAfterDeleteSuccess(...tags: string[]): TaggedHook<ModelEvent>;
  onModelValidate(...tags: string[]): TaggedHook<ModelEvent>;

  onRecordCreate(...tags: string[]): TaggedHook<RecordEvent>;
  onRecordCreateExecute(...tags: string[]): TaggedHook<RecordEvent>;
  onRecordAfterCreateSuccess(...tags: string[]): TaggedHook<RecordEvent>;
  onRecordUpdate(...tags: string[]): TaggedHook<RecordEvent>;
  onRecordUpdateExecute(...tags: string[]): TaggedHook<RecordEvent>;
  onRecordAfterUpdateSuccess(...tags: string[]): TaggedHook<RecordEvent>;
  onRecordDelete(...tags: string[]): TaggedHook<RecordEvent>;
  onRecordDeleteExecute(...tags: string[]): TaggedHook<RecordEvent>;
  onRecordAfterDeleteSuccess(...tags: string[]): TaggedHook<RecordEvent>;
  onRecordValidate(...tags: string[]): TaggedHook<RecordEvent>;

  onCollectionCreate(): Hook<CollectionEvent>;
  onCollectionCreateExecute(): Hook<CollectionEvent>;
  onCollectionAfterCreateSuccess(): Hook<CollectionEvent>;
  onCollectionUpdate(): Hook<CollectionEvent>;
  onCollectionUpdateExecute(): Hook<CollectionEvent>;
  onCollectionAfterUpdateSuccess(): Hook<CollectionEvent>;
  onCollectionDelete(): Hook<CollectionEvent>;
  onCollectionDeleteExecute(): Hook<CollectionEvent>;
  onCollectionAfterDeleteSuccess(): Hook<CollectionEvent>;
  onCollectionValidate(): Hook<CollectionEvent>;
}
