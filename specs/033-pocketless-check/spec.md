# Feature Specification: PocketLess 功能完全对齐

**Feature Branch**: `033-pocketless-check`  
**Created**: 2026-02-11  
**Status**: Draft  
**Input**: User description: "当前的 pocketless 里已经使用 bun.js + hono 实现了 go pocketbase 里大部分的功能, 但还有很多功能实现没有对齐(包括plugins, migrations 等), 现在通过新一轮的 speckit 来完成能力的完全对齐"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Record 访问规则强制执行 (Priority: P1)

作为 pocketless 应用开发者，我需要在 API 层面强制执行集合的 `listRule`/`viewRule`/`createRule`/`updateRule`/`deleteRule` 访问控制规则，确保未授权用户无法访问或修改受保护数据。

**Why this priority**: 这是安全关键功能。没有权限过滤，所有数据对所有客户端完全开放，无法在生产环境使用。Go PocketBase 的 `core/db_permission_filter.go`（10.8KB）实现了完整的权限过滤逻辑，pocketless 完全缺失。

**Independent Test**: 创建一个带 `listRule = "@request.auth.id != ''"` 的集合，验证未认证用户返回 403/空列表、已认证用户返回正确数据。

**Acceptance Scenarios**:

1. **Given** 集合 `posts` 的 `listRule` 设置为 `@request.auth.id != ''`，**When** 未认证用户请求 `GET /api/collections/posts/records`，**Then** 返回 403 或空结果集
2. **Given** 集合 `posts` 的 `viewRule` 设置为 `@request.auth.id = author`，**When** 非作者用户请求某条记录，**Then** 返回 404
3. **Given** 集合 `posts` 的 `createRule` 为空字符串（表示需认证），**When** 未认证用户 POST 创建记录，**Then** 返回 403
4. **Given** `listRule` 为 `null`（Admin only），**When** 普通用户请求列表，**Then** 返回 403
5. **Given** `listRule` 为 `""`（空字符串，任何人可访问），**When** 未认证用户请求列表，**Then** 正常返回数据

---

### User Story 2 - 集合验证与自动表同步 (Priority: P1)

作为 pocketless 应用开发者，我需要在创建或更新集合时执行完整验证（字段名唯一性、系统字段保护、循环关系检测等），并且集合结构变更后自动同步底层数据库表结构。

**Why this priority**: 没有集合验证，用户可以创建无效的集合定义（如重名字段、修改系统字段），导致数据损坏。没有表同步，集合字段变更后数据库表结构不一致，导致运行时错误。Go 版 `core/collection_validate.go`（20KB）和 `core/collection_record_table_sync.go`（12KB）实现了这两个功能。

**Independent Test**: 尝试创建带重复字段名的集合，验证返回验证错误；添加新字段后验证 DB 表自动增加了对应列。

**Acceptance Scenarios**:

1. **Given** 创建集合时包含两个同名字段，**When** 提交创建请求，**Then** 返回验证错误
2. **Given** 试图删除系统字段（如 `id`/`created`/`updated`），**When** 提交更新请求，**Then** 返回保护错误
3. **Given** 集合已存在记录，**When** 新增一个 text 字段，**Then** 底层表自动添加对应列，已有记录该字段值为默认值
4. **Given** 删除集合的一个字段，**When** 提交更新请求，**Then** 底层表自动删除对应列
5. **Given** 更改字段类型（如 text → number），**When** 提交更新请求，**Then** 系统拒绝不兼容的类型变更或执行安全迁移

---

### User Story 3 - 完整 Hook 事件体系 (Priority: P1)

作为 pocketless 应用开发者，我需要能通过 Hook 系统拦截所有关键操作（Settings 变更、文件下载、Realtime 连接、Batch 请求、Backup 操作等），以便实现自定义业务逻辑。

**Why this priority**: Hook 系统是 PocketBase 可扩展性的核心机制。当前缺失约 15 个 Hook（涵盖 Settings、Realtime、File、Batch、Backup、RecordEnrich 等），限制了开发者自定义行为的能力。

**Independent Test**: 注册一个 `onSettingsUpdateRequest` hook，验证更新 Settings 时 hook 被触发且能修改数据。

**Acceptance Scenarios**:

1. **Given** 注册了 `onSettingsListRequest` hook，**When** 请求 `GET /api/settings`，**Then** hook 被触发，可以修改响应
2. **Given** 注册了 `onRealtimeConnectRequest` hook，**When** 客户端建立 SSE 连接，**Then** hook 被触发，可以拒绝连接
3. **Given** 注册了 `onFileDownloadRequest` hook，**When** 请求文件下载，**Then** hook 被触发，可以修改文件路径或拒绝下载
4. **Given** 注册了 `onRecordEnrich` hook，**When** 记录被序列化为 JSON 响应，**Then** hook 被触发，可以添加/移除字段
5. **Given** 注册了 `onBackupCreate` hook，**When** 创建备份，**Then** hook 被触发

---

### User Story 4 - Realtime SSE 认证与权限过滤 (Priority: P2)

作为 pocketless 应用开发者，我需要 Realtime SSE 连接在订阅时验证认证 token，并在广播变更时根据集合的 `listRule`/`viewRule` 过滤可见记录，确保客户端只收到有权限查看的数据变更。

**Why this priority**: 当前 Realtime 广播不检查权限，任何客户端都能订阅并接收所有记录变更，存在数据泄露风险。

**Independent Test**: 以未认证客户端订阅一个需要认证才能查看的集合，验证不会收到变更通知。

**Acceptance Scenarios**:

1. **Given** 客户端未认证，集合 `viewRule` 为 `@request.auth.id != ''`，**When** 集合中创建新记录，**Then** 该客户端不收到变更通知
2. **Given** 客户端已认证为 user A，`viewRule` 为 `@request.auth.id = author`，**When** user B 的记录被修改，**Then** user A 不收到通知
3. **Given** SSE 连接携带 auth token，**When** 发送订阅请求，**Then** 系统验证 token 有效性
4. **Given** auth token 过期，**When** 集合中创建新记录，**Then** 该客户端不收到变更通知

---

### User Story 5 - View 集合支持 (Priority: P2)

作为 pocketless 应用开发者，我需要能创建 View 类型的集合（基于 SQL 查询），使其表现为只读虚拟集合，自动从查询结果推断字段结构。

**Why this priority**: View 集合是 PocketBase 的差异化特性之一，允许开发者创建复杂聚合查询作为只读 API 端点。Go 版 `core/view.go`（15KB）实现了完整逻辑。

**Independent Test**: 创建一个 View 集合 `SELECT COUNT(*) as total FROM posts`，验证通过 API 能正确查询该视图。

**Acceptance Scenarios**:

1. **Given** 定义 View 集合 `post_stats` 的查询为 `SELECT author, COUNT(*) as count FROM posts GROUP BY author`，**When** 请求 `GET /api/collections/post_stats/records`，**Then** 返回聚合结果
2. **Given** View 集合已创建，**When** 尝试 POST 创建记录，**Then** 返回 400 错误（只读）
3. **Given** View 查询中包含的字段类型，**When** 创建 View，**Then** 系统自动推断字段类型
4. **Given** View 依赖的源表结构变更，**When** 源集合字段被删除，**Then** View 集合标记为无效或自动更新

---

### User Story 6 - Error Hooks 与事务感知实例 (Priority: P2)

作为 pocketless 应用开发者，我需要 DB 操作失败时触发 Error hooks（如 `onModelAfterCreateError`），并且支持事务感知的 App 实例（TxApp），使事务内的所有操作共享同一事务上下文。

**Why this priority**: Error hooks 让开发者能对失败的操作进行补偿或日志记录。TxApp 确保复杂的多步操作（如创建记录+关联+文件）在同一事务中原子执行。

**Independent Test**: 在事务中创建记录时触发唯一约束冲突，验证 `onModelAfterCreateError` hook 被触发；在事务内创建多条记录，验证回滚时全部撤销。

**Acceptance Scenarios**:

1. **Given** 注册了 `onModelAfterCreateError` hook，**When** INSERT 操作因唯一约束冲突失败，**Then** hook 被触发且包含错误信息
2. **Given** 事务中创建 3 条记录，**When** 第 3 条失败，**Then** 前 2 条也被回滚
3. **Given** TxApp 实例内执行查询，**When** 查询在同一事务上下文中，**Then** 能看到事务内未提交的数据

---

### User Story 7 - 缺失工具模块补全 (Priority: P3)

作为 pocketless 应用开发者，我需要以下工具模块被实现：picker（JSON 字段筛选/修饰器）、dbutils（DB 索引解析/JSON helpers）、archive（备份压缩/解压）、logger（结构化日志），以支持完整的 PocketBase 功能栈。

**Why this priority**: 这些工具模块被多个上层模块依赖。picker 用于 record 序列化时的字段筛选；dbutils 用于集合 index 管理；archive 用于备份创建/恢复；logger 用于全局日志。

**Independent Test**: 使用 picker 从一个记录中提取指定字段子集，验证返回正确的字段。

