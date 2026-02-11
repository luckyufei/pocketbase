# Pocketless — Bun.js + Hono 版 PocketBase 设计文档

> **目标**: 使用 Bun.js + Hono + TypeScript 重新实现 PocketBase 的完整功能，与 Go 版共享相同的 SDK、Admin 控制台、数据库表结构和 REST API。

---

## 目录

1. [项目概述](#1-项目概述)
2. [架构总览](#2-架构总览)
3. [技术选型](#3-技术选型)
4. [核心层设计](#4-核心层设计)
5. [数据库抽象层](#5-数据库抽象层)
6. [模型系统](#6-模型系统)
7. [字段系统](#7-字段系统)
8. [Hook/事件系统](#8-hook事件系统)
9. [API 路由层](#9-api-路由层)
10. [中间件系统](#10-中间件系统)
11. [认证系统](#11-认证系统)
12. [搜索/过滤引擎](#12-搜索过滤引擎)
13. [实时订阅 (SSE)](#13-实时订阅-sse)
14. [文件系统](#14-文件系统)
15. [迁移系统](#15-迁移系统)
16. [插件系统](#16-插件系统)
17. [CLI 系统](#17-cli-系统)
18. [Settings 管理](#18-settings-管理)
19. [目录结构](#19-目录结构)
20. [API 兼容性矩阵](#20-api-兼容性矩阵)
21. [数据库表结构](#21-数据库表结构)
22. [与 Go 版的差异点](#22-与-go-版的差异点)
23. [开发路线图](#23-开发路线图)
24. [测试策略](#24-测试策略)

---

## 1. 项目概述

### 1.1 为什么做 Pocketless

| 维度 | PocketBase (Go) | Pocketless (Bun.js) |
|------|-----------------|---------------------|
| 运行时 | 单二进制 (CGO_ENABLED=0) | Bun 单进程或 `bun build --compile` |
| 生态 | Go 生态 | npm 生态，JS/TS 开发者友好 |
| 扩展方式 | Go 编译 或 Goja JS VM | 原生 TypeScript，直接 import |
| 启动速度 | ~50ms | ~20ms (Bun bytecode) |
| 部署 | 单二进制 | `bun build --compile` 单二进制 |

### 1.2 核心约束

1. **API 100% 兼容** — 所有 REST API 路径、参数、响应体必须与 Go 版完全一致
2. **表结构 100% 兼容** — 同一个数据库可被 Go 版和 Bun.js 版交替启动（共享 `pb_data`）
3. **SDK 100% 兼容** — JS SDK、Dart SDK 无需修改即可连接 Pocketless
4. **Admin UI 100% 兼容** — 共享同一个 `webui/` 构建产物
5. **双数据库支持** — SQLite (默认) + PostgreSQL

### 1.3 命名约定

| 概念 | Go 版 | Bun.js 版 |
|------|-------|-----------|
| 项目名 | PocketBase | Pocketless |
| 入口命令 | `./pocketbase serve` | `bun run serve` / `./pocketless serve` |
| 包名 | `github.com/pocketbase/pocketbase` | `pocketless` (npm) |
| 环境变量前缀 | `PB_` | `PB_` (保持一致) |

---

## 2. 架构总览

```
┌─────────────────────────────────────────────────────────────┐
│                        Pocketless                            │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │               CLI Layer (Commander.js)                  │  │
│  │   serve | superuser | migrate                           │  │
│  └──────────┬─────────────────────────────────────────────┘  │
│             │                                                │
│  ┌──────────▼─────────────────────────────────────────────┐  │
│  │               API Layer (Hono)                          │  │
│  │  Records CRUD │ Auth (5 flows) │ Files │ SSE │ Batch   │  │
│  │  ─────────────────────────────────────────────────     │  │
│  │  Middleware: Logger→Panic→Rate→Auth→Security→Body      │  │
│  └──────────┬─────────────────────────────────────────────┘  │
│             │                                                │
│  ┌──────────▼─────────────────────────────────────────────┐  │
│  │               Core Layer                                │  │
│  │  App │ Hook System │ Fields │ Models │ Store │ Settings │  │
│  │  Search/Filter Parser │ Subscriptions Broker (SSE)      │  │
│  └──────────┬─────────────────────────────────────────────┘  │
│             │                                                │
│  ┌──────────▼─────────────────────────────────────────────┐  │
│  │          Database Abstraction Layer                      │  │
│  │  SQLite Adapter (bun:sqlite) │ PostgreSQL Adapter (SQL) │  │
│  │  ──────────────────────────────────────────────         │  │
│  │           Query Builder (Kysely)                         │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │               Plugin System                              │  │
│  │  Secrets │ Jobs │ Gateway │ KV │ Analytics │ Metrics    │  │
│  └────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 2.1 设计原则

1. **接口驱动** — 核心 `App` 接口定义所有契约，`BaseApp` 为默认实现
2. **Hook 洋葱模型** — 所有操作通过 Hook 链执行，支持 before/after 拦截
3. **适配器模式** — `DBAdapter` 接口抽象 SQLite/PostgreSQL 差异
4. **自注册** — Field 类型通过 `registerField()` 自注册到全局 Map
5. **插件化** — 统一 `register(app, config)` 模式，通过 Hook 延迟初始化
6. **函数式优先** — 优先使用纯函数和组合，避免深层继承

---

## 3. 技术选型

### 3.1 核心依赖

| 功能 | Go 版 | Bun.js 版 | 选型理由 |
|------|-------|-----------|---------|
| HTTP 框架 | 自封装 `http.ServeMux` | **Hono** | 轻量、快速、类型安全、中间件生态 |
| SQLite | `modernc.org/sqlite` | **`bun:sqlite`** | Bun 内置，3-6x 性能优势，零依赖 |
| PostgreSQL | `pgx/v5` | **`Bun.SQL`** (内置) | Bun 内置统一 SQL API，连接池 |
| 查询构建器 | `pocketbase/dbx` | **Kysely** | 类型安全、多方言、活跃维护 |
| JWT | `golang-jwt/jwt` | **jose** | 标准 JOSE 库，支持所有 JWT 算法 |
| 密码哈希 | `bcrypt` | **`Bun.password`** | Bun 原生 bcrypt/argon2 |
| Cron | 自实现 | **croner** | 轻量，标准 cron 表达式 |
| CLI | `cobra` | **Commander.js** | Node 生态标准 CLI 框架 |
| S3 存储 | `aws-sdk-go-v2` | **@aws-sdk/client-s3** | AWS 官方 SDK |
| OAuth2 | 自实现 35+ 提供商 | **arctic** | 轻量 OAuth2 库 |
| 邮件 | `net/smtp` | **nodemailer** | 成熟邮件库 |
| 过滤表达式 | `ganigeorgiev/fexpr` | **自实现** (移植 fexpr) | 必须 100% 兼容 |
| 验证 | `ozzo-validation` | **Zod** | TypeScript 优先 |

### 3.2 为什么选 Kysely 而非 Drizzle

PocketBase 的 Collection/Field 系统是**动态 schema**——表结构运行时由用户定义，非编译时确定。Drizzle ORM 的静态 schema 理念与此冲突。Kysely 支持动态查询构建、多方言，且 API 与 Go 版 `dbx` 风格相似。

### 3.3 数据库驱动策略

- **SQLite 模式**: `bun:sqlite` 原生同步 API（性能最优），WAL 模式 + 写入 Mutex
- **PostgreSQL 模式**: `Bun.SQL` 异步 API + 自动连接池
- 上层通过 `DBAdapter` 接口统一

```typescript
// SQLite（默认）
import { Database } from "bun:sqlite";
const db = new Database("./pb_data/data.db", { create: true, strict: true });
db.run("PRAGMA journal_mode = WAL");
db.run("PRAGMA busy_timeout = 10000");
db.run("PRAGMA foreign_keys = ON");

// PostgreSQL
import { SQL } from "bun";
const db = new SQL("postgres://user:pass@localhost:5432/pocketbase", { max: 25 });
```

---

## 4. 核心层设计

### 4.1 App 接口

对齐 Go 版 `core.App` 约 800+ 行接口，分为以下方法组：

| 方法组 | 关键方法 | 说明 |
|--------|---------|------|
| 生命周期 | `bootstrap()`, `resetBootstrapState()`, `isBootstrapped()` | 应用初始化 |
| 配置 | `dataDir()`, `isDev()`, `settings()`, `encryptionEnv()` | 运行时配置 |
| 运行时服务 | `store()`, `cron()`, `subscriptionsBroker()`, `logger()` | 缓存、定时、实时、日志 |
| 数据库 | `db()`, `concurrentDB()`, `nonconcurrentDB()`, `auxDB()` | 双数据库（主+辅助）读写分离 |
| 适配器 | `dbAdapter()`, `isPostgres()`, `isSQLite()` | 数据库类型检测 |
| 表操作 | `hasTable()`, `tableColumns()`, `tableInfo()`, `deleteTable()` | DDL |
| CRUD | `save()`, `delete()`, `validate()`, `runInTransaction()` | 统一持久化 |
| Collection | `findCollectionByNameOrId()`, `importCollections()`, `syncRecordTableSchema()` | Collection 管理 |
| Record | `findRecordById()`, `findRecordsByFilter()`, `expandRecord()`, `canAccessRecord()` | Record 查询 |
| Auth | `findAuthRecordByEmail()`, `findAuthRecordByToken()` | 认证查询 |
| 邮件/文件 | `newMailClient()`, `newFilesystem()`, `newBackupsFilesystem()` | 工厂方法 |
| **Hooks (80+)** | `onBootstrap()`, `onServe()`, `onRecordCreate()`, ... | 完整事件系统 |

### 4.2 BaseApp 实现

```typescript
export class BaseApp implements App {
  private config: BaseAppConfig;
  private _store: Store<string, any>;
  private _cron: CronScheduler;
  private _settings: Settings;
  private _subscriptionsBroker: SubscriptionsBroker;
  private _dbAdapter: DBAdapter;

  // 数据库连接
  private _concurrentDB: QueryBuilder;      // 主库并发（读）
  private _nonconcurrentDB: QueryBuilder;    // 主库非并发（写，SQLite用Mutex保护）
  private _auxConcurrentDB: QueryBuilder;    // 辅助库并发
  private _auxNonconcurrentDB: QueryBuilder;

  // 80+ Hook 实例
  private _onBootstrap = new Hook<BootstrapEvent>();
  private _onServe = new Hook<ServeEvent>();
  private _onModelCreate = new TaggedHook<ModelEvent>();
  private _onRecordCreate = new TaggedHook<RecordEvent>();
  // ...

  constructor(config: BaseAppConfig) {
    this.registerRecordHooks();   // Model → Record 代理
    this.registerCollectionHooks(); // Model → Collection 代理
  }

  // Hook 三层代理模式（对齐 Go 版）：
  // OnModelCreate → OnRecordCreate (通过类型断言自动转发)
  //               → OnCollectionCreate
}
```

---

## 5. 数据库抽象层

### 5.1 DBAdapter 接口

```typescript
export type DBType = "sqlite" | "postgres";

export interface DBAdapter {
  type(): DBType;
  connect(config: DBConfig): Promise<void>;
  close(): Promise<void>;
  ping(): Promise<void>;

  // Schema 信息
  tableColumns(tableName: string): Promise<string[]>;
  tableInfo(tableName: string): Promise<TableInfoRow[]>;
  tableIndexes(tableName: string): Promise<Record<string, string>>;
  hasTable(tableName: string): Promise<boolean>;
  vacuum(): Promise<void>;

  // 类型转换（SQLite/PG 差异）
  boolValue(val: any): boolean;
  formatBool(val: boolean): any;        // SQLite: 0/1, PG: true/false
  formatTime(val: Date): string;         // SQLite: "Y-m-d H:i:s", PG: ISO
  jsonFunctions(): JSONFunctions;        // JSON_EXTRACT vs ->>
  noCaseCollation(): string;             // COLLATE NOCASE vs COLLATE "default"
  isUniqueViolation(err: Error): boolean;
  isForeignKeyViolation(err: Error): boolean;
}
```

### 5.2 两个适配器

| 适配器 | 驱动 | 默认连接池 | 关键配置 |
|--------|------|-----------|---------|
| `SQLiteAdapter` | `bun:sqlite` | 单连接 + 写 Mutex | WAL, busy_timeout=10s, foreign_keys=ON |
| `PostgresAdapter` | `Bun.SQL` | max=25, idle=5 | pgcrypto, pg_trgm 扩展自动初始化 |

### 5.3 QueryBuilder 封装

基于 Kysely 但包装为与 Go 版 `dbx` 兼容的 API：

```typescript
export interface QueryBuilder {
  newQuery(sql: string): QueryExecutor;
  select(...columns: string[]): SelectQueryBuilder;
  insert(table: string): InsertQueryBuilder;
  update(table: string): UpdateQueryBuilder;
  deleteFrom(table: string): DeleteQueryBuilder;
  transaction<T>(fn: (tx: QueryBuilder) => Promise<T>): Promise<T>;
}

// Expression 工厂（对齐 dbx）
export const Expr = {
  eq: (field: string, value: any) => ...,
  neq: (field: string, value: any) => ...,
  like: (field: string, value: string) => ...,
  in: (field: string, values: any[]) => ...,
  and: (...exprs: Expression[]) => ...,
  or: (...exprs: Expression[]) => ...,
  raw: (sql: string, params?: Record<string, any>) => ...,
};
```

---

## 6. 模型系统

### 6.1 Model 接口与 BaseModel

```typescript
export interface Model {
  tableName(): string;
  pk(): string;
  lastSavedPK(): string;
  isNew(): boolean;
  markAsNew(): void;
  markAsNotNew(): void;
}

export class BaseModel implements Model {
  id: string = "";
  private _lastSavedPK: string = "";
  isNew(): boolean { return this._lastSavedPK === ""; }
  // ID = 15 字符随机字符串（对齐 Go 版）
}
```

### 6.2 Collection 模型

对齐 Go 版 `baseCollection` + `collectionAuthOptions` + `collectionViewOptions`：

- 三种类型: `"base"` | `"auth"` | `"view"`
- API 规则: `listRule`, `viewRule`, `createRule`, `updateRule`, `deleteRule` (null = 仅 superuser)
- Auth 选项: `passwordAuth`, `oauth2`, `otp`, `mfa`, token 配置, emailTemplate 等
- View 选项: `viewQuery` (SQL SELECT)

### 6.3 Record 模型

- 动态关联到 Collection 的 Fields 定义
- 通过 `Store<string, any>` 实现键值访问
- 支持字段修饰符: `field+` (追加), `+field` (前置), `field-` (移除)
- Auth 专用方法: `email()`, `verified()`, `validatePassword()`, `newAuthToken()` 等

---

## 7. 字段系统

### 7.1 Field 接口

```typescript
export interface Field {
  getId(): string;
  setId(id: string): void;
  getName(): string;
  type(): string;
  columnType(app: App): string;
  prepareValue(record: Record, raw: any): any;
  validateValue(app: App, record: Record): Promise<void>;
  validateSettings(app: App, collection: Collection): Promise<void>;
}

// 扩展接口
export interface SetterFinder { findSetter(key: string): Function | null; }
export interface GetterFinder { findGetter(key: string): Function | null; }
export interface RecordInterceptor { intercept(app: App, record: Record, action: string): Promise<void>; }
```

### 7.2 17 种字段类型

| 类型 | SQLite 列 | PostgreSQL 列 | 零值 |
|------|-----------|--------------|------|
| `text` | TEXT DEFAULT '' | TEXT DEFAULT '' | `""` |
| `number` | NUMERIC DEFAULT 0 | DOUBLE PRECISION DEFAULT 0 | `0` |
| `bool` | BOOLEAN DEFAULT FALSE | BOOLEAN DEFAULT FALSE | `false` |
| `email` | TEXT DEFAULT '' | TEXT DEFAULT '' | `""` |
| `url` | TEXT DEFAULT '' | TEXT DEFAULT '' | `""` |
| `editor` | TEXT DEFAULT '' | TEXT DEFAULT '' | `""` |
| `date` | TEXT DEFAULT '' | TEXT DEFAULT '' | `""` |
| `autodate` | TEXT DEFAULT '' | TIMESTAMPTZ DEFAULT '' | auto |
| `select` | TEXT/JSON | TEXT/JSON | `""`/`[]` |
| `file` | TEXT/JSON | TEXT/JSON | `""`/`[]` |
| `relation` | TEXT/JSON | TEXT/JSON | `""`/`[]` |
| `json` | JSON DEFAULT NULL | JSONB DEFAULT NULL | `null` |
| `password` | TEXT DEFAULT '' | TEXT DEFAULT '' | hidden |
| `geoPoint` | JSON | JSONB | `{lon:0,lat:0}` |
| `secret` | TEXT DEFAULT '' | TEXT DEFAULT '' | `""` |
| `vector` | JSON DEFAULT '[]' | VECTOR(dim) | `[]` |

自注册模式：每个字段文件底部调用 `registerField("text", () => new TextField())`。

---

## 8. Hook/事件系统

### 8.1 核心实现

对齐 Go 版 `tools/hook` 的**反向链式调用**（洋葱模型）：

```typescript
export class Hook<T extends Resolver> {
  private handlers: Handler<T>[] = [];

  bind(handler: Handler<T>): () => void { ... }
  bindFunc(fn: (e: T) => Promise<void>, id?: string): () => void { ... }

  async trigger(event: T): Promise<void> {
    const sorted = [...this.handlers].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
    // 反向构建 next 链
    let chain = async () => {};
    for (let i = sorted.length - 1; i >= 0; i--) {
      const fn = sorted[i].func;
      const next = chain;
      chain = async () => { event.setNext(next); await fn(event); };
    }
    await chain();
  }
}
```

### 8.2 TaggedHook

`TaggedHook` 支持按 Collection 名称/ID 过滤：
```typescript
app.onRecordCreate("users").bindFunc(async (e) => {
  // 仅当操作 "users" 集合时触发
  await e.next();
});
```

### 8.3 三层代理模式

```
OnModelCreate (通用模型钩子)
  └→ OnRecordCreate (Record 专用，通过 instanceof 自动代理)
  └→ OnCollectionCreate (Collection 专用)
```

---

## 9. API 路由层

### 9.1 完整端点列表

| 方法 | 路径 | 处理器 |
|------|------|--------|
| GET | `/api/health` | healthCheck |
| GET/PATCH | `/api/settings` | settingsList/Update |
| POST | `/api/settings/test/s3` | testS3 |
| POST | `/api/settings/test/email` | testEmail |
| GET/POST/PATCH/DELETE | `/api/collections[/:idOrName]` | collection CRUD |
| DELETE | `/api/collections/:idOrName/truncate` | truncate |
| PUT | `/api/collections/import` | import |
| GET/POST/PATCH/DELETE | `/api/collections/:col/records[/:id]` | record CRUD |
| GET | `/api/collections/:col/auth-methods` | authMethods |
| POST | `/api/collections/:col/auth-refresh` | authRefresh |
| POST | `/api/collections/:col/auth-with-password` | authWithPassword |
| POST | `/api/collections/:col/auth-with-oauth2` | authWithOAuth2 |
| POST | `/api/collections/:col/request-otp` | requestOTP |
| POST | `/api/collections/:col/auth-with-otp` | authWithOTP |
| POST | `/api/collections/:col/request-password-reset` | requestPasswordReset |
| POST | `/api/collections/:col/confirm-password-reset` | confirmPasswordReset |
| POST | `/api/collections/:col/request-verification` | requestVerification |
| POST | `/api/collections/:col/confirm-verification` | confirmVerification |
| POST | `/api/collections/:col/request-email-change` | requestEmailChange |
| POST | `/api/collections/:col/confirm-email-change` | confirmEmailChange |
| POST | `/api/collections/:col/impersonate/:id` | impersonate |
| GET | `/api/files/:col/:recordId/:filename` | fileDownload |
| GET | `/api/realtime` | SSE connect |
| POST | `/api/realtime` | setSubscriptions |
| POST | `/api/batch` | batchProcess |
| GET | `/api/logs[/:id]` | logs |
| GET | `/api/logs/stats` | logsStats |
| GET | `/api/crons` | cronsList |
| POST | `/api/crons/:jobId` | cronRun |
| GET/POST/DELETE | `/api/backups[/:key]` | backups |
| POST | `/api/backups/:key/restore` | restore |

### 9.2 Server 启动

```typescript
// 使用 Bun.serve() 启动
const server = Bun.serve({
  port: config.httpAddr ?? 8090,
  fetch: router.fetch,
  tls: config.tlsCert ? { cert: config.tlsCert, key: config.tlsKey } : undefined,
});
```

---

## 10. 中间件系统

对齐 Go 版中间件链：

| 中间件 | 说明 |
|--------|------|
| `activityLogger` | 请求日志记录到辅助库 |
| `panicRecover` | 异常恢复，返回 500 |
| `rateLimit` | 基于 Settings 的速率限制 |
| `loadAuthToken` | JWT Token 提取与验证 |
| `securityHeaders` | XSS/CSRF/Frame 安全头 |
| `bodyLimit` | 请求体大小限制 |
| `requireAuth` | 认证要求 |
| `requireSuperuserAuth` | 超级管理员要求 |
| `cors` | 跨域配置 |
| `gzip` | Gzip 压缩 |

---

## 11. 认证系统

### 11.1 五种 Token 类型

| 类型 | 签名密钥 | Claims |
|------|---------|--------|
| auth | `record.tokenKey + collection.authToken.secret` | id, type, collectionId, refreshable |
| file | `record.tokenKey + collection.fileToken.secret` | id, type, collectionId |
| verification | `record.tokenKey + collection.verificationToken.secret` | id, type, collectionId, email |
| passwordReset | `record.tokenKey + collection.passwordResetToken.secret` | id, type, collectionId, email |
| emailChange | `record.tokenKey + collection.emailChangeToken.secret` | id, type, collectionId, email, newEmail |

使用 `jose` 库签发 HS256 JWT，验证时先解码获取 id → 查询 record → 用 record.tokenKey 验证签名。

### 11.2 五种认证流程

1. **密码认证** — identity + password → JWT
2. **OAuth2** — 35+ 提供商（Google, GitHub, Apple, Discord, ...）
3. **OTP** — 邮箱一次性密码
4. **MFA** — 两步认证（需要两种不同方式）
5. **Impersonation** — Superuser 模拟其他用户

密码哈希使用 `Bun.password.hash(password, { algorithm: "bcrypt", cost: 12 })`。

---

## 12. 搜索/过滤引擎

需要移植 Go 版 `fexpr` 解析器，100% 兼容过滤语法。

### 支持的运算符

`=`, `!=`, `>`, `>=`, `<`, `<=`, `~` (LIKE), `!~` (NOT LIKE)  
`?=`, `?!=`, `?>`, `?>=`, `?<`, `?<=`, `?~`, `?!~` (Any 变体)

### 逻辑运算

`&&` (AND), `||` (OR), `()` (分组)

### 特殊标识符

`@request.auth.*`, `@request.body.*`, `@request.query.*`, `@request.headers.*`, `@request.method`, `@request.context`, `@collection.*`

### 修饰符

`:isset`, `:changed`, `:length`, `:each`, `:lower`

### 日期宏

`@now`, `@yesterday`, `@tomorrow`, `@todayStart`, `@todayEnd`, `@monthStart`, `@monthEnd`, `@yearStart`, `@yearEnd`, `@second`, `@minute`, `@hour`, `@weekday`, `@day`, `@month`, `@year`

### 函数

`geoDistance(lonA, latA, lonB, latB)` — Haversine 距离（km）  
`strftime(format, time-value, modifiers...)` — 日期格式化

### FieldResolver 接口

```typescript
export interface FieldResolver {
  updateQuery(query: SelectQueryBuilder): void;  // 添加 JOIN 等
  resolve(field: string): ResolverResult;         // 字段名 → SQL 标识符
}
```

---

## 13. 实时订阅 (SSE)

### 架构

- `GET /api/realtime` — 建立 SSE 连接，分配 clientId
- `POST /api/realtime` — 设置订阅主题 `{clientId, subscriptions: [...]}`
- 订阅格式: `collectionName/*`（全集合）或 `collectionName/recordId`（单记录）
- 规则映射: `/*` → ListRule, `/:id` → ViewRule

### 广播机制

1. Hook 注册到 `OnModelAfterCreateSuccess/UpdateSuccess/DeleteSuccess`
2. 分块处理客户端（150/chunk），并发广播
3. 对每个客户端检查订阅匹配 + API 规则权限
4. 删除操作使用 "dry cache" 模式（删前缓存消息，删成功后广播）

### 空闲超时

5 分钟无消息自动断开（客户端自动重连）。

---

## 14. 文件系统

```typescript
export interface Filesystem {
  upload(key: string, content: ReadableStream | Buffer): Promise<void>;
  download(key: string): Promise<ReadableStream>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  serve(key: string, headers?: Record<string, string>): Promise<Response>;
  createThumb(key: string, thumbSize: string): Promise<string>;
}
```

- **LocalFilesystem** — 默认，存储在 `pb_data/storage/`
- **S3Filesystem** — AWS S3 兼容存储
- 缩略图格式: `WxH`, `WxHt`, `WxHb`, `WxHf`, `0xH`, `Wx0`

---

## 15. 迁移系统

### 系统迁移（对齐 Go 版）

| ID | 说明 |
|----|------|
| `1640988000_init` | 创建 `_params`, `_collections`, `_mfas`, `_otps`, `_externalAuths`, `_authOrigins`, `_superusers`, `users` |
| `1640988000_aux_init` | 辅助库 `_logs` 表 |
| `1736300000_create_proxies` | `_proxies` 代理表 |
| `1736500000_create_secrets` | `_secrets` 密钥表 |
| `1736600000_system_metrics` | `_metrics` 监控表 |
| `1736700000_create_analytics` | `_analytics_*` 分析表 |

每个迁移同时输出 SQLite 和 PostgreSQL DDL。

---

## 16. 插件系统

### 统一注册模式

```typescript
export function register(app: App, config: Config): void {
  config = applyEnvOverrides(config);
  app.onBootstrap().bindFunc(async (e) => { await e.next(); /* 创建表 */ });
  app.onServe().bindFunc(async (e) => { /* 注册路由 */ return e.next(); });
  app.onTerminate().bindFunc(async (e) => { /* 清理资源 */ return e.next(); });
}
```

### 插件列表

| 插件 | 优先级 | 说明 | 与 Go 版差异 |
|------|--------|------|-------------|
| secrets | P0 | 密钥管理 AES-256-GCM | 完全对齐 |
| jobs | P0 | 后台任务队列 | 完全对齐 |
| gateway | P1 | API 代理网关 | 完全对齐 |
| kv | P1 | KV 存储 | 完全对齐 |
| analytics | P2 | 行为分析 | 完全对齐 |
| metrics | P2 | 系统监控 | 完全对齐 |
| trace | P2 | 分布式追踪 | 完全对齐 |
| ~~jsvm~~ | N/A | ~~JS VM~~ | **不需要**（原生 TS） |
| ghupdate | P3 | GitHub 自更新 | 适配 npm/bun |
| processman | P3 | 进程管理 | 完全对齐 |

---

## 17. CLI 系统

```bash
pocketless serve [domains...] --http=127.0.0.1:8090 --pg=DSN
pocketless superuser create|upsert|update|delete|otp EMAIL [PASS]
pocketless migrate up|down|create|collections|history-sync
```

全局标志与 Go 版完全一致：`--dir`, `--dev`, `--pg`, `--encryptionEnv`, `--queryTimeout`, `--dataMaxOpenConns`, `--dataMaxIdleConns`。

---

## 18. Settings 管理

Settings 存储在 `_params` 表，key = `"settings"`。结构包括：

| 配置组 | 关键字段 |
|--------|---------|
| `meta` | appName, appURL, senderName, senderAddress, hideControls |
| `smtp` | host, port, username, password(masked), tls |
| `s3` | endpoint, bucket, region, accessKey, secret(masked) |
| `backups` | cron, s3 配置 |
| `logs` | maxDays(5), minLevel, logIP |
| `rateLimits` | 规则列表 (path, maxRequests, duration) |
| `trustedProxy` | 代理头配置 |
| `batch` | maxRequests(50), timeout |

---

## 19. 目录结构

> **原则**: `src/` 下的目录结构与 Go 版保持一致，文件名也尽量对齐（`.go` → `.ts`），方便对比和交叉测试。

### 19.1 Go ↔ TypeScript 文件名映射规则

| Go 约定 | TypeScript 约定 | 示例 |
|---------|----------------|------|
| `xxx.go` | `xxx.ts` | `app.go` → `app.ts` |
| `xxx_test.go` | `xxx.test.ts` | `app_test.go` → `app.test.ts` |
| `xxx_pg.go` (PostgreSQL 特有) | `xxx_pg.ts` | `db_connect_pg.go` → `db_connect_pg.ts` |
| `xxx_sqlite.go` (SQLite 特有) | `xxx_sqlite.ts` | `db_adapter_sqlite.go` → `db_adapter_sqlite.ts` |
| 包级别 `init()` / 自注册 | 文件底部 `registerField()` 调用 | 保持一致 |

### 19.2 完整目录结构

```
pocketless/
├── src/
│   ├── pocketless.ts                          # ← Go: pocketbase.go — PocketLess 类入口
│   │
│   ├── core/                                  # ← Go: core/ (86 个文件)
│   │   ├── app.ts                             # App 接口
│   │   ├── base.ts                            # BaseApp 实现
│   │   ├── base_backup.ts                     # 备份功能
│   │   ├── crypto.ts                          # 加密工具
│   │   ├── events.ts                          # 所有事件类型
│   │   ├── event_request.ts                   # RequestEvent
│   │   ├── event_request_batch.ts             # BatchRequestEvent
│   │   │
│   │   │── # ─── Collection ───
│   │   ├── collection_model.ts                # Collection 模型
│   │   ├── collection_model_auth_options.ts   # Auth 集合选项
│   │   ├── collection_model_auth_templates.ts # Auth 邮件模板
│   │   ├── collection_model_base_options.ts   # Base 集合选项
│   │   ├── collection_model_view_options.ts   # View 集合选项
│   │   ├── collection_query.ts                # Collection 查询
│   │   ├── collection_import.ts               # Collection 导入
│   │   ├── collection_record_table_sync.ts    # 表结构同步
│   │   ├── collection_validate.ts             # Collection 验证
│   │   │
│   │   │── # ─── Record ───
│   │   ├── record_model.ts                    # Record 模型
│   │   ├── record_model_auth.ts               # Auth Record 方法
│   │   ├── record_model_superusers.ts         # Superuser 方法
│   │   ├── record_proxy.ts                    # Record 代理
│   │   ├── record_query.ts                    # Record 查询
│   │   ├── record_query_expand.ts             # Expand 查询
│   │   ├── record_tokens.ts                   # JWT Token
│   │   ├── record_field_resolver.ts           # 字段解析器
│   │   ├── record_field_resolver_multi_match.ts
│   │   ├── record_field_resolver_replace_expr.ts
│   │   ├── record_field_resolver_runner.ts
│   │   │
│   │   │── # ─── 其他模型 ───
│   │   ├── auth_origin_model.ts               # AuthOrigin 模型
│   │   ├── auth_origin_query.ts
│   │   ├── external_auth_model.ts             # ExternalAuth 模型
│   │   ├── external_auth_query.ts
│   │   ├── log_model.ts                       # Log 模型
│   │   ├── log_printer.ts
│   │   ├── log_query.ts
│   │   ├── mfa_model.ts                       # MFA 模型
│   │   ├── mfa_query.ts
│   │   ├── otp_model.ts                       # OTP 模型
│   │   ├── otp_query.ts
│   │   ├── settings_model.ts                  # Settings 模型
│   │   ├── settings_query.ts
│   │   │
│   │   │── # ─── 数据库层 ───
│   │   ├── db.ts                              # CRUD (Save/Delete/Validate + Hook 链)
│   │   ├── db_adapter.ts                      # DBAdapter 接口
│   │   ├── db_adapter_sqlite.ts               # SQLite 适配器
│   │   ├── db_adapter_postgres.ts             # PostgreSQL 适配器
│   │   ├── db_advisory_lock.ts                # 咨询锁
│   │   ├── db_backup_pg.ts                    # PG 备份
│   │   ├── db_bootstrap_pg.ts                 # PG 初始化
│   │   ├── db_builder.ts                      # QueryBuilder 封装
│   │   ├── db_cache_invalidation.ts           # 缓存失效
│   │   ├── db_connect.ts                      # SQLite 连接
│   │   ├── db_connect_pg.ts                   # PostgreSQL 连接
│   │   ├── db_container_pg.ts                 # PG Docker 容器（测试用）
│   │   ├── db_distributed_hook.ts             # 分布式 Hook
│   │   ├── db_lock.ts                         # 写锁
│   │   ├── db_lock_query.ts                   # 锁查询
│   │   ├── db_model.ts                        # DB Model 基础
│   │   ├── db_observability.ts                # 可观测性
│   │   ├── db_permission_filter.ts            # 权限过滤
│   │   ├── db_pubsub.ts                       # PubSub
│   │   ├── db_realtime.ts                     # 实时变更
│   │   ├── db_retry.ts                        # 重试逻辑
│   │   ├── db_retry_pg.ts                     # PG 重试
│   │   ├── db_rls.ts                          # 行级安全
│   │   ├── db_table.ts                        # DDL 操作
│   │   ├── db_tx.ts                           # 事务管理
│   │   ├── db_tx_isolation.ts                 # 事务隔离级别
│   │   ├── db_wal_consumer.ts                 # WAL 消费者
│   │   ├── db_wal_decoder.ts                  # WAL 解码器
│   │   ├── db_wal_integration.ts              # WAL 集成
│   │   ├── db_wal_replication.ts              # WAL 复制
│   │   │
│   │   │── # ─── 字段系统 ───
│   │   ├── field.ts                           # Field 接口 + FieldsList
│   │   ├── field_autodate.ts
│   │   ├── field_bool.ts
│   │   ├── field_date.ts
│   │   ├── field_editor.ts
│   │   ├── field_email.ts
│   │   ├── field_file.ts
│   │   ├── field_geo_point.ts
│   │   ├── field_json.ts
│   │   ├── field_number.ts
│   │   ├── field_password.ts
│   │   ├── field_relation.ts
│   │   ├── field_secret.ts
│   │   ├── field_select.ts
│   │   ├── field_text.ts
│   │   ├── field_url.ts
│   │   ├── field_vector.ts
│   │   │
│   │   │── # ─── 迁移 ───
│   │   ├── migrations_list.ts                 # 迁移注册表
│   │   └── migrations_runner.ts               # 迁移运行器
│   │
│   ├── apis/                                  # ← Go: apis/ (38 个文件)
│   │   ├── api_error_aliases.ts               # 错误类型别名
│   │   ├── base.ts                            # createRouter()
│   │   ├── batch.ts                           # Batch API
│   │   ├── backup.ts                          # Backup 列表/删除/下载
│   │   ├── backup_create.ts                   # Backup 创建
│   │   ├── backup_upload.ts                   # Backup 上传
│   │   ├── collection.ts                      # Collection CRUD
│   │   ├── collection_import.ts               # Collection 导入
│   │   ├── cron.ts                            # Cron API
│   │   ├── file.ts                            # 文件下载
│   │   ├── health.ts                          # 健康检查
│   │   ├── installer.ts                       # 首次安装引导
│   │   ├── logs.ts                            # 日志查询
│   │   ├── middlewares.ts                     # 核心中间件
│   │   ├── middlewares_body_limit.ts          # Body 大小限制
│   │   ├── middlewares_cors.ts                # CORS
│   │   ├── middlewares_gzip.ts                # Gzip 压缩
│   │   ├── middlewares_rate_limit.ts          # 速率限制
│   │   ├── realtime.ts                        # SSE 实时
│   │   ├── record_auth.ts                     # Auth 基础
│   │   ├── record_auth_email_change_confirm.ts
│   │   ├── record_auth_email_change_request.ts
│   │   ├── record_auth_impersonate.ts
│   │   ├── record_auth_methods.ts
│   │   ├── record_auth_otp_request.ts
│   │   ├── record_auth_password_reset_confirm.ts
│   │   ├── record_auth_password_reset_request.ts
│   │   ├── record_auth_refresh.ts
│   │   ├── record_auth_verification_confirm.ts
│   │   ├── record_auth_verification_request.ts
│   │   ├── record_auth_with_oauth2.ts
│   │   ├── record_auth_with_oauth2_redirect.ts
│   │   ├── record_auth_with_otp.ts
│   │   ├── record_auth_with_password.ts
│   │   ├── record_crud.ts                     # Record CRUD
│   │   ├── record_helpers.ts                  # Record 辅助函数
│   │   ├── serve.ts                           # Bun.serve() 启动
│   │   └── settings.ts                        # Settings API
│   │
│   ├── tools/                                 # ← Go: tools/ (21 子目录)
│   │   ├── archive/                           # 压缩/解压
│   │   │   ├── create.ts
│   │   │   └── extract.ts
│   │   ├── auth/                              # 35+ OAuth2 提供商
│   │   │   ├── auth.ts                        # 提供商注册表
│   │   │   ├── base_provider.ts               # BaseProvider
│   │   │   ├── apple.ts
│   │   │   ├── bitbucket.ts
│   │   │   ├── box.ts
│   │   │   ├── discord.ts
│   │   │   ├── facebook.ts
│   │   │   ├── gitea.ts
│   │   │   ├── gitee.ts
│   │   │   ├── github.ts
│   │   │   ├── gitlab.ts
│   │   │   ├── google.ts
│   │   │   ├── instagram.ts
│   │   │   ├── kakao.ts
│   │   │   ├── lark.ts
│   │   │   ├── linear.ts
│   │   │   ├── livechat.ts
│   │   │   ├── mailcow.ts
│   │   │   ├── microsoft.ts
│   │   │   ├── monday.ts
│   │   │   ├── notion.ts
│   │   │   ├── oidc.ts
│   │   │   ├── patreon.ts
│   │   │   ├── planningcenter.ts
│   │   │   ├── spotify.ts
│   │   │   ├── strava.ts
│   │   │   ├── trakt.ts
│   │   │   ├── twitch.ts
│   │   │   ├── twitter.ts
│   │   │   ├── vk.ts
│   │   │   ├── wakatime.ts
│   │   │   └── yandex.ts
│   │   ├── cron/                              # Cron 调度
│   │   │   ├── cron.ts
│   │   │   ├── job.ts
│   │   │   └── schedule.ts
│   │   ├── dbutils/                           # 数据库工具
│   │   │   ├── dbtype.ts
│   │   │   ├── errors.ts
│   │   │   ├── fulltext_pg.ts
│   │   │   ├── index.ts
│   │   │   ├── index_pg.ts
│   │   │   ├── json.ts
│   │   │   ├── json_pg.ts
│   │   │   ├── json_unified.ts
│   │   │   ├── pool_monitor.ts
│   │   │   ├── postgres_init.ts
│   │   │   └── type_conversion.ts
│   │   ├── filesystem/                        # 本地/S3 存储
│   │   │   ├── file.ts
│   │   │   └── filesystem.ts
│   │   ├── hook/                              # Hook 系统
│   │   │   ├── event.ts
│   │   │   ├── hook.ts
│   │   │   └── tagged.ts
│   │   ├── inflector/                         # 单词变形
│   │   │   ├── inflector.ts
│   │   │   └── singularize.ts
│   │   ├── list/                              # 列表工具
│   │   │   └── list.ts
│   │   ├── logger/                            # 日志
│   │   │   ├── batch_handler.ts
│   │   │   └── log.ts
│   │   ├── mailer/                            # 邮件
│   │   │   ├── html2text.ts
│   │   │   ├── mailer.ts
│   │   │   ├── sendmail.ts
│   │   │   └── smtp.ts
│   │   ├── osutils/                           # OS 工具
│   │   │   ├── cmd.ts
│   │   │   ├── dir.ts
│   │   │   └── run.ts
│   │   ├── picker/                            # 字段选取
│   │   │   ├── excerpt_modifier.ts
│   │   │   ├── modifiers.ts
│   │   │   └── pick.ts
│   │   ├── router/                            # HTTP 路由
│   │   │   ├── error.ts
│   │   │   ├── event.ts
│   │   │   ├── group.ts
│   │   │   ├── rereadable_read_closer.ts
│   │   │   ├── route.ts
│   │   │   ├── router.ts
│   │   │   └── unmarshal_request_data.ts
│   │   ├── routine/                           # 异步协程
│   │   │   └── routine.ts
│   │   ├── search/                            # 搜索/过滤引擎
│   │   │   ├── filter.ts
│   │   │   ├── identifier_macros.ts
│   │   │   ├── provider.ts
│   │   │   ├── simple_field_resolver.ts
│   │   │   ├── sort.ts
│   │   │   └── token_functions.ts
│   │   ├── security/                          # 加密/JWT/随机数
│   │   │   ├── crypto.ts
│   │   │   ├── encrypt.ts
│   │   │   ├── jwt.ts
│   │   │   ├── random.ts
│   │   │   └── random_by_regex.ts
│   │   ├── store/                             # 并发安全 KV
│   │   │   └── store.ts
│   │   ├── subscriptions/                     # SSE Broker
│   │   │   ├── broker.ts
│   │   │   ├── client.ts
│   │   │   └── message.ts
│   │   ├── template/                          # 模板引擎
│   │   │   ├── registry.ts
│   │   │   └── renderer.ts
│   │   ├── tokenizer/                         # 词法分析器
│   │   │   └── tokenizer.ts
│   │   └── types/                             # 自定义类型
│   │       ├── datetime.ts
│   │       ├── geo_point.ts
│   │       ├── json_array.ts
│   │       ├── json_map.ts
│   │       ├── json_raw.ts
│   │       ├── types.ts
│   │       └── vector.ts
│   │
│   ├── migrations/                            # ← Go: migrations/ (12 个文件)
│   │   ├── 1640988000_init.ts
│   │   ├── 1640988000_aux_init.ts
│   │   ├── 1717233556_v0_23_migrate.ts
│   │   ├── 1717233557_v0_23_migrate2.ts
│   │   ├── 1717233558_v0_23_migrate3.ts
│   │   ├── 1717233559_v0_23_migrate4.ts
│   │   ├── 1736300000_create_proxies.ts
│   │   ├── 1736500000_create_secrets.ts
│   │   ├── 1736600000_system_metrics.ts
│   │   ├── 1736700000_create_analytics.ts
│   │   ├── 1763020353_update_default_auth_alert_templates.ts
│   │   └── 20260201045320_gateway_hardening.ts
│   │
│   ├── forms/                                 # ← Go: forms/ (4 个文件)
│   │   ├── apple_client_secret_create.ts
│   │   ├── record_upsert.ts
│   │   ├── test_email_send.ts
│   │   └── test_s3_filesystem.ts
│   │
│   ├── mails/                                 # ← Go: mails/ (2 个文件)
│   │   ├── base.ts
│   │   └── record.ts
│   │
│   ├── cmd/                                   # ← Go: cmd/ (2 个文件)
│   │   ├── serve.ts
│   │   └── superuser.ts
│   │
│   └── plugins/                               # ← Go: plugins/ (12 子目录)
│       ├── analytics/                         # 行为分析
│       │   ├── analytics.ts
│       │   ├── buffer.ts
│       │   ├── config.ts
│       │   ├── errors.ts
│       │   ├── event.ts
│       │   ├── flusher.ts
│       │   ├── handlers_events.ts
│       │   ├── handlers_stats.ts
│       │   ├── hll.ts
│       │   ├── mode.ts
│       │   ├── noop.ts
│       │   ├── register.ts
│       │   ├── repository.ts
│       │   ├── repository_postgres.ts
│       │   ├── repository_sqlite.ts
│       │   ├── routes.ts
│       │   ├── types.ts
│       │   ├── ua.ts
│       │   └── url.ts
│       ├── gateway/                           # API 代理网关
│       │   ├── auth.ts
│       │   ├── buffer_pool.ts
│       │   ├── circuit_breaker.ts
│       │   ├── config.ts
│       │   ├── errors.ts
│       │   ├── gateway.ts
│       │   ├── handler_wrapper.ts
│       │   ├── header.ts
│       │   ├── hooks.ts
│       │   ├── limiter.ts
│       │   ├── manager.ts
│       │   ├── metrics.ts
│       │   ├── proxy.ts
│       │   ├── proxy_error.ts
│       │   ├── routes.ts
│       │   └── transport.ts
│       ├── ghupdate/                          # GitHub 自更新
│       │   ├── ghupdate.ts
│       │   └── release.ts
│       ├── jobs/                              # 后台任务队列
│       │   ├── config.ts
│       │   ├── dispatcher.ts
│       │   ├── migrations.ts
│       │   ├── register.ts
│       │   ├── routes.ts
│       │   └── store.ts
│       ├── kv/                                # KV 存储
│       │   ├── config.ts
│       │   ├── errors.ts
│       │   ├── l1_cache.ts
│       │   ├── l2_db.ts
│       │   ├── noop.ts
│       │   ├── register.ts
│       │   ├── routes.ts
│       │   ├── store.ts
│       │   └── store_impl.ts
│       ├── metrics/                           # 系统监控
│       │   ├── collector.ts
│       │   ├── config.ts
│       │   ├── constants.ts
│       │   ├── cpu_sampler.ts
│       │   ├── database_stats.ts
│       │   ├── latency_buffer.ts
│       │   ├── middleware.ts
│       │   ├── model.ts
│       │   ├── register.ts
│       │   ├── repository.ts
│       │   └── routes.ts
│       ├── migratecmd/                        # 迁移 CLI
│       │   ├── automigrate.ts
│       │   ├── migratecmd.ts
│       │   └── templates.ts
│       ├── processman/                        # 进程管理
│       │   ├── api.ts
│       │   ├── config.ts
│       │   ├── interpreter.ts
│       │   ├── log_buffer.ts
│       │   ├── processman.ts
│       │   ├── supervisor.ts
│       │   └── watcher.ts
│       ├── secrets/                           # 密钥管理
│       │   ├── config.ts
│       │   ├── errors.ts
│       │   ├── register.ts
│       │   ├── routes.ts
│       │   ├── store.ts
│       │   └── store_impl.ts
│       ├── trace/                             # 分布式追踪
│       │   ├── buffer.ts
│       │   ├── config.ts
│       │   ├── context.ts
│       │   ├── dye_api.ts
│       │   ├── filter.ts
│       │   ├── middleware.ts
│       │   ├── mode.ts
│       │   ├── noop.ts
│       │   ├── register.ts
│       │   ├── repository.ts
│       │   ├── repository_pg.ts
│       │   ├── repository_sqlite.ts
│       │   ├── routes.ts
│       │   ├── types.ts
│       │   ├── dye/                           # 染色存储
│       │   │   ├── routes.ts
│       │   │   ├── store.ts
│       │   │   └── store_memory.ts
│       │   └── filters/                       # 内置过滤器
│       │       ├── custom.ts
│       │       ├── dyed_user.ts
│       │       ├── error_only.ts
│       │       ├── path.ts
│       │       ├── sample.ts
│       │       ├── slow_request.ts
│       │       └── vip_user.ts
│       └── tofauth/                           # TOF 认证
│           ├── identity.ts
│           ├── routes.ts
│           └── tofauth.ts
│
├── package.json
├── tsconfig.json
├── bunfig.toml
└── tests/                                     # 测试数据/fixtures
```

### 19.3 Go 版不需要映射的文件

| Go 文件 | 原因 |
|---------|------|
| `db_connect_nodefaultdriver.go` | Go 编译标签，Bun 不需要 |
| `plugins/jsvm/` (整个目录) | Bun 原生 TS，不需要 JS VM |
| `plugins/tofauth/jsvm.go` | 同上，JSVM 绑定 |
| `plugins/processman/supervisor_unix.go` / `supervisor_windows.go` | 合并为 `supervisor.ts`，用条件分支 |
| `fields_list.go` | 合并到 `field.ts` |
| `modernc_versions_check.go` | Go CGO 检查，Bun 不需要 |

### 19.4 文件数量对比

| 目录 | Go 版 (.go) | Pocketless (.ts) |
|------|------------|-----------------|
| `core/` | 86 | ~84 (合并 2 个) |
| `apis/` | 38 | 38 |
| `tools/` (21 子目录) | ~97 | ~97 |
| `migrations/` | 12 | 12 |
| `forms/` | 4 | 4 |
| `mails/` | 2 | 2 |
| `cmd/` | 2 | 2 |
| `plugins/` (不含 jsvm) | ~112 | ~110 |
| 根入口 | 1 | 1 |
| **合计** | **~354** | **~350** |

---

## 20. API 兼容性矩阵

每个 API 端点必须通过以下验证：

| 验证项 | 方法 |
|--------|------|
| 路径完全一致 | 使用 Go 版集成测试的请求路径 |
| Query 参数一致 | page, perPage, sort, filter, expand, fields, skipTotal |
| 请求体结构一致 | 使用 Go 版测试的请求体 |
| 响应体结构一致 | JSON 字段名、嵌套结构、错误格式 |
| 状态码一致 | 200, 204, 400, 401, 403, 404, 429, 500 |
| 错误格式一致 | `{"code": 400, "message": "...", "data": {...}}` |

---

## 21. 数据库表结构

### 系统表（与 Go 版 100% 兼容）

| 表 | 类型 | 说明 |
|----|------|------|
| `_params` | 原始表 | 设置存储 (id=settings) |
| `_collections` | 原始表 | Collection 定义 |
| `_migrations` | 原始表 | 迁移历史 |
| `_mfas` | 系统集合 | MFA 会话 |
| `_otps` | 系统集合 | 一次性密码 |
| `_externalAuths` | 系统集合 | OAuth2 外部认证 |
| `_authOrigins` | 系统集合 | 认证来源 |
| `_superusers` | 系统 Auth 集合 | 超级管理员 |
| `users` | 默认 Auth 集合 | 用户 |
| `_logs` | 辅助库 | 请求日志 |
| `_proxies` | 系统集合 | 代理网关配置 |
| `_secrets` | 插件表 | 加密密钥存储 |
| `_jobs` | 插件表 | 任务队列 |
| `_metrics` | 插件表 | 系统指标 |

---

## 22. 与 Go 版的差异点

| 差异点 | Go 版 | Bun.js 版 | 说明 |
|--------|-------|-----------|------|
| JS VM 插件 | Goja (jsvm) | **不需要** | Bun 原生 TS |
| 并发模型 | Goroutine + Channel | async/await + Worker | Bun 单线程事件循环 |
| SQLite 连接池 | 双连接 (concurrent/nonconcurrent) | 单实例 + 写 Mutex | bun:sqlite 是同步的 |
| 构建产物 | Go 二进制 | `bun build --compile` | 都是单文件 |
| 扩展方式 | Go 编译 + jsvm | `import` TS 模块 | 更简单直接 |
| 文件嵌入 | `embed.FS` | Bun 静态路由 | Admin UI 嵌入方式不同 |
| DB 查询构建器 | dbx | Kysely | API 兼容层封装 |
| 加密 | `crypto/aes` | `node:crypto` | 算法一致 (AES-256-GCM) |

---

## 23. 开发路线图

### Phase 1: 核心骨架（4-6 周）

- [ ] 项目脚手架（package.json, tsconfig, bunfig）
- [ ] Core: App 接口 + BaseApp
- [ ] DB: SQLite 适配器 + QueryBuilder
- [ ] DB: PostgreSQL 适配器
- [ ] Models: BaseModel, Collection, Record
- [ ] Fields: 17 种字段类型
- [ ] Hook 系统
- [ ] 迁移系统 + 系统迁移
- [ ] CLI: serve + superuser

### Phase 2: API 层（4-6 周）

- [ ] Health + Settings API
- [ ] Collection CRUD API
- [ ] Record CRUD API + 搜索/过滤引擎
- [ ] Auth 系统（5 种认证流程）
- [ ] File API + 缩略图
- [ ] Realtime SSE
- [ ] Batch API
- [ ] Logs + Cron API
- [ ] Backup API
- [ ] 中间件完整实现

### Phase 3: 插件（2-4 周）

- [ ] Secrets 插件
- [ ] Jobs 插件
- [ ] Gateway 插件
- [ ] KV 插件
- [ ] Analytics / Metrics / Trace 插件

### Phase 4: 集成验证（2-3 周）

- [ ] JS SDK 集成测试
- [ ] Admin UI 集成验证
- [ ] Go ↔ Bun 数据库互操作测试
- [ ] 性能基准测试
- [ ] `bun build --compile` 单二进制打包

---

## 24. 测试策略

### TDD 流程

1. 先编写测试（红灯）→ 实现代码（绿灯）→ 重构
2. 非 UI 代码行覆盖率 ≥ 95%

### 测试层次

| 层次 | 框架 | 说明 |
|------|------|------|
| 单元测试 | `bun:test` | 每个模块独立测试 |
| 集成测试 | `bun:test` + 真实 DB | SQLite + PostgreSQL Docker |
| API 兼容性测试 | `bun:test` | 对齐 Go 版 API 测试用例 |
| E2E 测试 | JS SDK | 用真实 SDK 连接测试 |

### PostgreSQL 测试

与 Go 版一致：**禁止 Mock，必须连接真实数据库**。使用 Docker 容器自动启动。
