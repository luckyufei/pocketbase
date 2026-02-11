# Data Model: PocketLess 功能完全对齐

**Feature**: 033-pocketless-check  
**Date**: 2026-02-11

## 实体概览

```
┌─────────────────────────────────────────────────────────────────────┐
│                           BaseApp (core/base.ts)                    │
│  hooks: 83 个 Hook 实例                                             │
│  db(): QueryBuilder                                                 │
│  settings(): Settings                                               │
│  newFilesystem(): Filesystem                                        │
│  newBackupsFilesystem(): Filesystem                                 │
│  newMailClient(): Mailer                                            │
│  logger(): Logger                                                   │
│  unsafeWithoutHooks(): App                                          │
│  runInTransaction(fn: (txApp: App) => Promise<T>): Promise<T>       │
│  isTransactional(): boolean                                         │
├─────────────────────────────────────────────────────────────────────┤
│                           TxApp (NEW)                               │
│  extends BaseApp (浅拷贝), db() 绑定到事务连接                       │
└─────────────────────────────────────────────────────────────────────┘
```

## 新增实体

### 1. PermissionRuleChecker (core/permission_rule.ts)

**职责**: 在 CRUD 端点中验证权限规则。不是独立实体，而是工具函数集合。

```typescript
// 权限检查入口函数
interface PermissionCheckResult {
  allowed: boolean;
  ruleExpr?: Expression;  // 可注入查询的 SQL WHERE 表达式
}

// 函数签名
function checkListRule(
  app: App,
  collection: CollectionModel,
  requestInfo: RequestInfo,
): Promise<{ expr: Expression; resolver: RecordFieldResolver }>;

function checkViewRule(
  app: App,
  collection: CollectionModel,
  requestInfo: RequestInfo,
): Promise<(query: SelectQuery) => void>;

function checkCreateRule(
  app: App,
  collection: CollectionModel,
  record: RecordModel,
  requestInfo: RequestInfo,
): Promise<boolean>;

function checkUpdateRule(
  app: App,
  collection: CollectionModel,
  record: RecordModel,
  requestInfo: RequestInfo,
): Promise<boolean>;

function checkDeleteRule(
  app: App,
  collection: CollectionModel,
  record: RecordModel,
  requestInfo: RequestInfo,
): Promise<boolean>;
```

**规则语义**:

| Rule 值 | 含义 | 行为 |
|---------|------|------|
| `null` | Admin Only | 非超级用户 → 403 |
| `""` (空字符串) | Public | 所有人可访问 |
| `"@request.auth.id != ''"` | 需认证 | 解析为 SQL WHERE |
| `"@request.auth.id = author"` | 记录级权限 | 解析为 SQL WHERE + JOIN |

### 2. CollectionValidator (core/collection_validate.ts)

**职责**: 集合定义验证，通过 `onCollectionValidate` hook 注册。

```typescript
interface ValidationError {
  field: string;      // 字段路径，如 "name", "fields[0].name"
  code: string;       // 错误码
  message: string;    // 人类可读错误信息
}

interface CollectionValidatorContext {
  app: App;
  collection: CollectionModel;
  oldCollection?: CollectionModel;  // 更新时的旧版本
  isNew: boolean;
}

// 验证检查清单 (26 项，与 Go 版对齐)
// 1. ID 格式验证 (1-100 chars, DefaultIdRegex, 唯一)
// 2. ID 不可变 (更新时)
// 3. System 标志不可变
// 4. Type 必须为 base/auth/view
// 5. Type 不可变
// 6. Name 必须 1-255 chars
// 7. Name 不含 _via_
// 8. Name 匹配 /^\w+$/
// 9. 系统集合名不可变
// 10. Name 唯一 (大小写不敏感)
// 11. 字段 ID 和名称不重复
// 12. 必须有 id PK 字段; Auth 需 password/tokenKey/email/emailVisibility/verified
// 13. 系统字段不可删除/重命名
// 14. 字段类型不可变
// 15. Auth 字段名不能是 passwordConfirm/oldPassword
// 16. 每个字段 validateSettings()
// 17-22. 规则语法验证 (list/view/create/update/delete + 系统集合规则不可变)
// 23. 索引验证 (View 不支持索引; 语法/名称唯一/系统唯一索引保护)
// 24. Auth 必须有 tokenKey + email 唯一索引
// 25. 选项验证 (Auth/View options)
// 26. View 查询可执行性验证
```

### 3. RecordTableSync (core/collection_record_table_sync.ts)

