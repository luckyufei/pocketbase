# Feature Specification: Pocketless — Bun.js + Hono 版 PocketBase

**Feature Branch**: `032-pocketless`  
**Created**: 2026-02-10  
**Status**: Draft  
**Input**: 使用 Bun.js + Hono + TypeScript 重新实现 PocketBase 的完整功能，100% 兼容 Go 版的 REST API、数据库表结构和 SDK

## 1. Problem Essence (核心问题)

### 1.1 当前问题

PocketBase 目前仅有 Go 语言实现，限制了它在 JavaScript/TypeScript 生态中的扩展性：

| 问题 | 影响 |
|------|------|
| 仅支持 Go 扩展 | JS/TS 开发者必须学习 Go 或使用受限的 Goja JS VM |
| Goja VM 受限 | 不支持完整 Node.js 生态，npm 包不可用 |
| 无法原生 TS 扩展 | 用户必须编译 Go 二进制文件来自定义行为 |
| 单一运行时 | 无法利用 Bun.js 生态和极速启动特性 |

### 1.2 目标

创建 Pocketless — 一个与 Go 版 PocketBase **100% 兼容**的 Bun.js 实现，使得：

- 同一数据库可被两个版本交替启动
- 同一 SDK（JS/Dart）可无缝连接任一版本
- 同一 Admin UI 可管理任一版本
- JS/TS 开发者可使用原生 `import` 扩展功能

### 1.3 核心约束

1. **API 100% 兼容** — 所有 REST API 路径、参数、响应体、状态码、错误格式必须与 Go 版完全一致
2. **表结构 100% 兼容** — 同一个数据库文件/PostgreSQL 实例可被两个版本交替使用
3. **SDK 100% 兼容** — JS SDK、Dart SDK 无需任何修改即可连接 Pocketless
4. **Admin UI 100% 兼容** — 共享同一个 `webui/` 构建产物
5. **双数据库支持** — SQLite (默认) + PostgreSQL，与 Go 版完全一致

---

## 2. User Scenarios & Testing *(mandatory)*

### User Story 1 - 核心骨架：启动并连接数据库 (Priority: P1)

作为 JS/TS 开发者，我希望能通过 `bun run serve` 或编译后的单二进制文件启动 Pocketless，它能自动初始化 SQLite 或 PostgreSQL 数据库（包括所有系统表），并在 `http://localhost:8090` 提供服务。

**Why this priority**: 这是所有功能的基础，没有数据库连接和服务启动，其他一切都无法工作。

**Independent Test**: 运行 `pocketless serve`，确认服务启动成功、系统表创建完成、`/api/health` 返回 200。

**Acceptance Scenarios**:

1. **Given** 一个空目录, **When** 运行 `pocketless serve`, **Then** 自动创建 `pb_data/data.db`（SQLite）和所有系统表（`_params`, `_collections`, `_migrations`, `_superusers`, `users` 等）
2. **Given** 设置 `--pg=postgres://...`, **When** 运行 `pocketless serve`, **Then** 连接 PostgreSQL 并创建所有系统表
3. **Given** Go 版已创建的 `pb_data/data.db`, **When** Pocketless 启动, **Then** 识别已有表结构，不重复创建，正常提供服务
4. **Given** CLI 传入 `--dir`, `--dev`, `--http` 等参数, **When** 启动, **Then** 参数生效（与 Go 版 CLI 完全一致）

---

### User Story 2 - Collection 与 Record CRUD (Priority: P1)

作为 API 使用者，我希望通过标准 REST API 管理 Collection（创建/修改/删除集合定义）和 Record（增删改查数据），且所有 API 行为与 Go 版完全一致。

**Why this priority**: CRUD 是 PocketBase 的核心功能，是所有上层特性（Auth、SSE、过滤等）的基础。

**Independent Test**: 使用 JS SDK 创建 Collection、写入 Record、查询列表，与 Go 版输出逐字对比。

**Acceptance Scenarios**:

1. **Given** 应用已启动, **When** `POST /api/collections` 创建一个 base 集合（含 text, number, bool 字段）, **Then** 响应体结构与 Go 版完全一致
2. **Given** 集合已创建, **When** `POST /api/collections/:col/records` 创建记录, **Then** 自动生成 15 字符 ID，响应含 `id`, `created`, `updated` 字段
3. **Given** 记录已存在, **When** `GET /api/collections/:col/records?filter=name='test'&&age>18&sort=-created&expand=author&fields=id,name`, **Then** 过滤、排序、展开、字段选择结果与 Go 版一致
4. **Given** 记录已存在, **When** `PATCH /api/collections/:col/records/:id` 使用字段修饰符（`field+`, `+field`, `field-`）, **Then** 追加/前置/移除行为正确
5. **Given** 不满足 API 规则的请求, **When** 访问被限制的资源, **Then** 返回 `{"code": 403, "message": "...", "data": {}}` 格式错误

---

### User Story 3 - 17 种字段类型 (Priority: P1)

作为 Collection 设计者，我希望 Pocketless 支持与 Go 版完全一致的 17 种字段类型（text, number, bool, email, url, editor, date, autodate, select, file, relation, json, password, geoPoint, secret, vector），每种类型的验证规则、数据库列类型和序列化行为都一致。

