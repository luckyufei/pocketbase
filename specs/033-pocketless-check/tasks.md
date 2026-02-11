# Tasks: PocketLess 功能完全对齐

**Input**: Design documents from `/specs/033-pocketless-check/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: TDD 流程要求，所有新模块先写测试再实现（spec 中要求覆盖率 ≥ 90%）。

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Project root**: `pocketless/src/` (TypeScript on Bun)
- **Tests**: `pocketless/src/**/*.test.ts` (与源文件同目录)
- **Go Reference**: 对应功能的 Go PocketBase 参考文件

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 无需新建项目，pocketless 已存在。此阶段确认开发环境就绪。

- [X] T001 确认开发环境：运行 `cd pocketless && bun install && bun test` 确保现有测试通过

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 所有 User Story 依赖的底层基础设施修复

**⚠️ CRITICAL**: 必须在所有 User Story 之前完成

- [X] T002 修复 `pocketless/src/core/db.ts` 中 `modelCreate` 事务包裹：在 model 创建操作外包裹事务，添加 try/catch 触发 `onModelAfterCreateError` hook（参考 Go `core/db.go`）
- [X] T003 修复 `pocketless/src/core/db.ts` 中 `modelUpdate` 事务包裹：在 model 更新操作外包裹事务，添加 try/catch 触发 `onModelAfterUpdateError` hook
- [X] T004 修复 `pocketless/src/core/db.ts` 中 `modelDelete` 事务包裹：在 model 删除操作外包裹事务，添加 try/catch 触发 `onModelAfterDeleteError` hook
- [X] T005 在 `pocketless/src/core/db.ts` 中添加 Record-level 前置 hook 触发：`modelCreate/modelUpdate/modelDelete` 中检测 Record 类型，触发 `onRecordCreate`/`onRecordUpdate`/`onRecordDelete` 系列 hook
- [X] T006 创建 `pocketless/src/core/tx_app.ts`：实现 TxApp 类（浅拷贝 BaseApp，覆盖 `db()` 返回事务连接，`isTransactional()` 返回 true，嵌套事务复用当前事务）
- [X] T007 修改 `pocketless/src/core/base.ts` 中 `runInTransaction` 签名：从 `fn: (qb) => Promise<T>` 改为 `fn: (txApp: App) => Promise<T>`，内部创建 TxApp 实例

**Checkpoint**: db.ts hook 链 + TxApp 就绪，后续 User Story 可基于此构建

---

## Phase 3: User Story 1 - Record 访问规则强制执行 (Priority: P1) 🎯 MVP

**Goal**: 在 API 层面强制执行集合的 `listRule`/`viewRule`/`createRule`/`updateRule`/`deleteRule` 访问控制规则

**Independent Test**: 创建带 `listRule = "@request.auth.id != ''"` 的集合，验证未认证用户返回 403/空列表、已认证用户返回正确数据

### Tests for User Story 1

- [X] T008 [P] [US1] 编写 `:isset` 修饰符修正测试 in `pocketless/src/core/record_field_resolver.test.ts`：验证 `:isset` 检查 requestInfo.body 中是否存在字段 key（而非 DB 列是否非空），返回 SQL `TRUE`/`FALSE`
- [X] T009 [P] [US1] 编写 `:changed` 修饰符修正测试 in `pocketless/src/core/record_field_resolver.test.ts`：验证 `:changed` 展开为 `@request.body.{name}:isset = true && @request.body.{name} != {name}`
- [X] T010 [P] [US1] 编写权限规则检查测试 in `pocketless/src/core/permission_rule.test.ts`：覆盖 null rule (403)、空字符串 rule (public)、需认证 rule、记录级权限 rule 4 种场景
- [X] T011 [P] [US1] 编写 Record CRUD 权限集成测试 in `pocketless/src/apis/record_crud.test.ts`：新增 listRule/viewRule/createRule/updateRule/deleteRule 权限检查场景

### Implementation for User Story 1

- [X] T012 [US1] 修正 `pocketless/src/core/record_field_resolver.ts` 中 `:isset` 修饰符实现：检查 `requestInfo.body` 是否包含字段 key → 返回 SQL `TRUE`/`FALSE`（参考 Go `core/record_field_resolver_runner.go`）
- [X] T013 [US1] 修正 `pocketless/src/core/record_field_resolver.ts` 中 `:changed` 修饰符实现：展开为子表达式 `@request.body.{name}:isset = true && @request.body.{name} != {name}`
- [X] T014 [US1] 创建 `pocketless/src/core/permission_rule.ts`：实现 `checkListRule`/`checkViewRule`/`checkCreateRule`/`checkUpdateRule`/`checkDeleteRule` 五个权限检查函数，使用现有 `RecordFieldResolver` + `FilterData.buildExpr` 机制
- [X] T015 [US1] 修改 `pocketless/src/apis/record_crud.ts` 的 List 处理器：添加 `listRule` 检查（null → 403，"" → 不过滤，非空 → 注入 WHERE 条件）
- [X] T016 [US1] 修改 `pocketless/src/apis/record_crud.ts` 的 View 处理器：添加 `viewRule` 检查（通过 ruleFunc 过滤单条记录）
- [X] T017 [US1] 修改 `pocketless/src/apis/record_crud.ts` 的 Create 处理器：添加 `createRule` 检查（null → 403，非空 → CTE 验证新记录满足规则）
- [X] T018 [US1] 修改 `pocketless/src/apis/record_crud.ts` 的 Update/Delete 处理器：添加 `updateRule`/`deleteRule` 检查（先 fetch → 再用 rule 验证）

**Checkpoint**: Record CRUD 权限检查完整，未授权请求被正确拒绝

---

## Phase 4: User Story 2 - 集合验证与自动表同步 (Priority: P1)

**Goal**: 集合创建/更新时执行完整验证，字段变更后自动同步底层数据库表结构

**Independent Test**: 创建带重复字段名的集合，验证返回验证错误；添加新字段后验证 DB 表自动增加对应列

### Tests for User Story 2

- [X] T019 [P] [US2] 编写集合验证测试 in `pocketless/src/core/collection_validate.test.ts`：覆盖重复字段名、系统字段保护、ID 不可变、类型不可变、名称唯一性、Auth 必需字段、规则语法验证等 26 项检查
- [X] T020 [P] [US2] 编写自动表同步测试 in `pocketless/src/core/collection_record_table_sync.test.ts`：覆盖创建新表、添加列、删除列、重命名列、索引管理场景

### Implementation for User Story 2

- [X] T021 [P] [US2] 创建 `pocketless/src/tools/dbutils/index.ts`：实现 `parseIndex`/`buildIndex` 索引解析和构建（集合验证依赖，参考 Go `tools/dbutils/index.go`）
- [X] T022 [P] [US2] 创建 `pocketless/src/tools/dbutils/errors.ts`：实现 `isUniqueViolation`/`isForeignKeyViolation`/`isNotNullViolation` DB 错误分类
- [X] T023 [P] [US2] 创建 `pocketless/src/tools/dbutils/json.ts`：实现 `getJSONFunctions` 统一 JSON 查询接口（SQLite vs PostgreSQL）
- [X] T024 [US2] 创建 `pocketless/src/core/collection_validate.ts`：实现 26 项集合验证检查，通过 `app.onCollectionValidate.add()` 注册默认验证器（参考 Go `core/collection_validate.go`）
- [X] T025 [US2] 创建 `pocketless/src/core/collection_record_table_sync.ts`：实现 `syncRecordTableSchema` 函数，支持 CREATE TABLE / ALTER TABLE ADD/DROP/RENAME COLUMN / 索引管理（参考 Go `core/collection_record_table_sync.go`），通过 `onCollectionCreateExecute`/`onCollectionUpdateExecute` hook 触发

**Checkpoint**: 集合验证拦截无效定义，字段变更自动同步 DB 表结构

---

## Phase 5: User Story 3 - 完整 Hook 事件体系 (Priority: P1)

**Goal**: 补全缺失的 ~15 个 Hook（Settings、Realtime、File、Batch、Backup、RecordEnrich 等）

**Independent Test**: 注册 `onSettingsUpdateRequest` hook，验证更新 Settings 时 hook 被触发且能修改数据

### Tests for User Story 3

- [X] T026 [P] [US3] 编写 Hook 定义和事件类型测试 in `pocketless/src/core/base.test.ts`：验证所有新增 hook 可以被注册和触发
- [X] T027 [P] [US3] 编写 API Hook 触发集成测试：验证 Settings/File/Batch/Backup API 正确触发对应 hook（分别在 `pocketless/src/apis/settings.test.ts`、`pocketless/src/apis/file.test.ts`、`pocketless/src/apis/batch.test.ts`、`pocketless/src/apis/backup.test.ts`）

### Implementation for User Story 3

- [X] T028 [US3] 在 `pocketless/src/core/base.ts` 中添加缺失 Hook 定义：`onSettingsListRequest`/`onSettingsUpdateRequest`/`onSettingsReload`/`onRealtimeConnectRequest`/`onRealtimeSubscribeRequest`/`onRealtimeMessageSend`/`onFileDownloadRequest`/`onFileTokenRequest`/`onBatchRequest`/`onBackupCreate`/`onBackupRestore`/`onRecordEnrich`/`onCollectionAfterCreateError`/`onCollectionAfterUpdateError`/`onCollectionAfterDeleteError`
- [X] T029 [US3] 在 `pocketless/src/core/events.ts` 中添加新事件类型定义：`RealtimeConnectRequestEvent`、`RealtimeSubscribeRequestEvent`、`RealtimeMessageEvent`、`SettingsListRequestEvent`、`SettingsUpdateRequestEvent`、`FileDownloadRequestEvent`、`FileTokenRequestEvent`、`BatchRequestEvent`、`BackupEvent`、`RecordEnrichEvent`、`CollectionErrorEvent`
- [X] T030 [P] [US3] 修改 `pocketless/src/apis/settings.ts`：在 GET/PATCH 处理器中触发 `onSettingsListRequest`/`onSettingsUpdateRequest` hook
- [X] T031 [P] [US3] 修改 `pocketless/src/apis/file.ts`：在文件下载和 token 处理器中触发 `onFileDownloadRequest`/`onFileTokenRequest` hook
- [X] T032 [P] [US3] 修改 `pocketless/src/apis/batch.ts`：在批量请求处理器中触发 `onBatchRequest` hook
- [X] T033 [P] [US3] 修改 `pocketless/src/apis/backup.ts` 和 `pocketless/src/apis/backup_restore.ts`：触发 `onBackupCreate`/`onBackupRestore` hook
- [X] T034 [US3] 修改 `pocketless/src/apis/record_crud.ts`：在 Record 响应序列化时触发 `onRecordEnrich` hook（支持添加/移除/修改字段）

**Checkpoint**: 所有 ~83 个 Hook 与 Go PocketBase 对齐，开发者可拦截所有关键操作

---

## Phase 6: User Story 4 - Realtime SSE 认证与权限过滤 (Priority: P2)

**Goal**: SSE 连接验证认证 token，广播变更时根据 `listRule`/`viewRule` 过滤可见记录

**Independent Test**: 以未认证客户端订阅需认证集合，验证不会收到变更通知

### Tests for User Story 4

- [X] T035 [P] [US4] 编写 Realtime 权限过滤测试 in `pocketless/src/apis/realtime.test.ts`：覆盖未认证客户端 + viewRule 场景、已认证但无权场景、token 过期场景

### Implementation for User Story 4

- [X] T036 [US4] 修改 `pocketless/src/apis/realtime.ts`：SSE 连接时解析 auth token 并绑定到客户端，触发 `onRealtimeConnectRequest` hook
- [X] T037 [US4] 修改 `pocketless/src/apis/realtime.ts`：订阅请求时触发 `onRealtimeSubscribeRequest` hook
- [X] T038 [US4] 修改 `pocketless/src/apis/realtime_broadcast.ts`：广播前用客户端 auth 信息对每个记录变更检查 `viewRule`/`listRule`，不满足则跳过发送，发送前触发 `onRealtimeMessageSend` hook

**Checkpoint**: Realtime 只向有权限的客户端发送变更通知

---

## Phase 7: User Story 5 - View 集合支持 (Priority: P2)

**Goal**: 支持 View 类型集合（基于 SQL 查询的只读虚拟集合），自动推断字段结构

**Independent Test**: 创建 View 集合 `SELECT COUNT(*) as total FROM posts`，验证通过 API 正确查询

### Tests for User Story 5

- [X] T039 [P] [US5] 编写 View 集合测试 in `pocketless/src/core/view.test.ts`：覆盖 saveView/deleteView/createViewFields/字段类型推断场景

### Implementation for User Story 5

- [X] T040 [US5] 创建 `pocketless/src/core/view.ts`：实现 `saveView`（CREATE VIEW）、`deleteView`（DROP VIEW）、`createViewFields`（PRAGMA table_info / information_schema 推断字段类型）、`findRecordByViewFile`（参考 Go `core/view.go`）
- [X] T041 [US5] 修改 `pocketless/src/apis/record_crud.ts`：View 集合的 Create/Update/Delete 请求返回 400 ("View collections are read-only.")，List/View 请求从 View 查询正常返回

**Checkpoint**: View 集合可创建并通过 List API 返回 SQL 查询聚合结果

---

## Phase 8: User Story 6 - Error Hooks 与事务感知实例 (Priority: P2)

**Goal**: DB 操作失败时触发 Error hooks，TxApp 事务内多步操作原子执行

**Independent Test**: 唯一约束冲突时验证 `onModelAfterCreateError` 触发；事务内 3 条记录第 3 条失败时前 2 条回滚

### Tests for User Story 6

- [X] T042 [P] [US6] 编写 TxApp 测试 in `pocketless/src/core/tx_app.test.ts`：覆盖事务回滚、嵌套事务、isTransactional 标识场景
- [X] T043 [P] [US6] 编写 Error Hook 测试 in `pocketless/src/core/db.test.ts`：验证 INSERT/UPDATE/DELETE 失败时 error hook 被触发

### Implementation for User Story 6

- [X] T044 [US6] 确认 T002-T007 (Phase 2) 中 error hook + TxApp 实现已覆盖 US6 的所有场景；如有遗漏，补充 `pocketless/src/core/tx_app.ts` 和 `pocketless/src/core/db.ts` 中的边界情况处理

**Checkpoint**: Error hooks 正确触发，TxApp 事务回滚行为与 Go 版一致

---

## Phase 9: User Story 7 - 缺失工具模块补全 (Priority: P3)

**Goal**: 实现 picker / dbutils / archive / logger 四个工具模块

**Independent Test**: 使用 picker 从记录中提取 `fields=title,author`，验证仅返回指定字段

### Tests for User Story 7

- [X] T045 [P] [US7] 编写 Picker 测试 in `pocketless/src/tools/picker/pick.test.ts`：覆盖基础字段选择、嵌套路径、excerpt 修饰符场景
- [X] T046 [P] [US7] 编写 DBUtils 测试 in `pocketless/src/tools/dbutils/index.test.ts`：覆盖索引解析/构建场景
- [X] T047 [P] [US7] 编写 Archive 测试 in `pocketless/src/tools/archive/create.test.ts`：覆盖 ZIP 打包/解压 + Zip Slip 防护场景
- [X] T048 [P] [US7] 编写 Logger 测试 in `pocketless/src/tools/logger/logger.test.ts`：覆盖日志级别过滤、结构化数据、子 logger 场景

### Implementation for User Story 7

- [X] T049 [P] [US7] 创建 `pocketless/src/tools/picker/pick.ts`：实现 `pick(data, rawFields)` JSON 字段筛选，支持嵌套路径和修饰符注册（参考 Go `tools/picker/pick.go`）
- [X] T050 [P] [US7] 创建 `pocketless/src/tools/picker/excerpt_modifier.ts`：实现 excerpt 修饰符，从 HTML 提取纯文本摘要
- [X] T051 [P] [US7] 创建 `pocketless/src/tools/archive/create.ts`：实现 `createArchive(src, dest, skipPaths)` ZIP 打包（参考 Go `tools/archive/create.go`）
- [X] T052 [P] [US7] 创建 `pocketless/src/tools/archive/extract.ts`：实现 `extractArchive(src, dest)` ZIP 解压（含 Zip Slip 防护）
- [X] T053 [P] [US7] 创建 `pocketless/src/tools/logger/logger.ts`：实现结构化日志 Logger，支持 debug/info/warn/error 级别、`with()` 上下文子 logger（参考 Go `slog` API）

**Checkpoint**: 所有工具模块独立可用，覆盖率 ≥ 90%

---

## Phase 10: User Story 8 - CLI 命令实际执行逻辑 (Priority: P3)

**Goal**: `superuser` 和 `migrate` CLI 命令的完整执行逻辑实现

**Independent Test**: 运行 `superuser create test@example.com password123`，验证 _superusers 表创建记录

### Tests for User Story 8

- [X] T054 [P] [US8] 编写 superuser 命令测试 in `pocketless/src/cmd/superuser.test.ts`：覆盖 create/upsert/update/delete/otp 子命令场景
- [X] T055 [P] [US8] 编写 migrate 命令测试 in `pocketless/src/cmd/migrate.test.ts`：覆盖 up/down/create/collections/history-sync 子命令场景

### Implementation for User Story 8

- [X] T056 [US8] 实现 `pocketless/src/cmd/superuser.ts` 完整逻辑：create (查重 → bcrypt 密码 → app.save)、upsert、update、delete、otp（参考 Go `cmd/superuser.go`）
- [X] T057 [US8] 实现 `pocketless/src/cmd/migrate.ts` 完整逻辑：up (读目录 → 比对 _migrations → 逐个执行)、down (回滚)、create (生成模板)、collections (生成快照)、history-sync（参考 Go `plugins/migratecmd/`）

**Checkpoint**: CLI 命令可执行实际数据库操作

---

## Phase 11: User Story 9 - App 核心接口补全 (Priority: P2)

**Goal**: 补全 `newFilesystem()` / `newBackupsFilesystem()` / `newMailClient()` / `logger()` / `unsafeWithoutHooks()` 方法

**Independent Test**: 调用 `app.newFilesystem()` 返回根据 Settings 中 S3 配置自动创建的 Filesystem 实例

### Tests for User Story 9

- [X] T058 [P] [US9] 编写 App 接口补全测试 in `pocketless/src/core/base.test.ts`：验证 `newFilesystem` (S3 → S3FS, 无 S3 → LocalFS)、`newBackupsFilesystem`、`newMailClient`、`logger`、`unsafeWithoutHooks` (不触发 hook)

### Implementation for User Story 9

- [X] T059 [US9] 在 `pocketless/src/core/base.ts` 中实现 `newFilesystem()`：读取 Settings S3 配置，返回 S3Filesystem 或 LocalFilesystem
- [X] T060 [US9] 在 `pocketless/src/core/base.ts` 中实现 `newBackupsFilesystem()`：读取 Settings backups S3 配置
- [X] T061 [US9] 在 `pocketless/src/core/base.ts` 中实现 `newMailClient()`：读取 Settings SMTP 配置，返回 Mailer 实例
- [X] T062 [US9] 在 `pocketless/src/core/base.ts` 中实现 `logger()`：返回 Logger 实例（依赖 T053 的 logger 模块）
- [X] T063 [US9] 在 `pocketless/src/core/base.ts` 中实现 `unsafeWithoutHooks()`：返回 App 浅拷贝，所有 hook 替换为空 hook（触发时直接调用 next）

**Checkpoint**: App 接口成为访问所有子系统的统一入口

---

## Phase 12: Polish & Cross-Cutting Concerns

**Purpose**: 跨 User Story 的完善工作

- [ ] T064 [P] 在 `pocketless/src/apis/record_crud.ts` 中集成 Picker `fields` 参数支持：所有 Record 端点支持 `?fields=` 查询参数（依赖 T049）
- [ ] T065 运行全量测试 `cd pocketless && bun test --coverage`，确保所有新增模块覆盖率 ≥ 90%，修复任何回归
- [ ] T066 运行 quickstart.md 中的所有验证场景，确认端到端功能正确

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: 无依赖，立即开始
- **Phase 2 (Foundational)**: 依赖 Phase 1 — **阻塞所有 User Story**
- **Phase 3 (US1 权限)**: 依赖 Phase 2
- **Phase 4 (US2 集合验证)**: 依赖 Phase 2
- **Phase 5 (US3 Hook 补全)**: 依赖 Phase 2
- **Phase 6 (US4 Realtime)**: 依赖 Phase 5 (需要 Realtime hook 定义) + Phase 3 (需要权限检查)
- **Phase 7 (US5 View)**: 依赖 Phase 4 (需要集合验证 + 表同步)
- **Phase 8 (US6 Error/TxApp)**: 依赖 Phase 2 (大部分在 Phase 2 已实现，此处为验证补充)
- **Phase 9 (US7 工具模块)**: 无 User Story 依赖，可与 Phase 3-8 并行
- **Phase 10 (US8 CLI)**: 依赖 Phase 2
- **Phase 11 (US9 App 接口)**: 依赖 Phase 5 (hook 定义) + Phase 9 (logger 模块)
- **Phase 12 (Polish)**: 依赖所有前序 Phase

### User Story Dependencies

```
Phase 2 (Foundation) ──┬──> Phase 3 (US1 权限) ─────────────────┐
                       ├──> Phase 4 (US2 集合验证) ─> Phase 7 (US5 View)
                       ├──> Phase 5 (US3 Hook) ──┬──> Phase 6 (US4 Realtime)
                       │                         └──> Phase 11 (US9 App 接口)
                       ├──> Phase 8 (US6 Error/TxApp)            │
                       ├──> Phase 10 (US8 CLI)                   │
                       │                                         │
