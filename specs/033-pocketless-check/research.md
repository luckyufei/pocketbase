# Research: PocketLess 功能完全对齐

**Feature**: 033-pocketless-check  
**Date**: 2026-02-11  
**Status**: Complete

## 研究任务总览

| # | 研究问题 | 状态 |
|---|---------|------|
| R1 | 权限过滤实现方案 | ✅ 已决策 |
| R2 | 集合验证实现方案 | ✅ 已决策 |
| R3 | 自动表同步实现方案 | ✅ 已决策 |
| R4 | View 集合实现方案 | ✅ 已决策 |
| R5 | Hook 链完整性方案 | ✅ 已决策 |
| R6 | TxApp 事务感知方案 | ✅ 已决策 |
| R7 | :changed / :isset 修正方案 | ✅ 已决策 |
| R8 | 工具模块实现方案 | ✅ 已决策 |
| R9 | CLI 实际执行方案 | ✅ 已决策 |

---

## R1: 权限过滤实现方案

### 问题
pocketless CRUD 端点（`record_crud.ts`）完全没有权限检查。任何客户端都能读写所有数据。

### 决策
**复用现有 `RecordFieldResolver` + `search.FilterData` 机制**，在 CRUD 处理器中注入权限规则。

### 理由
- Go 版的权限检查不是独立模块，而是在 CRUD 处理器中直接调用 `RecordFieldResolver` + `search.FilterData(rule).BuildExpr(resolver)`
- pocketless 已有 `RecordFieldResolver`（`core/record_field_resolver.ts`）和 `FilterData`（`tools/search/filter.ts`），只需在 CRUD 层调用
- 新增 `core/db_permission_filter.ts` 只处理 Realtime 广播权限（Go 版同此 fork 的 `core/db_permission_filter.go` 也只处理 Realtime 权限）

### 备选方案
1. **中间件方案** — 在路由中间件中统一检查权限。**拒绝原因：** Go 版不是这么实现的，每个端点的权限检查逻辑有细微差异（list 注入 WHERE、view 用 ruleFunc、create 用 CTE）
2. **独立权限服务** — 抽象为独立服务。**拒绝原因：** 过度抽象，增加认知负荷

### 实现关键点
- `null` rule = admin only → 非超级用户返回 403
- `""` (空字符串) rule = public → 所有人可访问
- 非空 rule → 通过 `FilterData(rule).buildExpr(resolver)` 构建 SQL WHERE
- list: 注入 WHERE 条件
- view: 传 ruleFunc 给 `findRecordById`
- create: 用 CTE (WITH ... SELECT) 验证新记录是否满足规则
- update/delete: 先 fetch record，再用 rule 验证

---

## R2: 集合验证实现方案

### 问题
pocketless 缺少 `collection_validate.ts`，用户可以创建无效集合定义。

### 决策
**创建 `core/collection_validate.ts`**，对齐 Go 版 26 项验证检查。

### 理由
Go 版 `collection_validate.go`（711 行）通过 `onCollectionValidate` hook 注册。pocketless 已有 `onCollectionValidate` hook 定义（base.ts line 117），只需添加默认处理器。

### 实现关键点
- 通过 `app.onCollectionValidate.add()` 注册默认验证器
- 验证项优先级：
  1. **必须实现**：名称唯一性、字段名/ID 重复检测、系统字段保护、类型不可变、字段类型不可变
  2. **必须实现**：规则语法验证（调用 `FilterData.buildExpr` 测试）
  3. **必须实现**：Auth 集合必需字段（password/tokenKey/email/emailVisibility/verified）
  4. **应该实现**：索引验证、View 选项验证
- 使用 Zod 或自定义 ValidationError 返回结构化错误

---

## R3: 自动表同步实现方案

### 问题
pocketless 缺少 `collection_record_table_sync.ts`，集合字段变更后数据库表结构不同步。

### 决策
**创建 `core/collection_record_table_sync.ts`**，通过 `onCollectionCreateExecute` / `onCollectionUpdateExecute` / `onCollectionDeleteExecute` hook 触发。

### 理由
Go 版 `SyncRecordTableSchema` 在集合保存时被调用。pocketless 需要相同机制。

### 实现关键点
- SQLite DDL: `ALTER TABLE ADD COLUMN` / `ALTER TABLE DROP COLUMN` (SQLite 3.35+，Bun 内置的 SQLite 支持)
- PostgreSQL DDL: 标准 `ALTER TABLE ADD/DROP/RENAME COLUMN`
- 使用 Kysely 的 `schema` API 执行 DDL
- 需要 diff 逻辑：比较 oldCollection 和 newCollection 的字段列表
- 索引管理：先删除旧索引，再创建新索引
- 特殊处理：single ↔ multiple 字段转换（JSON 数组化/去数组化）