**Why this priority**: 字段系统决定了数据模型的能力，是 Collection 和 Record 的核心。

**Independent Test**: 创建包含所有 17 种字段的集合，写入和读取数据，验证类型转换和验证行为。

**Acceptance Scenarios**:

1. **Given** 创建含 `text` 字段的集合, **When** SQLite 模式, **Then** 列类型为 `TEXT DEFAULT ''`; PostgreSQL 模式为 `TEXT DEFAULT ''`
2. **Given** 创建含 `json` 字段的集合, **When** SQLite 模式, **Then** 列类型为 `JSON DEFAULT NULL`; PostgreSQL 模式为 `JSONB DEFAULT NULL`
3. **Given** 创建含 `relation` 字段（多值）的集合, **When** 写入关联 ID 数组, **Then** 存储为 JSON 数组，Expand 时返回完整关联记录
4. **Given** 创建含 `password` 字段的集合, **When** 创建/更新记录, **Then** 密码被 bcrypt 哈希存储，API 响应中不返回密码值
5. **Given** 创建含 `file` 字段的集合, **When** 上传文件, **Then** 文件存储路径为 `pb_data/storage/{collectionId}/{recordId}/{filename}`
6. **Given** 创建含 `autodate` 字段的集合, **When** 创建记录, **Then** 自动填充当前时间

---

### User Story 4 - 搜索/过滤引擎 (Priority: P1)

作为 API 使用者，我希望使用与 Go 版完全一致的过滤语法查询数据，包括所有运算符、逻辑操作、特殊标识符、修饰符、日期宏和函数。

**Why this priority**: 过滤引擎是 Record 列表查询的核心，涉及将用户表达式解析为 SQL WHERE 子句，复杂度高且必须 100% 兼容。

**Independent Test**: 使用 Go 版集成测试中的所有 filter 表达式，验证 Pocketless 返回相同结果。

**Acceptance Scenarios**:

1. **Given** 标准运算符, **When** `filter=name='test'&&age>=18`, **Then** 返回正确结果
2. **Given** Any 变体运算符, **When** `filter=tags?='sports'`, **Then** JSON 数组中任一元素匹配
3. **Given** 特殊标识符, **When** `filter=@request.auth.id!=''&&@collection.posts.author=@request.auth.id`, **Then** 正确解析请求上下文和跨集合引用
4. **Given** 修饰符, **When** `filter=name:length>5&&tags:each~'a%'`, **Then** `:length`, `:each`, `:isset`, `:changed`, `:lower` 均正确
5. **Given** 日期宏, **When** `filter=created>=@todayStart&&created<=@now`, **Then** 宏替换为正确的时间值
6. **Given** 函数, **When** `filter=geoDistance(lon,lat,116.4,39.9)<10`, **Then** Haversine 距离计算正确

---

### User Story 5 - 完整认证系统 (Priority: P1)

作为应用用户，我希望 Pocketless 支持与 Go 版完全一致的 5 种认证方式（密码、OAuth2、OTP、MFA、Impersonation），以及完整的邮箱验证、密码重置、邮箱变更流程。

**Why this priority**: 认证是 Auth 集合的核心功能，也是绝大多数应用的必需。

**Independent Test**: 使用 JS SDK 完成各种认证流程，验证 Token 格式和 Claims 与 Go 版一致。

**Acceptance Scenarios**:

1. **Given** Auth 集合已启用密码认证, **When** `POST /api/collections/users/auth-with-password` 提供 identity+password, **Then** 返回 `{token, record}` 且 JWT 包含 `id, type, collectionId, refreshable` Claims
2. **Given** Auth 集合已启用 OAuth2, **When** 执行 OAuth2 流程 (Google/GitHub/Apple 等), **Then** 创建或关联用户，返回 Token
3. **Given** Auth 集合已启用 OTP, **When** `POST /api/collections/users/request-otp` 后使用 OTP 登录, **Then** 成功认证
4. **Given** MFA 已启用, **When** 第一步认证通过, **Then** 返回 `mfaId`，需完成第二步认证
5. **Given** Superuser 已登录, **When** `POST /api/collections/users/impersonate/:id`, **Then** 返回目标用户的 Token
6. **Given** Token 签名密钥 = `record.tokenKey + collection.secret`, **When** 验证 Token, **Then** 5 种 Token 类型（auth, file, verification, passwordReset, emailChange）的签名均正确

---

### User Story 6 - 实时订阅 (SSE) (Priority: P1)

作为实时应用开发者，我希望通过 SSE 订阅 Collection/Record 的变更事件，广播行为与 Go 版一致。

**Why this priority**: 实时订阅是 PocketBase 的核心卖点之一，SDK 依赖此功能。

**Independent Test**: 使用 JS SDK 的 `subscribe()` 订阅变更，Go 版和 Bun 版交替写入数据，验证事件格式一致。

**Acceptance Scenarios**:

1. **Given** 客户端 `GET /api/realtime`, **When** 连接建立, **Then** 返回 SSE 流，首个事件包含 `clientId`
2. **Given** 客户端已订阅 `posts/*`, **When** 创建/更新/删除 posts 记录, **Then** 收到 `{action, record}` 事件
3. **Given** 客户端已订阅 `posts/abc123`, **When** 该特定记录更新, **Then** 仅收到该记录的事件
4. **Given** 记录有 ViewRule 限制, **When** 未授权客户端订阅, **Then** 不接收到该记录的事件
5. **Given** 5 分钟内无消息, **When** 超时触发, **Then** 连接自动断开，客户端可重连