Phase 9 (US7 工具) ────────────────────────────> Phase 11 (US9)  │
(独立，可并行)                                                    │
                                                                 ↓
                                                    Phase 12 (Polish)
```

### Within Each User Story

- Tests MUST be written and FAIL before implementation (TDD)
- 权限/验证相关修改需参考对应 Go 源文件
- 每个 Story 完成后需能独立测试验证

### Parallel Opportunities

- **Phase 2 内部**: T002/T003/T004 可并行（修改同一文件不同函数，需合并）
- **Phase 3-5**: US1/US2/US3 可并行（不同文件、不同功能域）
- **Phase 9**: US7 工具模块完全独立，可与任何阶段并行
- **Phase 9 内部**: T049/T050/T051/T052/T053 全部可并行（不同文件）
- **Phase 11 内部**: T059/T060/T061/T062/T063 在同一文件，建议顺序执行

---

## Parallel Example: User Story 2

```bash
# 并行启动测试编写:
Task T019: "编写集合验证测试 in collection_validate.test.ts"
Task T020: "编写自动表同步测试 in collection_record_table_sync.test.ts"

# 并行启动 dbutils 工具（US2 依赖）:
Task T021: "创建 tools/dbutils/index.ts"
Task T022: "创建 tools/dbutils/errors.ts"
Task T023: "创建 tools/dbutils/json.ts"