### 备选方案
1. **使用 Kysely migration API** — **拒绝原因：** Kysely migration 是面向用户的，不适合运行时动态 DDL
2. **原生 SQL 字符串** — **已选择：** 与 Go 版一致，更可控

---

## R4: View 集合实现方案

### 问题
pocketless 有 `COLLECTION_TYPE_VIEW` 常量但无任何功能实现。

### 决策
**创建 `core/view.ts`**，实现 `saveView` / `deleteView` / `createViewFields`。

### 理由
View 集合是 PocketBase 差异化特性。Go 版 `view.go`（621 行）实现完整。

### 实现关键点
- `saveView(name, selectQuery)`: 在事务中执行 `CREATE VIEW` / `CREATE OR REPLACE VIEW`
- `deleteView(name)`: 执行 `DROP VIEW IF EXISTS`
- `createViewFields(selectQuery)`: 创建临时视图 → `PRAGMA table_info` (SQLite) / `information_schema.columns` (PG) → 推断字段类型
- 字段类型推断规则：
  - `id` 列 → RelationField（指向源集合）
  - `count(*)` / `total()` → NumberField
  - `CAST(x AS type)` → 对应字段类型
  - 源集合字段引用 → 克隆字段定义
  - 其他 → JSONField
- CRUD 端点需检查 `isView()` → 禁止 create/update/delete

---

## R5: Hook 链完整性方案

### 问题
约 20 个 hook 缺失；db.ts 中 Record-level 前置 hook 未触发；Error hook 未触发。

### 决策
**分三步修复：(1) 添加缺失 hook 定义到 base.ts (2) 修复 db.ts hook 链 (3) 在 API 处理器中触发 API hook**

### 理由
Go 版有 83 个 hook，pocketless 有 ~63 个。缺失的 hook 主要是：
- Realtime hooks (3): `onRealtimeConnectRequest`, `onRealtimeMessageSend`, `onRealtimeSubscribeRequest`
- Settings hooks (3): `onSettingsListRequest`, `onSettingsUpdateRequest`, `onSettingsReload`
- File hooks (2): `onFileDownloadRequest`, `onFileTokenRequest`
- Batch hook (1): `onBatchRequest`
- Backup hooks (2): `onBackupCreate`, `onBackupRestore`
- Collection error hooks (3): `onCollectionAfterCreateError`, `onCollectionAfterUpdateError`, `onCollectionAfterDeleteError`
- Record enrich hook (1): `onRecordEnrich`

### 实现关键点
- db.ts 修复：
  1. 包裹 try/catch，失败时触发 error hook
  2. 添加 Record-level 前置 hook（onRecordCreate/Update/Delete + Execute）
  3. 整个操作在事务中执行
- API 处理器修复：
  1. `settings.ts` 中添加 `onSettingsListRequest` / `onSettingsUpdateRequest` 触发
  2. `realtime.ts` 中添加 `onRealtimeConnectRequest` / `onRealtimeSubscribeRequest` 触发
  3. `realtime_broadcast.ts` 中添加 `onRealtimeMessageSend` 触发
  4. `file.ts` 中添加 `onFileDownloadRequest` / `onFileTokenRequest` 触发
  5. `batch.ts` 中添加 `onBatchRequest` 触发
  6. `backup.ts` / `backup_restore.ts` 中添加 backup hooks 触发
  7. CRUD 响应中添加 `onRecordEnrich` 触发

---

## R6: TxApp 事务感知方案

### 问题
pocketless 的 `runInTransaction` 只传递 `QueryBuilder`，事务内部无法通过 `app.save()` 参与事务。

### 决策
**实现 TxApp 模式**：`runInTransaction` 创建一个 App 的浅拷贝，将 DB 连接绑定到事务。

### 理由
Go 版的 `RunInTransaction` 创建一个 `txApp`，它覆盖了 `DB()` / `ConcurrentDB()` / `NonconcurrentDB()` 方法，使所有通过 `txApp` 执行的操作自动在事务中。

### 实现关键点
- `TxApp` 类继承/代理 `BaseApp`，覆盖 `db()` 返回事务连接
- `runInTransaction(fn)` 签名变为 `fn: (txApp: App) => Promise<T>`
- 事务内调用 `txApp.save(record)` 自动使用事务连接
- 需要标记 `isTransactional()` → true
- 嵌套事务支持：如果已在事务中，直接使用现有事务（Go 版行为）