---

### User Story 7 - 文件系统与 Backup (Priority: P1)

作为应用管理者，我希望 Pocketless 支持文件上传/下载/缩略图生成（本地和 S3），以及数据库备份/恢复功能。

**Why this priority**: 文件管理和备份是生产环境的基本需求。

**Independent Test**: 上传文件、请求缩略图、创建备份、恢复备份，验证行为一致。

**Acceptance Scenarios**:

1. **Given** 记录含 file 字段, **When** multipart 上传文件, **Then** 文件存储到 `pb_data/storage/` 或 S3
2. **Given** 文件已上传, **When** `GET /api/files/:col/:recordId/:filename?thumb=100x100`, **Then** 返回缩略图
3. **Given** 缩略图格式 `WxH`, `WxHt`, `WxHb`, `WxHf`, `0xH`, `Wx0`, **When** 请求各种格式, **Then** 裁剪行为与 Go 版一致
4. **Given** Superuser 已登录, **When** `POST /api/backups`, **Then** 创建完整数据库备份
5. **Given** 备份已创建, **When** `POST /api/backups/:key/restore`, **Then** 数据库恢复到备份状态

---

### User Story 8 - Hook/事件系统 (Priority: P1)

作为 Pocketless 扩展开发者，我希望通过 80+ Hook 拦截所有操作（创建/更新/删除/认证/请求等），Hook 行为（洋葱模型、优先级、标签过滤、三层代理）与 Go 版完全一致。

**Why this priority**: Hook 系统是 PocketBase 的扩展基石，所有插件和自定义逻辑都依赖它。

**Independent Test**: 注册 Hook 拦截 Record 创建，验证 `e.next()` 链式调用、优先级排序、TaggedHook 按集合过滤行为。

**Acceptance Scenarios**:

1. **Given** 注册 `onRecordCreate("users")` Hook, **When** 创建 users 记录, **Then** Hook 触发; 创建 posts 记录, **Then** Hook 不触发
2. **Given** 多个 Hook 注册不同优先级, **When** 触发事件, **Then** 按优先级升序执行
3. **Given** Hook 中不调用 `e.next()`, **When** 触发事件, **Then** 后续 Handler 不执行（短路）
4. **Given** `onModelCreate` Hook, **When** 创建 Record, **Then** 自动代理到 `onRecordCreate`; 创建 Collection, **Then** 自动代理到 `onCollectionCreate`

---

### User Story 9 - 中间件系统 (Priority: P1)

作为应用运维者，我希望 Pocketless 内置与 Go 版一致的中间件链（日志、异常恢复、速率限制、认证加载、安全头、Body 限制、CORS、Gzip）。

**Why this priority**: 中间件保障 API 的安全性和稳定性，是生产部署的必需。

**Independent Test**: 验证每个中间件的行为（速率限制返回 429、Body 超限返回 413、CORS 头正确等）。

**Acceptance Scenarios**:

1. **Given** Settings 中配置了速率限制, **When** 超过限额, **Then** 返回 429 状态码
2. **Given** 请求体超过 Body 限制, **When** 提交请求, **Then** 返回 413 状态码
3. **Given** 请求携带有效 Auth Token, **When** 中间件处理, **Then** `@request.auth` 填充正确用户信息
4. **Given** 跨域请求, **When** 发送 OPTIONS 预检, **Then** 返回正确 CORS 头

---

### User Story 10 - 迁移系统 (Priority: P1)

作为开发者，我希望 Pocketless 的迁移系统与 Go 版完全兼容——共享相同的 `_migrations` 表，支持 up/down/create 命令，系统迁移（12 个）全部对齐。

**Why this priority**: 迁移系统决定了数据库 schema 的初始化和升级，是 Go ↔ Bun 互操作的关键。

**Independent Test**: Go 版初始化的数据库可以被 Pocketless 启动，反之亦然，`_migrations` 表记录兼容。

**Acceptance Scenarios**:

1. **Given** 空数据库, **When** Pocketless 启动, **Then** 执行 12 个系统迁移，创建所有系统表
2. **Given** Go 版已运行过的数据库, **When** Pocketless 启动, **Then** 识别已执行的迁移，不重复执行
3. **Given** `pocketless migrate create "add_tags"`, **When** 执行, **Then** 在 `pb_migrations/` 创建迁移文件
4. **Given** 迁移文件中包含 SQLite 和 PostgreSQL 分支 DDL, **When** 在不同数据库执行, **Then** 使用对应分支

---

### User Story 11 - 插件系统 (Priority: P2)

作为 Pocketless 扩展开发者，我希望所有 9 个插件（secrets, jobs, gateway, kv, analytics, metrics, trace, processman, ghupdate）与 Go 版功能完全一致，遵循统一的 `register(app, config)` 注册模式。

**Why this priority**: 插件功能依赖核心层稳定后才能实现，但对完整功能对齐至关重要。