# 顺序实现核心逻辑:
Task T024: "创建 collection_validate.ts" (依赖 T021)
Task T025: "创建 collection_record_table_sync.ts" (依赖 T024)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup（确认环境）
2. Complete Phase 2: Foundational（db.ts + TxApp）
3. Complete Phase 3: User Story 1（权限检查）
4. **STOP and VALIDATE**: 运行 `bun test src/apis/record_crud.test.ts` 独立验证
5. 权限安全是最高优先级，MVP 交付此功能

### Incremental Delivery

1. Phase 1 + 2 → Foundation ready
2. + Phase 3 (US1 权限) → **安全基线达成** (MVP!)
3. + Phase 4 (US2 验证) → 数据完整性保障
4. + Phase 5 (US3 Hook) → 可扩展性达成
5. + Phase 6 (US4 Realtime) → Realtime 安全
6. + Phase 7 (US5 View) → 高级功能
7. + Phase 9 (US7 工具) + Phase 11 (US9 接口) → 完整功能栈
8. + Phase 10 (US8 CLI) → 运维支持
9. Phase 12 → 最终打磨

### Suggested MVP Scope

**MVP = Phase 1 + Phase 2 + Phase 3 (US1)**：Record CRUD 权限强制执行，这是生产环境使用的最低安全要求。

---

## Summary

| 指标 | 值 |
|------|-----|
| 总任务数 | 66 |
| Phase 1 (Setup) | 1 |
| Phase 2 (Foundational) | 6 |
| Phase 3 (US1 权限) | 11 |
| Phase 4 (US2 集合验证) | 7 |
| Phase 5 (US3 Hook) | 9 |
| Phase 6 (US4 Realtime) | 4 |
| Phase 7 (US5 View) | 3 |
| Phase 8 (US6 Error/TxApp) | 3 |
| Phase 9 (US7 工具) | 9 |
| Phase 10 (US8 CLI) | 4 |
| Phase 11 (US9 App 接口) | 6 |
| Phase 12 (Polish) | 3 |
| 可并行任务 | 32 (标记 [P]) |

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- TDD 必须严格执行：先写测试（红灯）→ 实现（绿灯）→ 重构
- Go 参考文件路径见 quickstart.md 中的"关键参考文件"表格
- 每个 Checkpoint 后运行 `bun test` 确认无回归
