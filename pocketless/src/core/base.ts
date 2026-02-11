/**
 * BaseApp — App 接口的默认实现
 * 与 Go 版 core.BaseApp 对齐
 * 管理双数据库连接、80+ Hook、Store、Cron、Subscriptions
 */

import { Hook, TaggedHook, TaggedHookView } from "../tools/hook/hook";
import { Store } from "../tools/store/store";
import { Logger, LogLevel } from "../tools/logger/logger";
import { SQLiteAdapter } from "./db_adapter_sqlite";
import { QueryBuilder } from "./db_builder";
import { CollectionModel } from "./collection_model";
import { RecordModel } from "./record_model";
import type { Filesystem } from "../tools/filesystem/filesystem";
import type { Mailer } from "../tools/mailer/mailer";
import type { DBAdapter } from "./db_adapter";
import type {
  BootstrapEvent,
  ServeEvent,
  TerminateEvent,
  ModelEvent,
  ModelErrorEvent,
  RecordEvent,
  CollectionEvent,
  CollectionErrorEvent,
  RecordRequestEvent,
  RecordListEvent,
  RecordAuthEvent,
  RecordEnrichEvent,
  MailEvent,
  SettingsListRequestEvent,
  SettingsUpdateRequestEvent,
  SettingsReloadEvent,
  RealtimeConnectRequestEvent,
  RealtimeSubscribeRequestEvent,
  RealtimeMessageEvent,
  FileDownloadRequestEvent,
  FileTokenRequestEvent,
  BatchRequestEvent,
  BackupEvent,
} from "./events";
import { Cron } from "croner";
import { mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

export interface BaseAppConfig {
  dataDir: string;
  isDev: boolean;
  pgDSN?: string;
  encryptionEnv?: string;
  queryTimeout?: number;
}

export class BaseApp {
  private config: BaseAppConfig;
  private _db: QueryBuilder | null = null;
  private _auxiliaryDB: QueryBuilder | null = null;
  private _adapter: DBAdapter | null = null;
  private _auxiliaryAdapter: DBAdapter | null = null;
  private _store: Store = new Store();
  private _bootstrapped: boolean = false;
  private _settings: Record<string, unknown> = {};
  private _cronJobs: Map<string, Cron> = new Map();
  private _logger: Logger | null = null;

  // ─── 80+ Hook 实例 ───

  // 生命周期
  private _onBootstrap = new Hook<BootstrapEvent>();
  private _onServe = new Hook<ServeEvent>();
  private _onTerminate = new Hook<TerminateEvent>();
  private _onBeforeServe = new Hook<ServeEvent>();

  // Model Hooks
  private _onModelCreate = new Hook<ModelEvent>();
  private _onModelCreateExecute = new Hook<ModelEvent>();
  private _onModelAfterCreateSuccess = new Hook<ModelEvent>();
  private _onModelAfterCreateError = new Hook<ModelEvent>();
  private _onModelUpdate = new Hook<ModelEvent>();
  private _onModelUpdateExecute = new Hook<ModelEvent>();
  private _onModelAfterUpdateSuccess = new Hook<ModelEvent>();
  private _onModelAfterUpdateError = new Hook<ModelEvent>();
  private _onModelDelete = new Hook<ModelEvent>();
  private _onModelDeleteExecute = new Hook<ModelEvent>();
  private _onModelAfterDeleteSuccess = new Hook<ModelEvent>();
  private _onModelAfterDeleteError = new Hook<ModelEvent>();
  private _onModelValidate = new Hook<ModelEvent>();

  // Record Hooks (tagged — handlers can have collection tags)
  private _onRecordCreate = new TaggedHook<RecordEvent>();
  private _onRecordCreateExecute = new TaggedHook<RecordEvent>();
  private _onRecordAfterCreateSuccess = new TaggedHook<RecordEvent>();
  private _onRecordAfterCreateError = new TaggedHook<RecordEvent>();
  private _onRecordUpdate = new TaggedHook<RecordEvent>();
  private _onRecordUpdateExecute = new TaggedHook<RecordEvent>();
  private _onRecordAfterUpdateSuccess = new TaggedHook<RecordEvent>();
  private _onRecordAfterUpdateError = new TaggedHook<RecordEvent>();
  private _onRecordDelete = new TaggedHook<RecordEvent>();
  private _onRecordDeleteExecute = new TaggedHook<RecordEvent>();
  private _onRecordAfterDeleteSuccess = new TaggedHook<RecordEvent>();
  private _onRecordAfterDeleteError = new TaggedHook<RecordEvent>();
  private _onRecordValidate = new TaggedHook<RecordEvent>();

  // Record Auth Hooks (tagged)
  private _onRecordAuthRequest = new TaggedHook<RecordAuthEvent>();
  private _onRecordAuthRefreshRequest = new TaggedHook<RecordAuthEvent>();
  private _onRecordAuthWithPasswordRequest = new TaggedHook<RecordAuthEvent>();
  private _onRecordAuthWithOAuth2Request = new TaggedHook<RecordAuthEvent>();
  private _onRecordAuthWithOTPRequest = new TaggedHook<RecordAuthEvent>();
  private _onRecordRequestPasswordResetRequest = new TaggedHook<RecordEvent>();
  private _onRecordConfirmPasswordResetRequest = new TaggedHook<RecordEvent>();
  private _onRecordRequestVerificationRequest = new TaggedHook<RecordEvent>();
  private _onRecordConfirmVerificationRequest = new TaggedHook<RecordEvent>();
  private _onRecordRequestEmailChangeRequest = new TaggedHook<RecordEvent>();
  private _onRecordConfirmEmailChangeRequest = new TaggedHook<RecordEvent>();

  // Record CRUD Request Hooks (tagged)
  private _onRecordsListRequest = new TaggedHook<RecordListEvent>();
  private _onRecordViewRequest = new TaggedHook<RecordRequestEvent>();
  private _onRecordCreateRequest = new TaggedHook<RecordRequestEvent>();
  private _onRecordUpdateRequest = new TaggedHook<RecordRequestEvent>();
  private _onRecordDeleteRequest = new TaggedHook<RecordRequestEvent>();

  // Collection Hooks
  private _onCollectionCreate = new Hook<CollectionEvent>();
  private _onCollectionCreateExecute = new Hook<CollectionEvent>();
  private _onCollectionAfterCreateSuccess = new Hook<CollectionEvent>();
  private _onCollectionUpdate = new Hook<CollectionEvent>();
  private _onCollectionUpdateExecute = new Hook<CollectionEvent>();
  private _onCollectionAfterUpdateSuccess = new Hook<CollectionEvent>();
  private _onCollectionDelete = new Hook<CollectionEvent>();
  private _onCollectionDeleteExecute = new Hook<CollectionEvent>();
  private _onCollectionAfterDeleteSuccess = new Hook<CollectionEvent>();
  private _onCollectionValidate = new Hook<CollectionEvent>();

  // Collection Request Hooks
  private _onCollectionsListRequest = new Hook<CollectionEvent>();
  private _onCollectionViewRequest = new Hook<CollectionEvent>();
  private _onCollectionCreateRequest = new Hook<CollectionEvent>();
  private _onCollectionUpdateRequest = new Hook<CollectionEvent>();
  private _onCollectionDeleteRequest = new Hook<CollectionEvent>();
  private _onCollectionsImportRequest = new Hook<CollectionEvent>();

  // Collection Error Hooks
  private _onCollectionAfterCreateError = new Hook<CollectionErrorEvent>();
  private _onCollectionAfterUpdateError = new Hook<CollectionErrorEvent>();
  private _onCollectionAfterDeleteError = new Hook<CollectionErrorEvent>();

  // Settings Hooks
  private _onSettingsListRequest = new Hook<SettingsListRequestEvent>();
  private _onSettingsUpdateRequest = new Hook<SettingsUpdateRequestEvent>();
  private _onSettingsReload = new Hook<SettingsReloadEvent>();

  // Realtime Hooks
  private _onRealtimeConnectRequest = new Hook<RealtimeConnectRequestEvent>();
  private _onRealtimeSubscribeRequest = new Hook<RealtimeSubscribeRequestEvent>();
  private _onRealtimeMessageSend = new Hook<RealtimeMessageEvent>();

  // File Hooks
  private _onFileDownloadRequest = new Hook<FileDownloadRequestEvent>();
  private _onFileTokenRequest = new Hook<FileTokenRequestEvent>();

  // Batch Hook
  private _onBatchRequest = new Hook<BatchRequestEvent>();

  // Backup Hooks
  private _onBackupCreate = new Hook<BackupEvent>();
  private _onBackupRestore = new Hook<BackupEvent>();

  // Record Enrich Hook (tagged)
  private _onRecordEnrich = new TaggedHook<RecordEnrichEvent>();

  // Mail Hooks (tagged)
  private _onMailerSend = new TaggedHook<MailEvent>();
  private _onMailerRecordPasswordResetSend = new TaggedHook<MailEvent>();
  private _onMailerRecordVerificationSend = new TaggedHook<MailEvent>();
  private _onMailerRecordEmailChangeSend = new TaggedHook<MailEvent>();
  private _onMailerRecordOTPSend = new TaggedHook<MailEvent>();
  private _onMailerRecordAuthAlertSend = new TaggedHook<MailEvent>();

  constructor(config: BaseAppConfig) {
    this.config = config;
  }

  // ─── 生命周期 ───

  async bootstrap(): Promise<void> {
    if (this._bootstrapped) return;

    if (!existsSync(this.config.dataDir)) {
      mkdirSync(this.config.dataDir, { recursive: true });
    }

    if (this.config.pgDSN) {
      await this.initPostgres();
    } else {
      this.initSQLite();
    }

    // 运行系统迁移（使用 DBAdapter 直接执行）
    const { getSystemMigrations } = await import("../migrations/index");
    const systemMigrations = getSystemMigrations();
    // 确保 _migrations 表存在（记录已应用的系统迁移）
    this._adapter!.exec(`
      CREATE TABLE IF NOT EXISTS _migrations (
        file    VARCHAR(255) PRIMARY KEY NOT NULL,
        applied BIGINT NOT NULL
      )
    `);
    for (const m of systemMigrations) {
      const row = this._adapter!.queryOne<{ file: string }>(
        "SELECT file FROM _migrations WHERE file = ?", m.file,
      );
      if (row) continue;
      m.up(this._adapter!, this._auxiliaryAdapter!);
      this._adapter!.exec(
        "INSERT INTO _migrations (file, applied) VALUES (?, ?)",
        m.file, Date.now() * 1000,
      );
    }

    await this.loadSettings();

    this._bootstrapped = true;

    await this._onBootstrap.trigger({
      app: this,
      next: async () => {},
    });
  }

  async shutdown(): Promise<void> {
    await this._onTerminate.trigger({
      app: this,
      isRestart: false,
      next: async () => {},
    });

    for (const job of this._cronJobs.values()) {
      job.stop();
    }

    if (this._adapter) await this._adapter.close();
    if (this._auxiliaryAdapter && this._auxiliaryAdapter !== this._adapter) {
      await this._auxiliaryAdapter.close();
    }

    this._bootstrapped = false;
  }

  isBootstrapped(): boolean {
    return this._bootstrapped;
  }

  // ─── 配置 ───

  dataDir(): string { return this.config.dataDir; }
  isDev(): boolean { return this.config.isDev; }
  settings(): Record<string, unknown> { return this._settings; }
  encryptionEnv(): string { return this.config.encryptionEnv || ""; }

  // ─── 数据库 ───

  db(): QueryBuilder {
    if (!this._db) throw new Error("数据库未初始化");
    return this._db;
  }

  auxiliaryDB(): QueryBuilder {
    if (!this._auxiliaryDB) throw new Error("辅助数据库未初始化");
    return this._auxiliaryDB;
  }

  dbAdapter(): DBAdapter {
    if (!this._adapter) throw new Error("数据库适配器未初始化");
    return this._adapter;
  }

  auxiliaryDbAdapter(): DBAdapter {
    if (!this._auxiliaryAdapter) throw new Error("辅助数据库适配器未初始化");
    return this._auxiliaryAdapter;
  }

  async runInTransaction<T>(fn: (txApp: BaseApp) => Promise<T>): Promise<T> {
    const { createTxApp } = await import("./tx_app");
    const adapter = this.dbAdapter();
    if (adapter.type() === "sqlite") {
      // bun:sqlite 的 transaction() 不支持 async callback，需手动管理
      adapter.exec("BEGIN IMMEDIATE");
      const txApp = createTxApp(this, adapter);
      try {
        const result = await fn(txApp);
        adapter.exec("COMMIT");
        return result;
      } catch (err) {
        adapter.exec("ROLLBACK");
        throw err;
      }
    } else {
      return await this.db().getKysely().transaction().execute(async () => {
        const txApp = createTxApp(this, adapter);
        return await fn(txApp);
      });
    }
  }

  isTransactional(): boolean {
    return false;
  }

  // ─── CRUD（委派到 db.ts） ───

  async save(model: unknown): Promise<void> {
    const { modelSave } = await import("./db");
    await modelSave(this, model as any);
  }

  async delete(model: unknown): Promise<void> {
    const { modelDelete } = await import("./db");
    await modelDelete(this, model as any);
  }

  async validate(model: unknown): Promise<void> {
    const { modelValidate } = await import("./db");
    await modelValidate(this, model as any);
  }

  // ─── Collection 查询 ───

  async findCollectionByNameOrId(nameOrId: string): Promise<CollectionModel | null> {
    const row = this._adapter!.queryOne(
      `SELECT * FROM _collections WHERE id = ? OR name = ? LIMIT 1`,
      nameOrId, nameOrId,
    );
    if (!row) return null;
    const col = new CollectionModel();
    col.load(row as Record<string, unknown>);
    return col;
  }

  async findAllCollections(...types: string[]): Promise<CollectionModel[]> {
    let sql = "SELECT * FROM _collections";
    const params: unknown[] = [];
    if (types.length > 0) {
      sql += ` WHERE type IN (${types.map(() => "?").join(", ")})`;
      params.push(...types);
    }
    sql += " ORDER BY created ASC";

    const rows = this._adapter!.query(sql, ...params);
    return rows.map((row) => {
      const col = new CollectionModel();
      col.load(row as Record<string, unknown>);
      return col;
    });
  }

  // ─── Record 查询 ───

  async findRecordById(collectionNameOrId: string, id: string): Promise<RecordModel | null> {
    const col = await this.findCollectionByNameOrId(collectionNameOrId);
    if (!col) return null;
    const row = this._adapter!.queryOne(`SELECT * FROM ${col.name} WHERE id = ?`, id);
    if (!row) return null;
    const record = new RecordModel(col);
    record.load(row as Record<string, unknown>);
    return record;
  }

  /** 通过 email 查找 Auth Record */
  async findAuthRecordByEmail(collectionNameOrId: string, email: string): Promise<RecordModel | null> {
    const col = await this.findCollectionByNameOrId(collectionNameOrId);
    if (!col || !col.isAuth()) return null;
    const row = this._adapter!.queryOne(
      `SELECT * FROM ${col.name} WHERE email = ? COLLATE NOCASE LIMIT 1`,
      email,
    );
    if (!row) return null;
    const record = new RecordModel(col);
    record.load(row as Record<string, unknown>);
    return record;
  }

  /** 通过任意 identity 字段查找 Record（与 Go 版 findRecordByIdentityField 对齐） */
  async findRecordByIdentityField(
    collection: CollectionModel,
    field: string,
    value: unknown,
  ): Promise<RecordModel | null> {
    const row = this._adapter!.queryOne(
      `SELECT * FROM ${collection.name} WHERE [[${field}]] = ? LIMIT 1`,
      value,
    );
    if (!row) return null;
    const record = new RecordModel(collection);
    record.load(row as Record<string, unknown>);
    return record;
  }

  async findRecordsByFilter(
    collectionNameOrId: string,
    filter: string,
    sort?: string,
    limit?: number,
    offset?: number,
  ): Promise<RecordModel[]> {
    const col = await this.findCollectionByNameOrId(collectionNameOrId);
    if (!col) return [];

    let sql = `SELECT * FROM ${col.name}`;
    if (filter) sql += ` WHERE ${filter}`;
    if (sort) sql += ` ORDER BY ${sort}`;
    if (limit) sql += ` LIMIT ${limit}`;
    if (offset) sql += ` OFFSET ${offset}`;

    const rows = this._adapter!.query(sql);
    return rows.map((row) => {
      const record = new RecordModel(col);
      record.load(row as Record<string, unknown>);
      return record;
    });
  }

  async countRecords(collectionNameOrId: string, filter?: string): Promise<number> {
    const col = await this.findCollectionByNameOrId(collectionNameOrId);
    if (!col) return 0;
    let sql = `SELECT COUNT(*) as count FROM ${col.name}`;
    if (filter) sql += ` WHERE ${filter}`;
    const row = this._adapter!.queryOne<{ count: number }>(sql);
    return row?.count ?? 0;
  }

  // ─── Store ───

  store(): Store { return this._store; }

  // ─── Cron ───

  cronAdd(jobId: string, expression: string, handler: () => Promise<void> | void): void {
    const existing = this._cronJobs.get(jobId);
    if (existing) existing.stop();
    const job = new Cron(expression, { name: jobId }, handler);
    this._cronJobs.set(jobId, job);
  }

  cronRemove(jobId: string): void {
    const job = this._cronJobs.get(jobId);
    if (job) {
      job.stop();
      this._cronJobs.delete(jobId);
    }
  }

  cronJobs(): Array<{ id: string; expression: string }> {
    const result: Array<{ id: string; expression: string }> = [];
    for (const [id, job] of this._cronJobs) {
      result.push({ id, expression: job.getPattern() });
    }
    return result;
  }

  // ─── Hook 访问器：生命周期 ───

  onBootstrap(): Hook<BootstrapEvent> { return this._onBootstrap; }
  onServe(): Hook<ServeEvent> { return this._onServe; }
  onBeforeServe(): Hook<ServeEvent> { return this._onBeforeServe; }
  onTerminate(): Hook<TerminateEvent> { return this._onTerminate; }

  // ─── Hook 访问器：Model ───

  onModelCreate(): Hook<ModelEvent> { return this._onModelCreate; }
  onModelCreateExecute(): Hook<ModelEvent> { return this._onModelCreateExecute; }
  onModelAfterCreateSuccess(): Hook<ModelEvent> { return this._onModelAfterCreateSuccess; }
  onModelAfterCreateError(): Hook<ModelEvent> { return this._onModelAfterCreateError; }
  onModelUpdate(): Hook<ModelEvent> { return this._onModelUpdate; }
  onModelUpdateExecute(): Hook<ModelEvent> { return this._onModelUpdateExecute; }
  onModelAfterUpdateSuccess(): Hook<ModelEvent> { return this._onModelAfterUpdateSuccess; }
  onModelAfterUpdateError(): Hook<ModelEvent> { return this._onModelAfterUpdateError; }
  onModelDelete(): Hook<ModelEvent> { return this._onModelDelete; }
  onModelDeleteExecute(): Hook<ModelEvent> { return this._onModelDeleteExecute; }
  onModelAfterDeleteSuccess(): Hook<ModelEvent> { return this._onModelAfterDeleteSuccess; }
  onModelAfterDeleteError(): Hook<ModelEvent> { return this._onModelAfterDeleteError; }
  onModelValidate(): Hook<ModelEvent> { return this._onModelValidate; }

  // ─── Hook 访问器：Record（支持标签过滤） ───
  // 无参数 → 返回全局 hook（所有 collection 触发）
  // 带参数 → 返回标签视图（仅匹配指定 collection 时触发）

  onRecordCreate(...tags: string[]): TaggedHook<RecordEvent> | TaggedHookView<RecordEvent> {
    return tags.length > 0 ? new TaggedHookView(this._onRecordCreate, tags) : this._onRecordCreate;
  }
  onRecordCreateExecute(...tags: string[]): TaggedHook<RecordEvent> | TaggedHookView<RecordEvent> {
    return tags.length > 0 ? new TaggedHookView(this._onRecordCreateExecute, tags) : this._onRecordCreateExecute;
  }
  onRecordAfterCreateSuccess(...tags: string[]): TaggedHook<RecordEvent> | TaggedHookView<RecordEvent> {
    return tags.length > 0 ? new TaggedHookView(this._onRecordAfterCreateSuccess, tags) : this._onRecordAfterCreateSuccess;
  }
  onRecordAfterCreateError(...tags: string[]): TaggedHook<RecordEvent> | TaggedHookView<RecordEvent> {
    return tags.length > 0 ? new TaggedHookView(this._onRecordAfterCreateError, tags) : this._onRecordAfterCreateError;
  }
  onRecordUpdate(...tags: string[]): TaggedHook<RecordEvent> | TaggedHookView<RecordEvent> {
    return tags.length > 0 ? new TaggedHookView(this._onRecordUpdate, tags) : this._onRecordUpdate;
  }
  onRecordUpdateExecute(...tags: string[]): TaggedHook<RecordEvent> | TaggedHookView<RecordEvent> {
    return tags.length > 0 ? new TaggedHookView(this._onRecordUpdateExecute, tags) : this._onRecordUpdateExecute;
  }
  onRecordAfterUpdateSuccess(...tags: string[]): TaggedHook<RecordEvent> | TaggedHookView<RecordEvent> {
    return tags.length > 0 ? new TaggedHookView(this._onRecordAfterUpdateSuccess, tags) : this._onRecordAfterUpdateSuccess;
  }
  onRecordAfterUpdateError(...tags: string[]): TaggedHook<RecordEvent> | TaggedHookView<RecordEvent> {
    return tags.length > 0 ? new TaggedHookView(this._onRecordAfterUpdateError, tags) : this._onRecordAfterUpdateError;
  }
  onRecordDelete(...tags: string[]): TaggedHook<RecordEvent> | TaggedHookView<RecordEvent> {
    return tags.length > 0 ? new TaggedHookView(this._onRecordDelete, tags) : this._onRecordDelete;
  }
  onRecordDeleteExecute(...tags: string[]): TaggedHook<RecordEvent> | TaggedHookView<RecordEvent> {
    return tags.length > 0 ? new TaggedHookView(this._onRecordDeleteExecute, tags) : this._onRecordDeleteExecute;
  }
  onRecordAfterDeleteSuccess(...tags: string[]): TaggedHook<RecordEvent> | TaggedHookView<RecordEvent> {
    return tags.length > 0 ? new TaggedHookView(this._onRecordAfterDeleteSuccess, tags) : this._onRecordAfterDeleteSuccess;
  }
  onRecordAfterDeleteError(...tags: string[]): TaggedHook<RecordEvent> | TaggedHookView<RecordEvent> {
    return tags.length > 0 ? new TaggedHookView(this._onRecordAfterDeleteError, tags) : this._onRecordAfterDeleteError;
  }
  onRecordValidate(...tags: string[]): TaggedHook<RecordEvent> | TaggedHookView<RecordEvent> {
    return tags.length > 0 ? new TaggedHookView(this._onRecordValidate, tags) : this._onRecordValidate;
  }

  // ─── Hook 访问器：Record Auth ───

  onRecordAuthRequest(...tags: string[]): TaggedHook<RecordAuthEvent> | TaggedHookView<RecordAuthEvent> {
    return tags.length > 0 ? new TaggedHookView(this._onRecordAuthRequest, tags) : this._onRecordAuthRequest;
  }
  onRecordAuthRefreshRequest(...tags: string[]): TaggedHook<RecordAuthEvent> | TaggedHookView<RecordAuthEvent> {
    return tags.length > 0 ? new TaggedHookView(this._onRecordAuthRefreshRequest, tags) : this._onRecordAuthRefreshRequest;
  }
  onRecordAuthWithPasswordRequest(...tags: string[]): TaggedHook<RecordAuthEvent> | TaggedHookView<RecordAuthEvent> {
    return tags.length > 0 ? new TaggedHookView(this._onRecordAuthWithPasswordRequest, tags) : this._onRecordAuthWithPasswordRequest;
  }
  onRecordAuthWithOAuth2Request(...tags: string[]): TaggedHook<RecordAuthEvent> | TaggedHookView<RecordAuthEvent> {
    return tags.length > 0 ? new TaggedHookView(this._onRecordAuthWithOAuth2Request, tags) : this._onRecordAuthWithOAuth2Request;
  }
  onRecordAuthWithOTPRequest(...tags: string[]): TaggedHook<RecordAuthEvent> | TaggedHookView<RecordAuthEvent> {
    return tags.length > 0 ? new TaggedHookView(this._onRecordAuthWithOTPRequest, tags) : this._onRecordAuthWithOTPRequest;
  }
  onRecordRequestPasswordResetRequest(...tags: string[]): TaggedHook<RecordEvent> | TaggedHookView<RecordEvent> {
    return tags.length > 0 ? new TaggedHookView(this._onRecordRequestPasswordResetRequest, tags) : this._onRecordRequestPasswordResetRequest;
  }
  onRecordConfirmPasswordResetRequest(...tags: string[]): TaggedHook<RecordEvent> | TaggedHookView<RecordEvent> {
    return tags.length > 0 ? new TaggedHookView(this._onRecordConfirmPasswordResetRequest, tags) : this._onRecordConfirmPasswordResetRequest;
  }
  onRecordRequestVerificationRequest(...tags: string[]): TaggedHook<RecordEvent> | TaggedHookView<RecordEvent> {
    return tags.length > 0 ? new TaggedHookView(this._onRecordRequestVerificationRequest, tags) : this._onRecordRequestVerificationRequest;
  }
  onRecordConfirmVerificationRequest(...tags: string[]): TaggedHook<RecordEvent> | TaggedHookView<RecordEvent> {
    return tags.length > 0 ? new TaggedHookView(this._onRecordConfirmVerificationRequest, tags) : this._onRecordConfirmVerificationRequest;
  }
  onRecordRequestEmailChangeRequest(...tags: string[]): TaggedHook<RecordEvent> | TaggedHookView<RecordEvent> {
    return tags.length > 0 ? new TaggedHookView(this._onRecordRequestEmailChangeRequest, tags) : this._onRecordRequestEmailChangeRequest;
  }
  onRecordConfirmEmailChangeRequest(...tags: string[]): TaggedHook<RecordEvent> | TaggedHookView<RecordEvent> {
    return tags.length > 0 ? new TaggedHookView(this._onRecordConfirmEmailChangeRequest, tags) : this._onRecordConfirmEmailChangeRequest;
  }

  // ─── Hook 访问器：Record CRUD Request ───

  onRecordsListRequest(...tags: string[]): TaggedHook<RecordListEvent> | TaggedHookView<RecordListEvent> {
    return tags.length > 0 ? new TaggedHookView(this._onRecordsListRequest, tags) : this._onRecordsListRequest;
  }
  onRecordViewRequest(...tags: string[]): TaggedHook<RecordRequestEvent> | TaggedHookView<RecordRequestEvent> {
    return tags.length > 0 ? new TaggedHookView(this._onRecordViewRequest, tags) : this._onRecordViewRequest;
  }
  onRecordCreateRequest(...tags: string[]): TaggedHook<RecordRequestEvent> | TaggedHookView<RecordRequestEvent> {
    return tags.length > 0 ? new TaggedHookView(this._onRecordCreateRequest, tags) : this._onRecordCreateRequest;
  }
  onRecordUpdateRequest(...tags: string[]): TaggedHook<RecordRequestEvent> | TaggedHookView<RecordRequestEvent> {
    return tags.length > 0 ? new TaggedHookView(this._onRecordUpdateRequest, tags) : this._onRecordUpdateRequest;
  }
  onRecordDeleteRequest(...tags: string[]): TaggedHook<RecordRequestEvent> | TaggedHookView<RecordRequestEvent> {
    return tags.length > 0 ? new TaggedHookView(this._onRecordDeleteRequest, tags) : this._onRecordDeleteRequest;
  }

  // ─── Hook 访问器：Collection ───

  onCollectionCreate(): Hook<CollectionEvent> { return this._onCollectionCreate; }
  onCollectionCreateExecute(): Hook<CollectionEvent> { return this._onCollectionCreateExecute; }
  onCollectionAfterCreateSuccess(): Hook<CollectionEvent> { return this._onCollectionAfterCreateSuccess; }
  onCollectionUpdate(): Hook<CollectionEvent> { return this._onCollectionUpdate; }
  onCollectionUpdateExecute(): Hook<CollectionEvent> { return this._onCollectionUpdateExecute; }
  onCollectionAfterUpdateSuccess(): Hook<CollectionEvent> { return this._onCollectionAfterUpdateSuccess; }
  onCollectionDelete(): Hook<CollectionEvent> { return this._onCollectionDelete; }
  onCollectionDeleteExecute(): Hook<CollectionEvent> { return this._onCollectionDeleteExecute; }
  onCollectionAfterDeleteSuccess(): Hook<CollectionEvent> { return this._onCollectionAfterDeleteSuccess; }
  onCollectionValidate(): Hook<CollectionEvent> { return this._onCollectionValidate; }
  onCollectionAfterCreateError(): Hook<CollectionErrorEvent> { return this._onCollectionAfterCreateError; }
  onCollectionAfterUpdateError(): Hook<CollectionErrorEvent> { return this._onCollectionAfterUpdateError; }
  onCollectionAfterDeleteError(): Hook<CollectionErrorEvent> { return this._onCollectionAfterDeleteError; }

  // Collection Request Hooks
  onCollectionsListRequest(): Hook<CollectionEvent> { return this._onCollectionsListRequest; }
  onCollectionViewRequest(): Hook<CollectionEvent> { return this._onCollectionViewRequest; }
  onCollectionCreateRequest(): Hook<CollectionEvent> { return this._onCollectionCreateRequest; }
  onCollectionUpdateRequest(): Hook<CollectionEvent> { return this._onCollectionUpdateRequest; }
  onCollectionDeleteRequest(): Hook<CollectionEvent> { return this._onCollectionDeleteRequest; }
  onCollectionsImportRequest(): Hook<CollectionEvent> { return this._onCollectionsImportRequest; }

  // ─── Hook 访问器：Settings ───

  onSettingsListRequest(): Hook<SettingsListRequestEvent> { return this._onSettingsListRequest; }
  onSettingsUpdateRequest(): Hook<SettingsUpdateRequestEvent> { return this._onSettingsUpdateRequest; }
  onSettingsReload(): Hook<SettingsReloadEvent> { return this._onSettingsReload; }

  // ─── Hook 访问器：Realtime ───

  onRealtimeConnectRequest(): Hook<RealtimeConnectRequestEvent> { return this._onRealtimeConnectRequest; }
  onRealtimeSubscribeRequest(): Hook<RealtimeSubscribeRequestEvent> { return this._onRealtimeSubscribeRequest; }
  onRealtimeMessageSend(): Hook<RealtimeMessageEvent> { return this._onRealtimeMessageSend; }

  // ─── Hook 访问器：File ───

  onFileDownloadRequest(): Hook<FileDownloadRequestEvent> { return this._onFileDownloadRequest; }
  onFileTokenRequest(): Hook<FileTokenRequestEvent> { return this._onFileTokenRequest; }

  // ─── Hook 访问器：Batch ───

  onBatchRequest(): Hook<BatchRequestEvent> { return this._onBatchRequest; }

  // ─── Hook 访问器：Backup ───

  onBackupCreate(): Hook<BackupEvent> { return this._onBackupCreate; }
  onBackupRestore(): Hook<BackupEvent> { return this._onBackupRestore; }

  // ─── Hook 访问器：Record Enrich ───

  onRecordEnrich(...tags: string[]): TaggedHook<RecordEnrichEvent> | TaggedHookView<RecordEnrichEvent> {
    return tags.length > 0 ? new TaggedHookView(this._onRecordEnrich, tags) : this._onRecordEnrich;
  }

  // ─── Hook 访问器：Mail ───

  onMailerSend(...tags: string[]): TaggedHook<MailEvent> | TaggedHookView<MailEvent> {
    return tags.length > 0 ? new TaggedHookView(this._onMailerSend, tags) : this._onMailerSend;
  }
  onMailerRecordPasswordResetSend(...tags: string[]): TaggedHook<MailEvent> | TaggedHookView<MailEvent> {
    return tags.length > 0 ? new TaggedHookView(this._onMailerRecordPasswordResetSend, tags) : this._onMailerRecordPasswordResetSend;
  }
  onMailerRecordVerificationSend(...tags: string[]): TaggedHook<MailEvent> | TaggedHookView<MailEvent> {
    return tags.length > 0 ? new TaggedHookView(this._onMailerRecordVerificationSend, tags) : this._onMailerRecordVerificationSend;
  }
  onMailerRecordEmailChangeSend(...tags: string[]): TaggedHook<MailEvent> | TaggedHookView<MailEvent> {
    return tags.length > 0 ? new TaggedHookView(this._onMailerRecordEmailChangeSend, tags) : this._onMailerRecordEmailChangeSend;
  }
  onMailerRecordOTPSend(...tags: string[]): TaggedHook<MailEvent> | TaggedHookView<MailEvent> {
    return tags.length > 0 ? new TaggedHookView(this._onMailerRecordOTPSend, tags) : this._onMailerRecordOTPSend;
  }
  onMailerRecordAuthAlertSend(...tags: string[]): TaggedHook<MailEvent> | TaggedHookView<MailEvent> {
    return tags.length > 0 ? new TaggedHookView(this._onMailerRecordAuthAlertSend, tags) : this._onMailerRecordAuthAlertSend;
  }

  // ─── T059: newFilesystem ───

  async newFilesystem(): Promise<Filesystem> {
    const s3 = (this._settings as any)?.s3;
    if (s3?.enabled) {
      const { S3Filesystem } = await import("../tools/filesystem/s3");
      return new S3Filesystem({
        bucket: s3.bucket,
        region: s3.region,
        endpoint: s3.endpoint,
        accessKeyId: s3.accessKey,
        secretAccessKey: s3.secret,
        forcePathStyle: s3.forcePathStyle,
      });
    }
    const { LocalFilesystem } = await import("../tools/filesystem/local");
    return new LocalFilesystem(join(this.config.dataDir, "storage"));
  }

  // ─── T060: newBackupsFilesystem ───

  async newBackupsFilesystem(): Promise<Filesystem> {
    const backups = (this._settings as any)?.backups?.s3;
    if (backups?.enabled) {
      const { S3Filesystem } = await import("../tools/filesystem/s3");
      return new S3Filesystem({
        bucket: backups.bucket,
        region: backups.region,
        endpoint: backups.endpoint,
        accessKeyId: backups.accessKey,
        secretAccessKey: backups.secret,
        forcePathStyle: backups.forcePathStyle,
      });
    }
    const { LocalFilesystem } = await import("../tools/filesystem/local");
    return new LocalFilesystem(join(this.config.dataDir, "backups"));
  }

  // ─── T061: newMailClient ───

  newMailClient(): Mailer {
    const smtp = (this._settings as any)?.smtp;
    if (smtp?.enabled) {
      // 延迟导入避免在没有 nodemailer 时报错
      const { SMTPClient } = require("../tools/mailer/mailer");
      return new SMTPClient({
        host: smtp.host,
        port: smtp.port,
        username: smtp.username,
        password: smtp.password,
        tls: smtp.tls,
      });
    }
    // Sendmail fallback
    const { Sendmail } = require("../tools/mailer/mailer");
    return new Sendmail();
  }

  // ─── T062: logger ───

  logger(): Logger {
    if (!this._logger) {
      this._logger = new Logger({
        level: this.config.isDev ? LogLevel.DEBUG : LogLevel.INFO,
        handler: (entry) => {
          const prefix = `[${entry.level}]`;
          const dataStr = Object.keys(entry.data).length > 0
            ? " " + JSON.stringify(entry.data)
            : "";
          console.log(`${prefix} ${entry.message}${dataStr}`);
        },
      });
    }
    return this._logger;
  }

  // ─── T063: unsafeWithoutHooks ───

  unsafeWithoutHooks(): BaseApp {
    const clone = Object.create(Object.getPrototypeOf(this));
    Object.assign(clone, this);
    // 重置所有 hook 实例为空 hook
    clone._initEmptyHooks();
    return clone;
  }

  private _initEmptyHooks(): void {
    this._onBootstrap = new Hook();
    this._onServe = new Hook();
    this._onTerminate = new Hook();
    this._onBeforeServe = new Hook();
    this._onModelCreate = new Hook();
    this._onModelCreateExecute = new Hook();
    this._onModelAfterCreateSuccess = new Hook();
    this._onModelAfterCreateError = new Hook();
    this._onModelUpdate = new Hook();
    this._onModelUpdateExecute = new Hook();
    this._onModelAfterUpdateSuccess = new Hook();
    this._onModelAfterUpdateError = new Hook();
    this._onModelDelete = new Hook();
    this._onModelDeleteExecute = new Hook();
    this._onModelAfterDeleteSuccess = new Hook();
    this._onModelAfterDeleteError = new Hook();
    this._onModelValidate = new Hook();
    this._onRecordCreate = new TaggedHook();
    this._onRecordCreateExecute = new TaggedHook();
    this._onRecordAfterCreateSuccess = new TaggedHook();
    this._onRecordAfterCreateError = new TaggedHook();
    this._onRecordUpdate = new TaggedHook();
    this._onRecordUpdateExecute = new TaggedHook();
    this._onRecordAfterUpdateSuccess = new TaggedHook();
    this._onRecordAfterUpdateError = new TaggedHook();
    this._onRecordDelete = new TaggedHook();
    this._onRecordDeleteExecute = new TaggedHook();
    this._onRecordAfterDeleteSuccess = new TaggedHook();
    this._onRecordAfterDeleteError = new TaggedHook();
    this._onRecordValidate = new TaggedHook();
    this._onRecordAuthRequest = new TaggedHook();
    this._onRecordAuthRefreshRequest = new TaggedHook();
    this._onRecordAuthWithPasswordRequest = new TaggedHook();
    this._onRecordAuthWithOAuth2Request = new TaggedHook();
    this._onRecordAuthWithOTPRequest = new TaggedHook();
    this._onRecordRequestPasswordResetRequest = new TaggedHook();
    this._onRecordConfirmPasswordResetRequest = new TaggedHook();
    this._onRecordRequestVerificationRequest = new TaggedHook();
    this._onRecordConfirmVerificationRequest = new TaggedHook();
    this._onRecordRequestEmailChangeRequest = new TaggedHook();
    this._onRecordConfirmEmailChangeRequest = new TaggedHook();
    this._onRecordsListRequest = new TaggedHook();
    this._onRecordViewRequest = new TaggedHook();
    this._onRecordCreateRequest = new TaggedHook();
    this._onRecordUpdateRequest = new TaggedHook();
    this._onRecordDeleteRequest = new TaggedHook();
    this._onCollectionCreate = new Hook();
    this._onCollectionCreateExecute = new Hook();
    this._onCollectionAfterCreateSuccess = new Hook();
    this._onCollectionUpdate = new Hook();
    this._onCollectionUpdateExecute = new Hook();
    this._onCollectionAfterUpdateSuccess = new Hook();
    this._onCollectionDelete = new Hook();
    this._onCollectionDeleteExecute = new Hook();
    this._onCollectionAfterDeleteSuccess = new Hook();
    this._onCollectionValidate = new Hook();
    this._onCollectionsListRequest = new Hook();
    this._onCollectionViewRequest = new Hook();
    this._onCollectionCreateRequest = new Hook();
    this._onCollectionUpdateRequest = new Hook();
    this._onCollectionDeleteRequest = new Hook();
    this._onCollectionsImportRequest = new Hook();
    this._onCollectionAfterCreateError = new Hook();
    this._onCollectionAfterUpdateError = new Hook();
    this._onCollectionAfterDeleteError = new Hook();
    this._onSettingsListRequest = new Hook();
    this._onSettingsUpdateRequest = new Hook();
    this._onSettingsReload = new Hook();
    this._onRealtimeConnectRequest = new Hook();
    this._onRealtimeSubscribeRequest = new Hook();
    this._onRealtimeMessageSend = new Hook();
    this._onFileDownloadRequest = new Hook();
    this._onFileTokenRequest = new Hook();
    this._onBatchRequest = new Hook();
    this._onBackupCreate = new Hook();
    this._onBackupRestore = new Hook();
    this._onRecordEnrich = new TaggedHook();
    this._onMailerSend = new TaggedHook();
    this._onMailerRecordPasswordResetSend = new TaggedHook();
    this._onMailerRecordVerificationSend = new TaggedHook();
    this._onMailerRecordEmailChangeSend = new TaggedHook();
    this._onMailerRecordOTPSend = new TaggedHook();
    this._onMailerRecordAuthAlertSend = new TaggedHook();
  }

  // ─── 私有方法 ───

  private initSQLite(): void {
    const mainPath = join(this.config.dataDir, "data.db");
    const auxPath = join(this.config.dataDir, "auxiliary.db");

    this._adapter = new SQLiteAdapter(mainPath);
    this._auxiliaryAdapter = new SQLiteAdapter(auxPath);

    this._db = new QueryBuilder(this._adapter);
    this._auxiliaryDB = new QueryBuilder(this._auxiliaryAdapter);
  }

  private async initPostgres(): Promise<void> {
    const { PostgresAdapter } = await import("./db_adapter_postgres");
    this._adapter = new PostgresAdapter(this.config.pgDSN!);
    await (this._adapter as any).init();

    this._auxiliaryAdapter = this._adapter;
    this._db = new QueryBuilder(this._adapter);
    this._auxiliaryDB = this._db;
  }

  private async loadSettings(): Promise<void> {
    try {
      const row = this._adapter!.queryOne<{ value: string }>(
        `SELECT value FROM _params WHERE key = ?`,
        "settings",
      );
      if (row?.value) {
        this._settings = typeof row.value === "string" ? JSON.parse(row.value) : row.value;
      }
    } catch {
      this._settings = {};
    }
  }
}