**Independent Test**: 逐个启用插件，验证 API 路由、数据表、Hook 注册行为与 Go 版一致。

**Acceptance Scenarios**:

1. **Given** 未注册任何插件, **When** 启动 Pocketless, **Then** 零插件开销，插件相关路由返回 404
2. **Given** 注册 secrets 插件, **When** 启动, **Then** 自动创建 `_secrets` 表，AES-256-GCM 加解密与 Go 版互通
3. **Given** 注册 jobs 插件, **When** 入队任务, **Then** 任务执行、重试、崩溃恢复行为一致
4. **Given** 注册 gateway 插件, **When** 配置代理规则, **Then** 请求转发、熔断、限流行为一致
5. **Given** 注册 kv 插件, **When** 设置/获取键值, **Then** L1 缓存 + L2 数据库行为一致
6. **Given** 注册 analytics 插件, **When** 采集事件, **Then** 事件缓冲、HLL 去重、聚合逻辑一致
7. **Given** Go 版 secrets 插件写入的加密数据, **When** Pocketless 读取, **Then** 能正确解密（AES-256-GCM 兼容）

---

### User Story 12 - Batch API (Priority: P2)

作为 API 使用者，我希望通过 `POST /api/batch` 在单个请求中执行多个 API 操作（事务性），行为与 Go 版完全一致。

**Why this priority**: Batch API 是高级功能，依赖核心 CRUD 已稳定。

**Independent Test**: 构造包含多个 CRUD 操作的 Batch 请求，验证事务性（全成功或全失败）。

**Acceptance Scenarios**:

1. **Given** Batch 请求包含 3 个创建操作, **When** 全部成功, **Then** 返回 3 个响应，所有记录已创建
2. **Given** Batch 请求包含 3 个操作（第 3 个失败）, **When** 处理, **Then** 事务回滚，前 2 个也不生效
3. **Given** Batch 请求超过 Settings 中 `batch.maxRequests` 限制, **When** 提交, **Then** 返回 400 错误

---

### User Story 13 - 日志与 Cron (Priority: P2)

作为运维人员，我希望 Pocketless 的请求日志系统（辅助数据库）和 Cron 调度与 Go 版完全一致。

**Why this priority**: 日志和 Cron 是运维监控的基本需求。

**Independent Test**: 发送请求后查询 `/api/logs`，注册 Cron 任务后验证定时执行。

**Acceptance Scenarios**:

1. **Given** 请求处理完成, **When** 查询 `/api/logs`, **Then** 日志记录存储在辅助数据库 `_logs` 表
2. **Given** 注册 Cron 任务 `0 */5 * * *`, **When** 触发时间到达, **Then** 任务自动执行
3. **Given** Superuser 访问 `/api/crons`, **When** 查询, **Then** 返回所有注册的 Cron 列表
4. **Given** Superuser `POST /api/crons/:jobId`, **When** 手动触发, **Then** 立即执行

---

### User Story 14 - Settings 管理 (Priority: P2)

作为管理员，我希望通过 API 和 Admin UI 管理 Pocketless 的设置（SMTP、S3、速率限制等），存储位置和格式与 Go 版完全一致。

**Why this priority**: Settings 控制全局行为，是其他功能（邮件、文件存储、速率限制）的前提。

**Independent Test**: 通过 API 读写 Settings，验证序列化格式与 Go 版 `_params` 表中的记录一致。

**Acceptance Scenarios**:

1. **Given** Superuser 已登录, **When** `GET /api/settings`, **Then** 返回完整设置（敏感字段如 password/secret 被 mask）
2. **Given** Superuser `PATCH /api/settings`, **When** 更新 SMTP 配置, **Then** 持久化到 `_params` 表，key=`settings`
3. **Given** 设置了 S3 存储, **When** `POST /api/settings/test/s3`, **Then** 测试 S3 连通性

---

### User Story 15 - Admin UI 嵌入 (Priority: P2)

作为管理员，我希望访问 Pocketless 的 `/_/` 路径时看到与 Go 版完全一致的 Admin UI。

**Why this priority**: Admin UI 是管理 PocketBase/Pocketless 的标准方式。

**Independent Test**: 访问 `http://localhost:8090/_/`，验证 Admin UI 加载成功并能执行所有管理操作。

**Acceptance Scenarios**:

1. **Given** 服务已启动, **When** 访问 `http://localhost:8090/_/`, **Then** 返回 React Admin UI
2. **Given** Admin UI 构建产物在 `webui/dist/`, **When** Pocketless 编译, **Then** 静态文件嵌入到二进制中

---

### User Story 16 - 单二进制编译与部署 (Priority: P2)

作为部署工程师，我希望通过 `bun build --compile` 将 Pocketless 编译为单个可执行文件，与 Go 版具有相同的部署简便性。

**Why this priority**: 单二进制部署是 PocketBase 的核心卖点。

**Independent Test**: 执行 `bun build --compile`，运行产出的二进制文件，验证功能完整。

**Acceptance Scenarios**:

1. **Given** Pocketless 源码, **When** `bun build --compile --target=bun-linux-x64`, **Then** 生成单个可执行文件
2. **Given** 编译产物, **When** 在无 Bun 运行时的机器上执行, **Then** 服务正常启动
3. **Given** 编译产物包含嵌入的 Admin UI, **When** 访问 `/_/`, **Then** UI 正常加载