**Acceptance Scenarios**:

1. **Given** 一个包含 10 个字段的记录，**When** 使用 picker 指定 `fields=title,author`，**Then** 返回仅包含 `id`、`title`、`author` 的对象
2. **Given** 需要创建备份，**When** 调用 archive.create()，**Then** 生成包含 DB 文件的 zip 包
3. **Given** 日志级别设为 `info`，**When** 记录 debug 级别日志，**Then** 不输出；记录 info 级别日志，**Then** 正常输出

---

### User Story 8 - CLI 命令实际执行逻辑 (Priority: P3)

作为 pocketless 应用开发者，我需要 `superuser` 和 `migrate` CLI 命令的实际执行逻辑被完整实现（当前标记为 `TODO: 实现（Phase 3）`），以便通过命令行管理超级用户和数据库迁移。

**Why this priority**: CLI 是运维的基本工具。当前 superuser 和 migrate 命令只打印消息但不执行任何操作。

**Independent Test**: 运行 `pocketless superuser create test@example.com password123`，验证 _superusers 表中创建了对应记录。

**Acceptance Scenarios**:

1. **Given** 运行 `superuser create email password`，**When** 命令执行完毕，**Then** _superusers 表中存在该记录
2. **Given** 运行 `superuser delete email`，**When** 命令执行完毕，**Then** _superusers 表中删除该记录
3. **Given** 运行 `migrate up`，**When** 有待执行的迁移，**Then** 按顺序执行所有迁移并记录到 _migrations 表
4. **Given** 运行 `migrate down`，**When** 有已执行的迁移，**Then** 回滚最后一个迁移
5. **Given** 运行 `migrate collections`，**When** 集合定义有变更，**Then** 自动生成迁移文件

---

### User Story 9 - App 核心接口补全 (Priority: P2)

作为 pocketless 应用开发者，我需要 App 接口补全以下能力：`newFilesystem()` / `newBackupsFilesystem()` / `newMailClient()` / `logger()` / `unsafeWithoutHooks()`，使 App 实例成为访问所有子系统的统一入口。

**Why this priority**: Go PocketBase 的 App 接口是所有功能的中心枢纽（70KB），pocketless 虽然有子系统实现（filesystem、mailer 等），但未集成到 App 接口中，导致开发者需要直接实例化底层组件。

**Independent Test**: 调用 `app.newFilesystem()` 返回根据 Settings 中 S3 配置自动创建的 Filesystem 实例。

**Acceptance Scenarios**:

1. **Given** Settings 中配置了 S3，**When** 调用 `app.newFilesystem()`，**Then** 返回 S3Filesystem 实例
2. **Given** Settings 中未配置 S3，**When** 调用 `app.newFilesystem()`，**Then** 返回 LocalFilesystem 实例
3. **Given** Settings 中配置了 SMTP，**When** 调用 `app.newMailClient()`，**Then** 返回配置好的 Mailer 实例
4. **Given** 调用 `app.unsafeWithoutHooks()`，**When** 通过返回的实例创建记录，**Then** 不触发任何 hook

---

### Edge Cases

- 权限规则中引用不存在的字段时应返回有意义的错误，而非崩溃
- 循环关系引用（集合 A 引用 B，B 引用 A）的验证和处理
- View 集合的查询语法错误时应返回清晰的错误信息
- 事务超时或死锁时的优雅处理和错误恢复
- 备份过程中有并发写入时的数据一致性保证
- CLI 命令在未初始化数据库时的友好提示
- Realtime SSE 连接在 token 刷新期间的连续性
- Hook 注册时的循环调用防护（hook A 触发 hook B，B 再触发 A）
- 大量订阅（>1000 个客户端）时的广播性能

## Requirements *(mandatory)*

### Functional Requirements

#### 安全与权限
- **FR-001**: System MUST 在 Record CRUD API 中强制执行集合的 `listRule`/`viewRule`/`createRule`/`updateRule`/`deleteRule` 访问规则
- **FR-002**: System MUST 支持权限规则中的 `@request.auth.*` 宏（引用当前认证用户的字段）
- **FR-003**: System MUST 在 Realtime SSE 广播时根据 `listRule`/`viewRule` 过滤可见记录

#### 集合管理
- **FR-004**: System MUST 在集合创建/更新时验证字段定义（名称唯一性、类型兼容性、系统字段保护）
- **FR-005**: System MUST 在集合结构变更后自动同步底层数据库表（增加/删除/重命名列）
- **FR-006**: System MUST 支持 View 类型集合（基于 SQL 查询的只读虚拟集合）
- **FR-007**: System MUST 对 View 集合自动推断字段类型并禁止写入操作