**职责**: 集合变更后自动同步数据库表结构。

```typescript
interface TableSyncOp {
  type: "create_table" | "rename_table" | "add_column" | "drop_column" | "rename_column" | "drop_index" | "create_index";
  detail: string;  // DDL SQL
}

// 入口函数
async function syncRecordTableSchema(
  app: App,
  newCollection: CollectionModel,
  oldCollection?: CollectionModel,  // null = 创建新表
): Promise<void>;

// 辅助函数
async function dropCollectionIndexes(app: App, collection: CollectionModel): Promise<void>;
async function createCollectionIndexes(app: App, collection: CollectionModel): Promise<void>;
```

**字段类型 → DDL 列类型映射**:

| Field Type | SQLite Column | PostgreSQL Column |
|------------|---------------|-------------------|
| text | TEXT DEFAULT '' | TEXT DEFAULT '' |
| number | NUMERIC DEFAULT 0 | DOUBLE PRECISION DEFAULT 0 |
| bool | BOOLEAN DEFAULT FALSE | BOOLEAN DEFAULT FALSE |
| email | TEXT DEFAULT '' | TEXT DEFAULT '' |
| url | TEXT DEFAULT '' | TEXT DEFAULT '' |
| date | TEXT DEFAULT '' | TIMESTAMPTZ DEFAULT NULL |
| select | TEXT DEFAULT '' | TEXT DEFAULT '' |
| json | JSON DEFAULT 'null' | JSONB DEFAULT 'null' |
| file | TEXT DEFAULT '' | TEXT DEFAULT '' |
| relation | TEXT DEFAULT '' | TEXT DEFAULT '' |
| password | TEXT NOT NULL DEFAULT '' | TEXT NOT NULL DEFAULT '' |
| autodate | TEXT DEFAULT '' | TIMESTAMPTZ DEFAULT NULL |
| editor | TEXT DEFAULT '' | TEXT DEFAULT '' |
| geo_point | TEXT DEFAULT '' | TEXT DEFAULT '' |

### 4. ViewCollection (core/view.ts)

**职责**: View 集合的创建/删除/字段推断。

```typescript
// 导出函数
async function saveView(app: App, name: string, selectQuery: string): Promise<void>;
async function deleteView(app: App, name: string): Promise<void>;
async function createViewFields(app: App, selectQuery: string): Promise<FieldDefinition[]>;
async function findRecordByViewFile(
  app: App,
  viewCollection: CollectionModel | string,
  fileFieldName: string,
  filename: string,
): Promise<RecordModel>;

// 内部函数
function parseQueryToFields(app: App, selectQuery: string): Promise<FieldDefinition[]>;
function getQueryTableInfo(app: App, selectQuery: string): Promise<ColumnInfo[]>;
```

### 5. TxApp (core/tx_app.ts)

**职责**: 事务感知的 App 实例。

```typescript
class TxApp extends BaseApp {
  private txDb: TransactionQueryBuilder;
  
  constructor(parentApp: BaseApp, tx: TransactionQueryBuilder) {
    // 浅拷贝 parentApp 的所有属性
    // 覆盖 db() 返回 txDb
  }
  
  db(): QueryBuilder {
    return this.txDb;  // 绑定到事务连接
  }
  
  isTransactional(): boolean {
    return true;
  }
  
  // 嵌套事务: 如果已在事务中，直接使用
  async runInTransaction<T>(fn: (txApp: App) => Promise<T>): Promise<T> {
    return fn(this);  // 复用当前事务
  }
}
```

### 6. Picker (tools/picker/)

```typescript
// tools/picker/pick.ts
interface ModifierFunc {
  (value: any, args: string): any;
}

const modifiers: Map<string, ModifierFunc>;

function pick(data: any, rawFields: string): any;
function registerModifier(name: string, fn: ModifierFunc): void;

// tools/picker/excerpt_modifier.ts
// 内置 "excerpt" 修饰符: 从 HTML 提取纯文本摘要
// 用法: fields=content:excerpt(200,true)
```

### 7. Logger (tools/logger/)

```typescript
// tools/logger/logger.ts
type LogLevel = "debug" | "info" | "warn" | "error";

interface Logger {
  debug(msg: string, data?: Record<string, any>): void;
  info(msg: string, data?: Record<string, any>): void;
  warn(msg: string, data?: Record<string, any>): void;
  error(msg: string, data?: Record<string, any>): void;
  with(data: Record<string, any>): Logger;  // 创建带上下文的子 logger
  level: LogLevel;
}

function newLogger(level?: LogLevel): Logger;
```