---

### User Story 17 - Go ↔ Bun 数据库互操作 (Priority: P1)

作为系统管理员，我希望同一个数据库可以被 Go 版 PocketBase 和 Pocketless 交替启动，数据完全互通。

**Why this priority**: 这是"100% 兼容"约束的终极验证。

**Independent Test**: Go 版写入数据 → Pocketless 读取并验证 → Pocketless 写入 → Go 版读取并验证。

**Acceptance Scenarios**:

1. **Given** Go 版创建了 Collection 和 Record, **When** Pocketless 启动同一数据库, **Then** 所有数据完整可用
2. **Given** Pocketless 创建了 Collection 和 Record, **When** Go 版启动同一数据库, **Then** 所有数据完整可用
3. **Given** Go 版 secrets 插件加密的数据, **When** Pocketless 读取, **Then** AES-256-GCM 解密成功
4. **Given** 两个版本共享同一个 `_migrations` 表, **When** 交替启动, **Then** 迁移状态一致、无冲突

---

### Edge Cases

- Go 版使用了 Pocketless 尚未支持的特性时，如何优雅降级或报错？
- SQLite WAL 模式下，两个版本能否同时连接同一数据库？（答：不可以，一次只启动一个）
- PostgreSQL 模式下，两个版本是否可以同时连接？（答：可以，但不推荐同时写入）
- 加密的 Settings（使用 `encryptionEnv`）两个版本算法是否完全一致？（答：必须一致，AES-256-GCM，相同的密钥派生方式）
- Token 在两个版本间是否互通？（答：是的，相同签名算法 HS256，相同密钥结构 `tokenKey + secret`）
- 超大 JSON 字段在 SQLite (JSON) 和 PostgreSQL (JSONB) 之间的行为差异如何处理？（答：通过 DBAdapter 抽象统一）

### 与 Go 版的关键差异点

以下差异是架构层面的有意选择，不影响 API 和数据兼容性：

| 差异点 | Go 版 | Pocketless (Bun.js) | 影响 |
|--------|-------|---------------------|------|
| JS VM 插件 | Goja (jsvm) 插件 | **不需要**，原生 TS | 去除整个 `plugins/jsvm/` 目录 |
| 并发模型 | Goroutine + Channel | async/await + 可选 Worker | Bun 单线程事件循环 |
| SQLite 连接池 | 双连接 (concurrent/nonconcurrent) | 单实例 + 写 Mutex | `bun:sqlite` 是同步 API |
| 构建产物 | Go 静态二进制 | `bun build --compile` 单二进制 | 都是单文件分发 |
| 扩展方式 | Go 编译 + jsvm JS 脚本 | `import` TS 模块 | 更简单直接 |
| 文件嵌入 | `embed.FS` | Bun 静态路由 | Admin UI 嵌入方式不同 |
| DB 查询构建器 | `pocketbase/dbx` | Kysely 封装层 | 上层 API 保持兼容 |
| 加密实现 | `crypto/aes` | `node:crypto` | 算法一致 (AES-256-GCM) |
| 平台特有代码 | 编译标签 (`_unix.go`, `_windows.go`) | 运行时条件分支 | 合并为单文件 |

### Assumptions

1. Pocketless 与 Go 版不会同时启动连接同一个 SQLite 数据库
2. `bun:sqlite` 的 WAL 模式行为与 Go 版 `modernc.org/sqlite` 一致
3. Bun.js 的 `Bun.password` bcrypt 输出与 Go `bcrypt` 库兼容
4. Bun.js 的 `node:crypto` AES-256-GCM 实现与 Go `crypto/aes` 兼容
5. OAuth2 提供商的 API 接口在两个版本实现期间不发生重大变更
6. Admin UI (`webui/dist/`) 构建产物不依赖特定后端版本
7. 所有 17 种字段类型在 TypeScript 中的序列化/反序列化行为可以与 Go 版完全对齐
8. Go 版的 `routine.FireAndForget()` 在 Bun 中用 `queueMicrotask()` 或 `setTimeout()` 替代
9. Kysely 的方言插件能完整覆盖 Go 版 `dbx` 的查询模式，特殊情况使用 raw SQL fallback

---

## 3. Requirements *(mandatory)*

### Functional Requirements