### 备选方案
1. **AsyncLocalStorage** — 使用 Node.js AsyncLocalStorage 自动传播事务上下文。**拒绝原因：** Bun 对 AsyncLocalStorage 的支持不完整，且增加隐式魔法
2. **显式传递 tx 参数** — 每个函数都接受可选的 tx 参数。**拒绝原因：** API 侵入性太强，需要修改所有函数签名

---

## R7: :changed / :isset 修正方案

### 问题
- `:isset` 当前检查 DB 列值是否非空，应检查请求 body 中是否存在该字段
- `:changed` 当前硬编码返回 `1`（true），应比较请求值与当前值

### 决策
**按照 Go 版语义修正两个修饰符的实现**。

### 理由
Go 版 `:isset` 在 `resolveStaticRequestField` 中检查 `extractNestedVal(staticRequestInfo, path...)` 是否有错误来判断字段是否存在。`:changed` 展开为 `@request.body.{name}:isset = true && @request.body.{name} != {name}`。

### 实现关键点
- `:isset` 修正：不再查询 DB 列，而是检查 `requestInfo.body` 中是否包含该 key
  - 返回 SQL 字面量 `TRUE` 或 `FALSE`
  - 需要在 resolver 中访问 requestInfo
- `:changed` 修正：展开为子表达式
  - `@request.body.{fieldName}:isset = true && @request.body.{fieldName} != {fieldName}`
  - 需要递归调用 `FilterData.buildExpr` 解析子表达式

---

## R8: 工具模块实现方案

### 问题
缺少 `tools/picker`、`tools/dbutils`、`tools/archive`、`tools/logger`。

### 决策

#### picker
**创建 `tools/picker/`**，实现 `pick(data, rawFields)` 函数 + `excerpt` 修饰符。

- Go 版 `Pick(data, "a,c.c1")` 从 `{a:1,b:2,c:{c1:11,c2:22}}` 提取 `{a:1,c:{c1:11}}`
- 支持嵌套路径、多值、修饰符注册
- `excerpt(max, withEllipsis)` 从 HTML 提取纯文本摘要

#### dbutils
**创建 `tools/dbutils/`**，优先实现 CRUD 和集合管理依赖的子集：

| 子模块 | 优先级 | 说明 |
|--------|--------|------|
| `index.ts` | P1 | Index 解析/构建（集合验证依赖） |
| `errors.ts` | P1 | DB 错误类型判断（IsUniqueViolation 等） |
| `json.ts` | P1 | JSON 函数统一接口（SQLite/PG） |
| `dbtype.ts` | P2 | DB 类型检测 |
| `type_conversion.ts` | P3 | 类型转换工具 |

注意：`fulltext_pg.ts`、`pool_monitor.ts`、`postgres_init.ts` 等可后续迭代。

#### archive
**创建 `tools/archive/`**，使用 Bun 内置的 `node:zlib` + `archiver` npm 包。

- `create(src, dest, skipPaths)`: 将目录打包为 ZIP
- `extract(src, dest)`: 解压 ZIP（含 Zip Slip 防护）

#### logger
**创建 `tools/logger/`**，基于 `console` API 的结构化日志。

- 支持日志级别：debug/info/warn/error
- 支持结构化数据（JSON 格式）
- 与 Go 版的 `slog` 对齐的 API

### 备选方案
- **使用 pino/winston** — **拒绝原因：** "丰田式"原则要求最小依赖；Bun 的 `console` 已足够基础日志需求
- **使用 JSZip** — **拒绝原因：** archiver 包在 Node.js 生态更成熟，Bun 兼容

---

## R9: CLI 实际执行方案

### 问题
`superuser.ts` 和 `migrate.ts` 所有子命令只打印消息。

### 决策
**实现 CLI 命令的完整逻辑**，调用已有的 core 层 API。

### superuser 命令
- `create email password`: 在 `_superusers` 集合中创建记录（密码哈希用 bcrypt）
- `upsert email password`: 存在则更新，不存在则创建
- `update email password`: 更新密码
- `delete email`: 删除记录
- `otp email`: 生成一次性密码

### migrate 命令
- `up`: 读取 migrations 目录，按文件名排序执行未运行的迁移
- `down [count]`: 回滚最近的 N 个迁移
- `create name`: 在 migrations 目录创建新的迁移模板文件
- `collections`: 从当前集合定义生成迁移文件
- `history-sync`: 同步 `_migrations` 表与文件系统

### 实现关键点
- superuser 依赖 `app.save(record)` + `tools/security` 的密码哈希
- migrate 依赖 `migrations/index.ts` 中已有的迁移框架
- 需要 `app.bootstrap()` 在命令执行前初始化数据库