#### Hook 系统
- **FR-008**: System MUST 实现以下缺失的 hooks：`onSettingsListRequest`、`onSettingsUpdateRequest`、`onSettingsReload`、`onRealtimeConnectRequest`、`onRealtimeSubscribeRequest`、`onRealtimeMessageSend`、`onFileDownloadRequest`、`onFileTokenRequest`、`onBatchRequest`、`onBackupCreate`、`onBackupRestore`、`onRecordEnrich`
- **FR-009**: System MUST 在 DB 操作失败时触发对应的 Error hooks（`onModelAfterCreateError`、`onModelAfterUpdateError`、`onModelAfterDeleteError`、`onCollectionAfterCreateError`、`onCollectionAfterUpdateError`、`onCollectionAfterDeleteError`）
- **FR-010**: System MUST 在 Record CRUD Response 中调用 `onRecordEnrich` hook

#### 事务
- **FR-011**: System MUST 支持事务感知的 App 实例（TxApp），在事务内的所有操作共享同一事务上下文
- **FR-012**: System MUST 在事务失败时回滚所有变更

#### App 核心接口
- **FR-013**: App 接口 MUST 提供 `newFilesystem()` 方法，根据 Settings 配置返回正确的 Filesystem 实例
- **FR-014**: App 接口 MUST 提供 `newBackupsFilesystem()` 方法
- **FR-015**: App 接口 MUST 提供 `newMailClient()` 方法
- **FR-016**: App 接口 MUST 提供 `logger()` 方法
- **FR-017**: App 接口 MUST 提供 `unsafeWithoutHooks()` 方法，返回不触发 hooks 的浅拷贝

#### 工具模块
- **FR-018**: System MUST 实现 `tools/picker` 模块（JSON 字段筛选、excerpt 修饰器）
- **FR-019**: System MUST 实现 `tools/dbutils` 模块（索引解析、JSON 查询 helpers）
- **FR-020**: System MUST 实现 `tools/archive` 模块（zip 压缩/解压，用于备份）
- **FR-021**: System MUST 实现 `tools/logger` 模块（结构化日志，支持日志级别过滤）

#### CLI 命令
- **FR-022**: `superuser` 命令 MUST 实际执行 create/upsert/update/delete/otp 操作
- **FR-023**: `migrate` 命令 MUST 实际执行 up/down/create/collections/history-sync 操作

#### 字段解析修正
- **FR-024**: Record Field Resolver 的 `:changed` 修饰符 MUST 正确判断字段是否被修改（对比请求前后的值），而非始终返回 true
- **FR-025**: Record Field Resolver 的 `:isset` 修饰符 MUST 检查字段是否在请求 body 中存在，而非仅检查非空

### Key Entities

- **PermissionFilter**: 根据集合 Rule 和 RequestInfo 生成 SQL WHERE 条件的解析器
- **CollectionValidator**: 集合定义的验证器（字段名、类型、关系引用、系统字段保护）
- **RecordTableSync**: 集合变更 → DB DDL 同步器（ALTER TABLE ADD/DROP/RENAME COLUMN）
- **TxApp**: 事务感知的 App 实例，所有操作绑定到同一 DB 事务
- **ViewCollection**: View 类型集合的查询执行器和字段推断器
- **Picker**: JSON 字段筛选器，支持 fields 参数和 excerpt 修饰器

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 所有 Record CRUD 端点在有权限规则时，能正确拒绝未授权请求，100% 的权限场景通过测试
- **SC-002**: 集合创建/更新时的验证覆盖所有 Go PocketBase 验证项（字段名唯一、系统字段保护、循环关系等），验证通过率 100%
- **SC-003**: 集合字段变更后，底层数据库表在 1 秒内自动完成同步
- **SC-004**: 所有 27 个缺失的 hooks 在对应操作中被正确触发
- **SC-005**: View 集合能正确执行 SQL 查询并通过 List API 返回结果
- **SC-006**: TxApp 事务内多步操作在失败时 100% 回滚
- **SC-007**: `superuser` 和 `migrate` CLI 命令的所有子命令能正确执行并影响数据库
- **SC-008**: Realtime SSE 广播的权限过滤通过全部测试场景
- **SC-009**: Record Field Resolver 的 `:changed` 和 `:isset` 修饰符行为与 Go PocketBase 一致
- **SC-010**: 新增模块（picker/dbutils/archive/logger）的单元测试覆盖率 ≥ 90%