| ID | Requirement | Priority | User Story |
|----|-------------|----------|------------|
| **核心层** | | | |
| FR-001 | 提供 `App` TypeScript 接口，方法组与 Go 版 `core.App` 完全一致 | P1 | US1 |
| FR-002 | 提供 `BaseApp` 实现，包含双数据库连接池（主+辅助）、80+ Hook 实例、Store、Cron、SubscriptionsBroker | P1 | US1, US8 |
| FR-003 | 支持 SQLite 模式（`bun:sqlite`），WAL 模式 + 写入 Mutex，PRAGMA 配置与 Go 版一致 | P1 | US1 |
| FR-004 | 支持 PostgreSQL 模式（`Bun.SQL`），连接池 max=25，自动初始化 pgcrypto/pg_trgm 扩展 | P1 | US1 |
| FR-005 | 提供 `DBAdapter` 接口抽象 SQLite/PostgreSQL 差异（类型转换、JSON 函数、Collation、错误检测） | P1 | US1 |
| FR-006 | 基于 Kysely 提供 QueryBuilder 封装，API 与 Go 版 `dbx` 兼容 | P1 | US1, US2 |
| **模型系统** | | | |
| FR-007 | 提供 `BaseModel`，ID 生成规则为 15 字符随机字符串 | P1 | US2 |
| FR-008 | 提供 `Collection` 模型，支持三种类型（base/auth/view），完整 API 规则、Auth 选项、View 选项 | P1 | US2 |
| FR-009 | 提供 `Record` 模型，动态字段访问、字段修饰符（`field+`, `+field`, `field-`）、Auth 专用方法 | P1 | US2 |
| FR-010 | 提供 17 种字段类型，每种的 `columnType()`, `prepareValue()`, `validateValue()` 在 SQLite 和 PostgreSQL 模式下均正确 | P1 | US3 |
| FR-011 | 字段系统使用自注册模式（`registerField()`） | P1 | US3 |
| **Hook 系统** | | | |
| FR-012 | 实现 `Hook<T>` 反向链式调用（洋葱模型），Handler 必须调用 `e.next()` 继续链 | P1 | US8 |
| FR-013 | 实现 `TaggedHook<T>` 按 Collection 名称/ID 过滤 | P1 | US8 |
| FR-014 | 实现三层代理模式：OnModelCreate → OnRecordCreate / OnCollectionCreate | P1 | US8 |
| FR-015 | 支持 Handler 优先级排序和 ID 绑定/解绑 | P1 | US8 |
| **API 层** | | | |
| FR-016 | 实现所有 40+ REST API 端点，路径、方法、参数与 Go 版完全一致 | P1 | US2, US5 |
| FR-017 | 错误响应格式统一为 `{"code": N, "message": "...", "data": {...}}` | P1 | US2 |
| FR-018 | 实现 Record CRUD（含分页、排序、过滤、展开、字段选择、skipTotal） | P1 | US2 |
| FR-019 | 实现 Collection CRUD（含导入、截断） | P1 | US2 |
| FR-020 | 实现 Batch API，支持事务性多操作 | P2 | US12 |
| **认证** | | | |
| FR-021 | 实现 5 种认证流程（密码、OAuth2、OTP、MFA、Impersonation） | P1 | US5 |
| FR-022 | 实现 5 种 Token 类型，签名密钥结构 = `record.tokenKey + collection.secret`，算法 HS256 | P1 | US5 |
| FR-023 | 实现邮箱验证、密码重置、邮箱变更流程 | P1 | US5 |
| FR-024 | 支持 35+ OAuth2 提供商（使用 arctic 库） | P1 | US5 |
| **搜索/过滤** | | | |
| FR-025 | 移植 Go 版 `fexpr` 解析器到 TypeScript，100% 语法兼容 | P1 | US4 |
| FR-026 | 支持所有运算符（8 标准 + 8 Any 变体）和逻辑操作（&&, \|\|, ()） | P1 | US4 |
| FR-027 | 支持所有特殊标识符（@request.*, @collection.*） | P1 | US4 |
| FR-028 | 支持所有修饰符（:isset, :changed, :length, :each, :lower） | P1 | US4 |
| FR-029 | 支持所有日期宏（@now, @yesterday 等 17 个） | P1 | US4 |
| FR-030 | 支持函数（geoDistance, strftime） | P1 | US4 |
| FR-031 | 实现 `RecordFieldResolver`，支持关联查询自动 JOIN | P1 | US4 |
| **实时订阅** | | | |
| FR-032 | 实现 SSE 连接（GET /api/realtime）和订阅管理（POST /api/realtime） | P1 | US6 |
| FR-033 | 实现分块广播（150/chunk）、权限检查、dry-cache 删除模式 | P1 | US6 |
| FR-034 | 实现 5 分钟空闲超时自动断开 | P1 | US6 |
| **文件系统** | | | |
| FR-035 | 实现 LocalFilesystem（`pb_data/storage/`）和 S3Filesystem | P1 | US7 |
| FR-036 | 实现缩略图生成（WxH, WxHt, WxHb, WxHf, 0xH, Wx0） | P1 | US7 |
| FR-037 | 实现备份创建/下载/删除/恢复 | P1 | US7 |
| **中间件** | | | |
| FR-038 | 实现 10 个核心中间件（activityLogger, panicRecover, rateLimit, loadAuthToken, securityHeaders, bodyLimit, requireAuth, requireSuperuserAuth, cors, gzip） | P1 | US9 |
| **迁移** | | | |
| FR-039 | 实现迁移运行器，支持 up/down/create 命令 | P1 | US10 |
| FR-040 | 实现 12 个系统迁移，SQLite 和 PostgreSQL DDL 均对齐 Go 版 | P1 | US10 |
| FR-041 | `_migrations` 表记录格式与 Go 版兼容 | P1 | US10 |
| **CLI** | | | |
| FR-042 | 实现 CLI 命令：serve, superuser, migrate | P1 | US1 |
| FR-043 | 全局标志与 Go 版一致：--dir, --dev, --pg, --encryptionEnv, --queryTimeout 等 | P1 | US1 |
| **插件** | | | |
| FR-044 | 实现 secrets 插件（AES-256-GCM 加解密与 Go 版互通） | P2 | US11 |
| FR-045 | 实现 jobs 插件（任务队列、Worker、重试、崩溃恢复） | P2 | US11 |
| FR-046 | 实现 gateway 插件（代理转发、熔断、限流） | P2 | US11 |
| FR-047 | 实现 kv 插件（L1 缓存 + L2 数据库） | P2 | US11 |
| FR-048 | 实现 analytics 插件（事件采集、HLL 去重、聚合） | P2 | US11 |
| FR-049 | 实现 metrics 插件（CPU/内存/Goroutine/延迟/5xx 采集） | P2 | US11 |
| FR-050 | 实现 trace 插件（分布式追踪、染色、过滤器） | P2 | US11 |
| FR-051 | 实现 processman 插件（进程管理） | P2 | US11 |
| FR-052 | 实现 migratecmd 插件（迁移 CLI 命令、自动迁移） | P2 | US11 |
| **Settings** | | | |
| FR-053 | Settings 存储在 `_params` 表 key=`settings`，结构与 Go 版完全一致 | P2 | US14 |
| FR-054 | 敏感字段（password, secret）在 API 响应中 mask | P2 | US14 |
| **Admin UI** | | | |
| FR-055 | 嵌入 `webui/dist/` 构建产物，通过 `/_/` 路径提供 Browser Router 模式 SPA | P2 | US15 |
| **编译部署** | | | |
| FR-056 | 支持 `bun build --compile` 生成单二进制文件 | P2 | US16 |
| **互操作** | | | |
| FR-057 | Go 版创建的数据库可被 Pocketless 无损启动 | P1 | US17 |
| FR-058 | Pocketless 创建的数据库可被 Go 版无损启动 | P1 | US17 |
| FR-059 | 加密数据（Settings、secrets 插件）在两个版本间互通 | P1 | US17 |