### 8. Archive (tools/archive/)

```typescript
// tools/archive/create.ts
async function createArchive(src: string, dest: string, skipPaths?: string[]): Promise<void>;

// tools/archive/extract.ts
async function extractArchive(src: string, dest: string): Promise<void>;
```

### 9. DBUtils (tools/dbutils/)

```typescript
// tools/dbutils/index.ts
interface Index {
  tableName: string;
  indexName: string;
  isUnique: boolean;
  columns: IndexColumn[];
  optionalFilter?: string;  // WHERE 子句
}

interface IndexColumn {
  name: string;
  collate?: string;
  sort?: "ASC" | "DESC";
}

function parseIndex(indexSql: string): Index;
function buildIndex(index: Index): string;

// tools/dbutils/errors.ts
function isUniqueViolation(err: Error): boolean;
function isForeignKeyViolation(err: Error): boolean;
function isNotNullViolation(err: Error): boolean;

// tools/dbutils/json.ts
interface JSONFunctions {
  each(column: string): string;
  arrayLength(column: string): string;
  extract(column: string, path: string): string;
}

function getJSONFunctions(dbType: "sqlite" | "postgres"): JSONFunctions;
```

## 现有实体修改

### BaseApp (core/base.ts) 修改

新增属性/方法:
- `_onRealtimeConnectRequest: Hook<RealtimeConnectRequestEvent>`
- `_onRealtimeSubscribeRequest: Hook<RealtimeSubscribeRequestEvent>`
- `_onRealtimeMessageSend: Hook<RealtimeMessageEvent>`
- `_onSettingsListRequest: Hook<SettingsListRequestEvent>`
- `_onSettingsUpdateRequest: Hook<SettingsUpdateRequestEvent>`
- `_onSettingsReload: Hook<SettingsReloadEvent>`
- `_onFileDownloadRequest: TaggedHook<FileDownloadRequestEvent>`
- `_onFileTokenRequest: TaggedHook<FileTokenRequestEvent>`
- `_onBatchRequest: Hook<BatchRequestEvent>`
- `_onBackupCreate: Hook<BackupEvent>`
- `_onBackupRestore: Hook<BackupEvent>`
- `_onRecordEnrich: TaggedHook<RecordEnrichEvent>`
- `_onCollectionAfterCreateError: Hook<CollectionErrorEvent>`
- `_onCollectionAfterUpdateError: Hook<CollectionErrorEvent>`
- `_onCollectionAfterDeleteError: Hook<CollectionErrorEvent>`
- `newFilesystem(): Promise<Filesystem>`
- `newBackupsFilesystem(): Promise<Filesystem>`
- `newMailClient(): Mailer`
- `logger(): Logger`
- `unsafeWithoutHooks(): App`
- `isTransactional(): boolean`

### db.ts 修改

- `modelCreate/modelUpdate/modelDelete` 包裹在事务中
- 添加 try/catch，失败时触发 error hook
- 添加 Record-level 前置 hook 触发
- `runInTransaction` 签名变为 `fn: (txApp: App) => Promise<T>`

### record_field_resolver.ts 修改

- `:isset` 修正：检查 `requestInfo.body` 是否包含字段 key → 返回 SQL `TRUE`/`FALSE`
- `:changed` 修正：展开为 `@request.body.{name}:isset = true && @request.body.{name} != {name}`

## 关系图

```
BaseApp ──1:N──> Hook instances (83 total)
BaseApp ──1:1──> Settings
BaseApp ──1:1──> Logger (NEW)
BaseApp ──1:*──> TxApp (NEW, via runInTransaction)

CollectionModel ──1:N──> FieldDefinition
CollectionModel ──1:1──> CollectionValidator (NEW, via hook)
CollectionModel ──1:1──> RecordTableSync (NEW, via hook)

ViewCollection ──extends──> CollectionModel (type="view")
ViewCollection ──1:1──> SQL Query (options.viewQuery)

RecordModel ──N:1──> CollectionModel
RecordModel ──validated by──> PermissionRuleChecker (NEW, in CRUD handlers)

RecordFieldResolver ──uses──> FilterData (tools/search)
RecordFieldResolver ──uses──> RequestInfo (macros resolution)
PermissionRuleChecker ──uses──> RecordFieldResolver
PermissionRuleChecker ──uses──> FilterData

Picker ──uses──> Modifier (excerpt, etc.)
```