### Key Entities

- **App**: 核心接口，定义所有方法契约（生命周期、配置、数据库、CRUD、Hook 等）
- **BaseApp**: App 接口的默认实现，管理双数据库连接、80+ Hook、Store、Cron、SubscriptionsBroker
- **Collection**: 集合定义（base/auth/view 三种类型），包含字段列表和 API 规则
- **Record**: 数据记录，动态关联 Collection 的字段定义，支持 Auth 专用能力
- **Field**: 字段类型抽象（17 种实现），定义列类型、值准备、验证逻辑
- **Hook/TaggedHook**: 事件钩子系统，反向链式调用（洋葱模型）
- **DBAdapter**: 数据库适配器接口，抽象 SQLite/PostgreSQL 差异
- **QueryBuilder**: 查询构建器，基于 Kysely 封装的 dbx 兼容 API
- **Settings**: 全局配置模型，存储在 `_params` 表

---

## 4. Non-Functional Requirements

| ID | Requirement | Metric |
|----|-------------|--------|
| NFR-001 | API 响应格式与 Go 版逐字段一致（JSON key 名称、嵌套结构、错误格式） | 100% 兼容 |
| NFR-002 | 数据库表结构在 SQLite 和 PostgreSQL 模式下均与 Go 版完全一致 | 100% 兼容 |
| NFR-003 | Token 在两个版本间互通（相同签名算法和密钥结构） | 100% 互通 |
| NFR-004 | 加密数据在两个版本间互通（AES-256-GCM 兼容） | 100% 互通 |
| NFR-005 | 启动时间 ≤ Go 版 | ≤ 50ms |
| NFR-006 | 简单 CRUD 请求延迟与 Go 版可比 | ≤ 1.5x Go 版 |
| NFR-007 | `bun build --compile` 产物可在无 Bun 环境运行 | 单二进制 |
| NFR-008 | 非 UI 代码测试覆盖率 | ≥ 95% |
| NFR-009 | `src/` 目录结构与 Go 版保持一致，文件名一一对应（`.go` → `.ts`） | ~350 个文件 |
| NFR-010 | 不注册插件时零开销 | 0 额外内存 |

---

## 5. Success Criteria *(mandatory)*

### Measurable Outcomes

| ID | Metric | Target | Measurement |
|----|--------|--------|-------------|
| SC-001 | JS SDK 连接 Pocketless 执行全套 CRUD 操作 | 100% 通过 | JS SDK 集成测试 |
| SC-002 | Go 版集成测试的 API 路径、请求体、响应体用于 Pocketless | ≥ 95% 通过 | 交叉兼容测试 |
| SC-003 | Go 版数据库被 Pocketless 启动后数据完整可用 | 100% | 互操作测试 |
| SC-004 | Pocketless 数据库被 Go 版启动后数据完整可用 | 100% | 互操作测试 |
| SC-005 | 所有 40+ API 端点响应格式与 Go 版一致 | 100% | 自动化对比测试 |
| SC-006 | 所有 17 种字段类型在 SQLite 和 PostgreSQL 下行为一致 | 100% | 字段类型测试 |
| SC-007 | 5 种 Token 类型在两个版本间互通 | 100% | Token 互通测试 |
| SC-008 | 过滤表达式解析结果与 Go 版 fexpr 一致 | 100% | fexpr 测试用例移植 |
| SC-009 | Admin UI 通过 Pocketless 正常加载并可执行管理操作 | 100% | E2E UI 测试 |
| SC-010 | `bun build --compile` 单二进制部署成功 | 可执行 | 部署测试 |

### Testing Strategy

| 层次 | 框架 | 说明 |
|------|------|------|
| 单元测试 | `bun:test` | 每个模块独立测试，测试文件与源文件同目录（`xxx.test.ts`） |
| 集成测试 | `bun:test` + 真实 DB | SQLite 直连 + PostgreSQL Docker 容器，**禁止 Mock** |
| API 兼容性测试 | `bun:test` | 移植 Go 版 API 测试用例的请求/响应，逐端点验证 |
| 互操作测试 | `bun:test` | Go 版创建数据 → Pocketless 读取验证，反之亦然 |
| E2E 测试 | JS SDK | 用真实 SDK 连接 Pocketless 执行完整业务流程 |

**TDD 流程**: 先编写测试（红灯）→ 实现代码（绿灯）→ 重构。非 UI 代码覆盖率 ≥ 95%。

**PostgreSQL 测试**: 与 Go 版一致——禁止 Mock，必须连接真实数据库（Docker 容器自动启动）。

---

## 6. 技术选型总览

> 此部分为 spec 附加信息，完整技术细节见 `design.md`。

| 功能 | Go 版 | Pocketless 版 | 选型理由 |
|------|-------|---------------|---------|
| HTTP 框架 | `http.ServeMux` 自封装 | **Hono** | 轻量、类型安全、中间件生态 |
| SQLite | `modernc.org/sqlite` | **`bun:sqlite`** | Bun 内置，3-6x 性能优势 |
| PostgreSQL | `pgx/v5` | **`Bun.SQL`** | Bun 内置统一 SQL API |
| 查询构建器 | `dbx` | **Kysely** | 动态 schema 友好、多方言 |
| JWT | `golang-jwt/jwt` | **jose** | 标准 JOSE 库 |
| 密码哈希 | `bcrypt` | **`Bun.password`** | Bun 原生 |
| 过滤表达式 | `fexpr` | **自实现移植** | 必须 100% 兼容 |
| OAuth2 | 自实现 35+ 提供商 | **arctic** | 轻量 OAuth2 库 |
| 邮件 | `net/smtp` | **nodemailer** | 成熟邮件库 |
| CLI | `cobra` | **Commander.js** | Node 生态标准 |

---

## 7. 实现路径概览

> 详细开发路线图见 `design.md` 第 23 节。

| Phase | 内容 | 预估周期 | 依赖 |
|-------|------|---------|------|
| Phase 1 | 核心骨架：App、BaseApp、DB 适配器、Models、Fields、Hook、迁移、CLI | 4-6 周 | — |
| Phase 2 | API 层：CRUD、Auth、Search/Filter、SSE、File、Batch、中间件 | 4-6 周 | Phase 1 |
| Phase 3 | 插件：secrets、jobs、gateway、kv、analytics、metrics、trace 等 | 2-4 周 | Phase 2 |
| Phase 4 | 集成验证：SDK 测试、Admin UI、Go ↔ Bun 互操作、性能基准、单二进制打包 | 2-3 周 | Phase 3 |

---

## 8. Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| `bun:sqlite` 与 Go `modernc.org/sqlite` 行为差异 | 中 | 高 | 编写全面的 SQLite 兼容性测试集，覆盖 PRAGMA、类型转换、JSON 函数 |
| `Bun.password` bcrypt 输出与 Go `bcrypt` 不兼容 | 低 | 高 | 早期验证哈希互通性，必要时直接使用 `bcryptjs` 库 |
| fexpr 移植后存在语法差异 | 中 | 高 | 移植 Go 版 fexpr 完整测试用例，逐个验证 |
| OAuth2 提供商 API 变更频繁 | 低 | 中 | 使用 arctic 库统一管理，跟踪上游更新 |
| Kysely 不支持某些 Go 版 dbx 查询模式 | 中 | 中 | 对特殊查询使用 raw SQL fallback |
| Bun.js 版本更新导致 API breaking change | 低 | 中 | 锁定 Bun 主版本，渐进升级 |
| 单二进制编译后体积过大 | 中 | 低 | 使用 tree shaking、排除不需要的 npm 包 |
| SSE 在高并发下内存占用高 | 中 | 中 | 实现与 Go 版一致的分块广播和空闲超时机制 |

---

## 9. Open Questions

1. ~~Pocketless 是否需要支持 Goja JSVM 兼容模式？~~ → **否**，Bun 原生 TS 直接替代
2. Pocketless 的 npm 包发布策略（monorepo 还是单包）？
3. `bun build --compile` 对嵌入 Admin UI 静态文件的大小限制如何处理？
4. 是否需要支持 Bun 的 Worker 线程来模拟 Go 的 goroutine 并发？还是纯 async/await？

---

## 10. References

- 完整技术设计文档: `specs/032-pocketless/design.md`
- PocketBase 官方文档: `site/llm.txt.md`
- Bun.js 官方文档: `bun-llms.txt`
- Go 版架构规则: `ARCH_RULES.md`
- Go 版产品设计原则: `PM_RULES.md`
