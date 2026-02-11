# Tasks: Pocketless — Bun.js 版 PocketBase

**Input**: Design documents from `/specs/032-pocketless/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/pocketless-api.yaml, quickstart.md

**Tests**: Spec 要求 TDD 流程（NFR-008 ≥ 80% 覆盖率）。Phase 1-20 的测试集成在实现任务中；Phase 21-25 为测试补全阶段，对照 Go 版 `*_test.go` 1:1 移植所有 test case。

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `pocketless/src/` at repository root
- Tests co-located: `xxx.test.ts` alongside `xxx.ts`
- Shared test fixtures: `pocketless/tests/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization, dependency installation, basic tooling

- [x] T001 Create project directory structure: `pocketless/` with `src/core/`, `src/apis/`, `src/tools/`, `src/plugins/`, `src/migrations/`, `src/forms/`, `src/mails/`, `src/cmd/`, `tests/` per plan.md
- [x] T002 Initialize Bun project with `pocketless/package.json` (dependencies: hono, kysely, jose, arctic, croner, commander, zod, nodemailer, @aws-sdk/client-s3, sharp) and `pocketless/tsconfig.json`, `pocketless/bunfig.toml`
- [x] T003 [P] Create `pocketless/src/pocketless.ts` entry point with PocketLess class skeleton (constructor, start(), bootstrap() stubs)
- [x] T004 [P] Create `pocketless/src/core/app.ts` — App interface definition with all method signatures (lifecycle, config, DB, CRUD, hooks, store, cron, subscriptions)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T005 Implement Hook system in `pocketless/src/tools/hook/hook.ts` — Hook class with onion model (reverse chain), priority ordering, handler ID binding/unbinding
- [x] T006 [P] Implement TaggedHook in `pocketless/src/tools/hook/tagged_hook.ts` — tag-based filtering (collection name/ID), three-layer proxy (Model → Record/Collection)
- [x] T007 [P] Implement custom types in `pocketless/src/tools/types/` — `datetime.ts` (DateTime), `geo_point.ts` (GeoPoint), `json_array.ts` (JSONArray), `json_map.ts` (JSONMap), `json_raw.ts` (JSONRaw), `vector.ts` (Vector)
- [x] T008 [P] Implement security utilities in `pocketless/src/tools/security/` — `crypto.ts` (AES-256-GCM encrypt/decrypt with SHA256 key derivation, Go-compatible), `jwt.ts` (jose-based sign/verify for 5 token types), `random.ts` (15-char ID generation, random strings)
- [x] T009 [P] Implement concurrent-safe KV Store in `pocketless/src/tools/store/store.ts`
- [x] T010 Implement DBAdapter interface in `pocketless/src/core/db_adapter.ts` — type(), boolValue(), formatBool(), formatTime(), jsonExtract(), jsonArrayLength(), noCaseCollation(), isUniqueViolation(), isForeignKeyViolation()
- [x] T011 Implement SQLiteAdapter in `pocketless/src/core/db_adapter_sqlite.ts` — bun:sqlite wrapper with WAL mode, PRAGMA settings (busy_timeout=10000, foreign_keys=ON, cache_size=-16000, synchronous=NORMAL), write Mutex
- [x] T012 [P] Implement PostgresAdapter in `pocketless/src/core/db_adapter_postgres.ts` — Bun.SQL wrapper with connection pool (max=25, idleTimeout=300), pgcrypto/pg_trgm extension initialization
- [x] T013 Implement QueryBuilder in `pocketless/src/core/db_builder.ts` — Kysely-based wrapper with select/insert/update/deleteFrom/newQuery/transaction, dual-dialect support
- [x] T014 Implement BaseModel in `pocketless/src/core/base_model.ts` — id (15-char), created, updated fields, tableName(), isNew(), markAsNotNew()
- [x] T015 Implement Zod-based validation utilities in `pocketless/src/tools/validation/validation.ts` — common validators (email, URL, required, min/max length)

**Checkpoint**: Foundation ready — core DB access, Hook system, security, types all operational

---

## Phase 3: User Story 1 — 核心骨架：启动并连接数据库 (Priority: P1) 🎯 MVP

**Goal**: `pocketless serve` 启动服务 → 初始化数据库 → 创建系统表 → 健康检查返回 200

**Independent Test**: `bun run src/pocketless.ts serve` → 数据库文件创建 → `GET /api/health` 返回 200

### Implementation

- [x] T016 [US1] Implement BaseApp in `pocketless/src/core/base.ts` — implements App interface: dual DB connections (main + auxiliary), 80+ Hook instances, Store, Cron (croner), SubscriptionsBroker, Settings, bootstrap(), shutdown()
- [x] T017 [US1] Implement Collection model in `pocketless/src/core/collection_model.ts` — type (base/auth/view), name, system, fields, indexes, rules (list/view/create/update/delete), options, validate()
- [x] T018 [US1] Implement Record model in `pocketless/src/core/record_model.ts` — dynamic field access (get/set), field modifiers (field+, +field, field-), Auth-specific methods (email, password, verified, tokenKey), expand data
- [x] T019 [US1] Implement events system in `pocketless/src/core/events.ts` — all event types (BootstrapEvent, ServeEvent, ModelEvent, RecordEvent, CollectionEvent, etc.) with tagged hook support
- [x] T020 [US1] Implement 12 system migrations in `pocketless/src/migrations/` — one file per migration, dual-DB DDL (SQLite/PostgreSQL), creates: _params, _collections, _migrations, _superusers, users, _mfas, _otps, _externalAuths, _authOrigins, _logs (auxiliary)
- [x] T021 [US1] Implement migrations runner in `pocketless/src/core/migrations_runner.ts` — up/down execution, _migrations table record tracking (compatible with Go version format), skip already-applied
- [x] T022 [US1] Implement CLI framework in `pocketless/src/cmd/cmd.ts` — Commander.js setup with global flags (--dir, --dev, --pg, --encryptionEnv, --queryTimeout, --http)
- [x] T023 [US1] Implement `serve` command in `pocketless/src/cmd/serve.ts` — parse flags, create App, bootstrap, start HTTP server
- [x] T024 [US1] Implement `superuser` command in `pocketless/src/cmd/superuser.ts` — create/upsert/update/delete/otp subcommands
- [x] T025 [US1] Implement `migrate` command in `pocketless/src/cmd/migrate.ts` — up/down/create/collections/history-sync subcommands
- [x] T026 [US1] Implement health check endpoint in `pocketless/src/apis/health.ts` — `GET /api/health` → `{code: 200, message: "API is healthy.", data: {canBackup: bool}}`
- [x] T027 [US1] Implement HTTP serve in `pocketless/src/apis/serve.ts` — Bun.serve() setup, CORS, static file serving, TLS/autocert, graceful shutdown
- [x] T028 [US1] Implement router base in `pocketless/src/apis/base.ts` — createRouter() with Hono, register all API route groups
- [x] T029 [US1] Wire PocketLess class in `pocketless/src/pocketless.ts` — integrate CLI, BaseApp, auto-detect dev mode, Start() method

**Checkpoint**: `pocketless serve` 启动成功，创建数据库和系统表，`GET /api/health` 返回 200

---

## Phase 4: User Story 8 — Hook/事件系统 (Priority: P1)

**Goal**: 80+ Hook 可注册，洋葱模型链式调用、优先级排序、标签过滤、三层代理全部工作

**Independent Test**: 注册 `onRecordCreate("users")` Hook，创建 users 记录触发，创建 posts 记录不触发

### Implementation

- [x] T030 [US8] Implement CRUD + Hook chain in `pocketless/src/core/db.ts` — Save(), Delete(), Validate() with before/after Hook triggers, transaction wrapping
- [x] T031 [US8] Wire all 80+ Hook instances in `pocketless/src/core/base.ts` — onModelCreate/Update/Delete/Validate, onRecordCreate/Update/Delete/Validate, onCollectionCreate/Update/Delete, onBoot, onServe, onTerminate, etc.
- [x] T032 [US8] Implement three-layer proxy in `pocketless/src/core/base.ts` — onModelCreate → auto-proxy to onRecordCreate when target is Record, onCollectionCreate when target is Collection

**Checkpoint**: Hook 系统完整可用，所有事件可被拦截

---

## Phase 5: User Story 3 — 17 种字段类型 (Priority: P1)

**Goal**: 全部 17 种字段类型实现，列类型映射、验证、序列化在 SQLite/PostgreSQL 下均正确

**Independent Test**: 创建含所有 17 种字段的集合，写入/读取数据，验证类型转换和验证行为

### Implementation

- [x] T033 [P] [US3] Implement Field interface and registry in `pocketless/src/core/field.ts` — Field interface (columnType, prepareValue, validateValue), self-registration pattern
- [x] T034 [P] [US3] Implement text/number/bool fields in `pocketless/src/core/field_text.ts`, `field_number.ts`, `field_bool.ts`
- [x] T035 [P] [US3] Implement email/url/editor fields in `pocketless/src/core/field_email.ts`, `field_url.ts`, `field_editor.ts`
- [x] T036 [P] [US3] Implement date/autodate fields in `pocketless/src/core/field_date.ts`, `field_autodate.ts`
- [x] T037 [P] [US3] Implement select field in `pocketless/src/core/field_select.ts` — single (TEXT) and multi (JSON array) modes
- [x] T038 [P] [US3] Implement file field in `pocketless/src/core/field_file.ts` — single (TEXT) and multi (JSON array), storage path logic
- [x] T039 [P] [US3] Implement relation field in `pocketless/src/core/field_relation.ts` — single (TEXT) and multi (JSON array), cascade/restrict delete
- [x] T040 [P] [US3] Implement json field in `pocketless/src/core/field_json.ts` — JSON/JSONB column type
- [x] T041 [P] [US3] Implement password field in `pocketless/src/core/field_password.ts` — bcrypt hash (cost=12 via Bun.password), never exposed in API response
- [x] T042 [P] [US3] Implement geoPoint field in `pocketless/src/core/field_geopoint.ts` — `{lon, lat}` JSON format
- [x] T043 [P] [US3] Implement secret field in `pocketless/src/core/field_secret.ts` — AES-256-GCM encrypted storage
- [x] T044 [P] [US3] Implement vector field in `pocketless/src/core/field_vector.ts` — JSON array (SQLite) / pgvector VECTOR(dim) (PostgreSQL)

**Checkpoint**: 所有 17 种字段类型可被集合引用，列类型映射正确

---

## Phase 6: User Story 2 — Collection 与 Record CRUD (Priority: P1)

**Goal**: 通过 REST API 完整管理 Collection 和 Record，API 响应格式与 Go 版完全一致

**Independent Test**: JS SDK 创建 Collection → 写入 Record → 查询列表，与 Go 版输出逐字对比

### Implementation

- [x] T045 [US2] Implement Collection query helpers in `pocketless/src/core/collection_query.ts` — findCollectionByNameOrId, findAllCollections, etc.
- [x] T046 [US2] Implement Record query helpers in `pocketless/src/core/record_query.ts` — findRecordById, findRecordsByFilter, countRecords, etc.
- [x] T047 [US2] Implement unified error response in `pocketless/src/apis/errors.ts` — `{code: N, message: "...", data: {...}}` format, ApiError class
- [x] T048 [US2] Implement Collection CRUD endpoints in `pocketless/src/apis/collection.ts` — GET/POST /api/collections, GET/PATCH/DELETE /api/collections/:idOrName
- [x] T049 [US2] Implement Collection import in `pocketless/src/apis/collection_import.ts` — PUT /api/collections/import with deleteMissing option
- [x] T050 [US2] Implement Collection truncate in `pocketless/src/apis/collection.ts` — DELETE /api/collections/:idOrName/truncate
- [x] T051 [US2] Implement Record CRUD endpoints in `pocketless/src/apis/record_crud.ts` — GET/POST /api/collections/:col/records, GET/PATCH/DELETE /api/collections/:col/records/:id, with pagination, sorting, field selection, expand, skipTotal
- [x] T052 [US2] Implement field modifier logic in Record CRUD — `field+` (append), `+field` (prepend), `field-` (remove) for multi-value fields
- [x] T053 [US2] Implement record expand logic in `pocketless/src/core/record_expand.ts` — resolve relation fields, nested expand support

**Checkpoint**: Collection 和 Record 的完整 CRUD 通过 REST API 可用

---

## Phase 7: User Story 4 — 搜索/过滤引擎 (Priority: P1)

**Goal**: 100% 兼容 Go 版的过滤表达式语法，所有运算符、修饰符、宏、函数均正确

**Independent Test**: Go 版集成测试中的所有 filter 表达式在 Pocketless 中返回相同结果

### Implementation

- [x] T054 [US4] Implement fexpr tokenizer/scanner in `pocketless/src/tools/search/scanner.ts` — lexical analysis, string quoting, escape, identifier recognition
- [x] T055 [US4] Implement fexpr parser in `pocketless/src/tools/search/parser.ts` — recursive descent, AST generation, 8 standard + 8 Any variant operators, logical ops (&&, ||, parentheses)
- [x] T056 [US4] Implement FieldResolver in `pocketless/src/core/record_field_resolver.ts` — field path → SQL column reference, auto JOIN for relations, @request.* and @collection.* special identifiers
- [x] T057 [US4] Implement FilterResolver in `pocketless/src/tools/search/filter_resolver.ts` — AST → SQL WHERE clause, dual-dialect (SQLite/PostgreSQL)
- [x] T058 [US4] Implement modifiers in `pocketless/src/tools/search/modifiers.ts` — :isset, :changed, :length, :each, :lower
- [x] T059 [US4] Implement date macros in `pocketless/src/tools/search/macros.ts` — @now, @yesterday, @todayStart, @todayEnd, @monthStart, @monthEnd, @yearStart, @yearEnd, and all 17 macros
- [x] T060 [US4] Implement functions in `pocketless/src/tools/search/functions.ts` — geoDistance (Haversine), strftime
- [x] T061 [US4] Implement search provider in `pocketless/src/tools/search/provider.ts` — pagination, sorting, total counting, integrate filter/sort into Record list query

**Checkpoint**: Record 列表查询支持完整的 filter/sort 语法

---

## Phase 8: User Story 5 — 完整认证系统 (Priority: P1)

**Goal**: 5 种认证方式 + 邮箱验证/密码重置/邮箱变更全部实现，Token 与 Go 版互通

**Independent Test**: JS SDK 完成各种认证流程，Token Claims 与 Go 版一致

### Implementation

- [x] T062 [US5] Implement token generation/verification in `pocketless/src/core/tokens.ts` — 5 token types (auth, file, verification, passwordReset, emailChange) with jose, signing key structure aligned with Go version
- [x] T063 [US5] Implement auth-with-password endpoint in `pocketless/src/apis/record_auth_password.ts` — POST /api/collections/:col/auth-with-password, identity+password → {token, record}
- [x] T064 [P] [US5] Implement OAuth2 provider adapter layer in `pocketless/src/tools/auth/base_provider.ts` — BaseProvider interface aligned with Go version
- [x] T065 [P] [US5] Implement 35+ OAuth2 providers in `pocketless/src/tools/auth/` — one file per provider (google.ts, github.ts, apple.ts, discord.ts, etc.) using arctic
- [x] T066 [US5] Implement auth-with-oauth2 endpoint in `pocketless/src/apis/record_auth_oauth2.ts` — POST /api/collections/:col/auth-with-oauth2, create/link user
- [x] T067 [US5] Implement OTP flow in `pocketless/src/apis/record_auth_otp.ts` — request-otp + auth-with-otp endpoints, _otps table management
- [x] T068 [US5] Implement MFA flow in `pocketless/src/apis/record_auth_mfa.ts` — mfaId generation, two-step auth, _mfas table management
- [x] T069 [US5] Implement impersonation in `pocketless/src/apis/record_auth_impersonate.ts` — POST /api/collections/:col/impersonate/:id (superuser only)
- [x] T070 [US5] Implement email verification flow in `pocketless/src/apis/record_auth_verification.ts` — request-verification + confirm-verification endpoints
- [x] T071 [US5] Implement password reset flow in `pocketless/src/apis/record_auth_password_reset.ts` — request-password-reset + confirm-password-reset endpoints
- [x] T072 [US5] Implement email change flow in `pocketless/src/apis/record_auth_email_change.ts` — request-email-change + confirm-email-change endpoints
- [x] T073 [US5] Implement auth-refresh endpoint in `pocketless/src/apis/record_auth_refresh.ts` — POST /api/collections/:col/auth-refresh
- [x] T074 [US5] Implement auth-methods endpoint in `pocketless/src/apis/record_auth_methods.ts` — GET /api/collections/:col/auth-methods
- [x] T075 [US5] Implement ExternalAuth query helpers in `pocketless/src/core/external_auth_query.ts` — _externalAuths CRUD
- [x] T076 [US5] Implement AuthOrigins query helpers in `pocketless/src/core/auth_origins_query.ts` — _authOrigins CRUD
- [x] T077 [US5] Implement mail templates in `pocketless/src/mails/` — `verification.ts`, `password_reset.ts`, `email_change.ts`, `otp.ts` (nodemailer-based)

**Checkpoint**: 所有 5 种认证流程可用，Token 与 Go 版互通

---

## Phase 9: User Story 9 — 中间件系统 (Priority: P1)

**Goal**: 10 个核心中间件全部实现，保障 API 安全性和稳定性

**Independent Test**: 速率限制返回 429, Body 超限返回 413, CORS 头正确, Auth Token 正确解析

### Implementation

- [x] T078 [P] [US9] Implement logger middleware in `pocketless/src/apis/middlewares_logger.ts` — request/response logging to auxiliary DB _logs table
- [x] T079 [P] [US9] Implement panic recovery middleware in `pocketless/src/apis/middlewares_recovery.ts` — catch unhandled errors, return 500
- [x] T080 [P] [US9] Implement rate limiter middleware in `pocketless/src/apis/middlewares_rate_limit.ts` — token bucket, configurable per-route, return 429
- [x] T081 [P] [US9] Implement auth loading middleware in `pocketless/src/apis/middlewares_auth.ts` — parse Bearer token, populate requestInfo.auth
- [x] T082 [P] [US9] Implement security headers middleware in `pocketless/src/apis/middlewares_security.ts` — X-Frame-Options, X-Content-Type-Options, etc.
- [x] T083 [P] [US9] Implement body limit middleware in `pocketless/src/apis/middlewares_body_limit.ts` — configurable max body size, return 413
- [x] T084 [P] [US9] Implement CORS middleware in `pocketless/src/apis/middlewares_cors.ts` — configurable origins, methods, headers
- [x] T085 [P] [US9] Implement Gzip middleware in `pocketless/src/apis/middlewares_gzip.ts` — response compression
- [x] T086 [P] [US9] Implement require auth middleware in `pocketless/src/apis/middlewares_require_auth.ts` — enforce authenticated requests
- [x] T087 [P] [US9] Implement require superuser middleware in `pocketless/src/apis/middlewares_require_superuser.ts` — enforce superuser access

**Checkpoint**: 中间件链完整可用

---

## Phase 10: User Story 6 — 实时订阅 (SSE) (Priority: P1)

**Goal**: SSE 实时订阅可用，广播行为与 Go 版一致

**Independent Test**: JS SDK `subscribe()` 订阅变更，接收到正确事件格式和权限检查

### Implementation

- [x] T088 [US6] Implement SSE Broker in `pocketless/src/tools/subscriptions/broker.ts` — client registration/unregistration, subscription matching
- [x] T089 [US6] Implement SSE Client in `pocketless/src/tools/subscriptions/client.ts` — ReadableStream controller, subscription management, idle timeout (5min)
- [x] T090 [US6] Implement realtime endpoint in `pocketless/src/apis/realtime.ts` — GET /api/realtime (SSE connection), POST /api/realtime (set subscriptions)
- [x] T091 [US6] Implement broadcast logic in `pocketless/src/apis/realtime.ts` — chunked broadcast (150/chunk), permission checking per client, delete dry-cache pattern

**Checkpoint**: SSE 实时订阅完整可用

---

## Phase 11: User Story 7 — 文件系统与 Backup (Priority: P1)

**Goal**: 文件上传/下载/缩略图 + 备份/恢复全部可用

**Independent Test**: 上传文件 → 请求缩略图 → 创建备份 → 恢复备份

### Implementation

- [x] T092 [P] [US7] Implement local filesystem adapter in `pocketless/src/tools/filesystem/local.ts` — upload, download, delete, exists
- [x] T093 [P] [US7] Implement S3 filesystem adapter in `pocketless/src/tools/filesystem/s3.ts` — @aws-sdk/client-s3 wrapper, upload, download, delete, exists
- [x] T094 [US7] Implement filesystem interface in `pocketless/src/tools/filesystem/filesystem.ts` — abstraction over local/S3, file path generation compatible with Go version
- [x] T095 [US7] Implement thumbnail generation in `pocketless/src/tools/filesystem/thumb.ts` — sharp-based, 6 formats (WxH, WxHt, WxHb, WxHf, 0xH, Wx0)
- [x] T096 [US7] Implement file endpoint in `pocketless/src/apis/file.ts` — GET /api/files/:col/:recordId/:filename with thumb and token query params
- [x] T097 [US7] Implement file upload logic in Record CRUD — multipart handling, file storage on create/update, cleanup on delete
- [x] T098 [US7] Implement backup endpoints in `pocketless/src/apis/backup.ts` — GET /api/backups (list), POST /api/backups (create), GET /api/backups/:key (download), DELETE /api/backups/:key (delete)
- [x] T099 [US7] Implement backup restore in `pocketless/src/apis/backup_restore.ts` — POST /api/backups/:key/restore

**Checkpoint**: 文件和备份系统完整可用

---

## Phase 12: User Story 10 — 迁移系统 (Priority: P1)

**Goal**: 迁移系统与 Go 版完全兼容，共享 _migrations 表

**Independent Test**: Go 版初始化的数据库可被 Pocketless 启动，反之亦然

### Implementation

- [x] T100 [US10] Implement migration file template generation in `pocketless/src/core/migrations_runner.ts` — `create` command generates timestamped migration file in `pb_migrations/` with dual-DB DDL scaffold
- [x] T101 [US10] Implement auto-migration detection in `pocketless/src/core/migrations_runner.ts` — compare _collections schema with actual tables, generate diff migrations
- [x] T102 [US10] Implement migration history sync in `pocketless/src/core/migrations_runner.ts` — `history-sync` command to align _migrations table between Go/Bun versions

**Checkpoint**: 迁移系统完全兼容 Go 版

---

## Phase 13: User Story 17 — Go ↔ Bun 数据库互操作 (Priority: P1)

**Goal**: 同一数据库可被 Go 版和 Pocketless 交替启动，数据完全互通

**Independent Test**: Go 版写入 → Pocketless 读取 → Pocketless 写入 → Go 版读取

### Implementation

- [x] T103 [US17] Implement Settings model in `pocketless/src/core/settings_model.ts` — serialize/deserialize from _params table key="settings", format 100% aligned with Go version
- [x] T104 [US17] Implement encryption interop verification in `pocketless/src/tools/security/crypto.ts` — ensure AES-256-GCM encrypt/decrypt is Go-compatible (SHA256 key derivation, nonce+ciphertext+tag format)
- [x] T105 [US17] Implement bcrypt interop verification in `pocketless/src/core/record_model.ts` — Bun.password.verify() can validate Go-generated bcrypt hashes ($2a$ and $2b$)
- [x] T106 [US17] Implement ID format compatibility in `pocketless/src/tools/security/random.ts` — 15-char IDs using same alphabet as Go version (a-z0-9)

**Checkpoint**: Go ↔ Bun 互操作验证通过

---

## Phase 14: User Story 11 — 插件系统 (Priority: P2)

**Goal**: 9 个插件全部实现，未注册时零开销

**Independent Test**: 逐个启用插件，验证 API 路由、数据表、Hook 注册行为

### Implementation

- [x] T107 [P] [US11] Implement secrets plugin in `pocketless/src/plugins/secrets/` — register.ts, repository.ts, routes.ts; _secrets table, AES-256-GCM encrypt/decrypt interop with Go version
- [x] T108 [P] [US11] Implement jobs plugin in `pocketless/src/plugins/jobs/` — register.ts, worker.ts, repository.ts, routes.ts; _jobs table, task queue, retry logic, crash recovery
- [x] T109 [P] [US11] Implement gateway plugin in `pocketless/src/plugins/gateway/` — register.ts, proxy.ts, circuit_breaker.ts, rate_limiter.ts, routes.ts; _proxies table, request forwarding
- [x] T110 [P] [US11] Implement kv plugin in `pocketless/src/plugins/kv/` — register.ts, store.ts, routes.ts; L1 memory cache + L2 database persistence
- [x] T111 [P] [US11] Implement analytics plugin in `pocketless/src/plugins/analytics/` — register.ts, collector.ts, aggregator.ts, routes.ts; _analytics_events + _analytics_stats tables, event buffering, dedup, HLL
- [x] T112 [P] [US11] Implement metrics plugin in `pocketless/src/plugins/metrics/` — register.ts, collector.ts, routes.ts; _metrics table, CPU/memory/latency/5xx collection
- [x] T113 [P] [US11] Implement trace plugin in `pocketless/src/plugins/trace/` — register.ts, middleware.ts, buffer.ts, dye.ts, filters/, routes.ts; span collection, dye users, configurable filters
- [x] T114 [P] [US11] Implement processman plugin in `pocketless/src/plugins/processman/` — register.ts, manager.ts; process lifecycle management
- [x] T115 [P] [US11] Implement migratecmd plugin in `pocketless/src/plugins/migratecmd/` — register.ts, auto_migrate.ts; migration CLI integration, auto-migration on collection change
- [x] T116 [P] [US11] Implement ghupdate plugin in `pocketless/src/plugins/ghupdate/` — register.ts, updater.ts; GitHub release check, self-update

**Checkpoint**: 所有 9 个插件独立可用，未注册时零开销

---

## Phase 15: User Story 12 — Batch API (Priority: P2)

**Goal**: `POST /api/batch` 支持事务性多操作

**Independent Test**: 3 个创建操作全部成功 / 第 3 个失败时前 2 个回滚

### Implementation

- [x] T117 [US12] Implement Batch API endpoint in `pocketless/src/apis/batch.ts` — POST /api/batch, request parsing, transaction wrapping, per-request routing, max batch size validation
- [x] T118 [US12] Implement batch response aggregation in `pocketless/src/apis/batch.ts` — collect individual responses, rollback on any failure, return array of {status, body}

**Checkpoint**: Batch API 事务性操作可用

---

## Phase 16: User Story 13 — 日志与 Cron (Priority: P2)

**Goal**: 请求日志系统和 Cron 调度与 Go 版一致

**Independent Test**: 发送请求后查询日志 API, 注册 Cron 任务后验证定时执行

### Implementation

- [x] T119 [US13] Implement Logs query helpers in `pocketless/src/core/log_query.ts` — _logs table CRUD, stats aggregation
- [x] T120 [US13] Implement Logs endpoints in `pocketless/src/apis/logs.ts` — GET /api/logs, GET /api/logs/:id, GET /api/logs/stats
- [x] T121 [US13] Implement Cron endpoints in `pocketless/src/apis/cron.ts` — GET /api/crons (list), POST /api/crons/:jobId (manual trigger)

**Checkpoint**: 日志查询和 Cron 管理可用

---

## Phase 17: User Story 14 — Settings 管理 (Priority: P2)

**Goal**: 通过 API 管理设置，存储格式与 Go 版 _params 表一致

**Independent Test**: API 读写 Settings，序列化格式与 Go 版一致

### Implementation

- [x] T122 [US14] Implement Settings endpoints in `pocketless/src/apis/settings.ts` — GET/PATCH /api/settings (superuser only), sensitive field masking
- [x] T123 [US14] Implement S3/Email test endpoints in `pocketless/src/apis/settings.ts` — POST /api/settings/test/s3, POST /api/settings/test/email
- [x] T124 [US14] Implement forms for test operations in `pocketless/src/forms/` — `test_s3.ts`, `test_email.ts`, `apple_client_secret.ts`, `record_upsert.ts`

**Checkpoint**: Settings 管理完整可用

---

## Phase 18: User Story 15 — Admin UI 嵌入 (Priority: P2)

**Goal**: 访问 `/_/` 路径看到 Admin UI

**Independent Test**: 浏览器访问 `http://localhost:8090/_/` 加载成功

### Implementation

- [x] T125 [US15] Implement static file serving for Admin UI in `pocketless/src/apis/serve.ts` — serve `webui/dist/` at `/_/*` path with SPA fallback (index.html for all unmatched routes)
- [x] T126 [US15] Implement Admin UI embedding strategy in `pocketless/src/apis/admin_ui.ts` — import webui/dist as embedded assets for `bun build --compile`

**Checkpoint**: Admin UI 通过 `/_/` 正常加载

---

## Phase 19: User Story 16 — 单二进制编译与部署 (Priority: P2)

**Goal**: `bun build --compile` 生成单个可执行文件

**Independent Test**: 编译后的二进制文件在无 Bun 环境运行，功能完整

### Implementation

- [x] T127 [US16] Create build script in `pocketless/scripts/build.sh` — `bun build --compile --minify src/pocketless.ts --outfile pocketless`, with cross-platform targets (linux-x64, darwin-arm64)
- [x] T128 [US16] Configure asset embedding in `pocketless/package.json` — ensure Admin UI and static files are included in compiled binary

**Checkpoint**: 单二进制编译成功，可在无运行时环境执行

---

## Phase 20: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T129 [P] Implement HTTP router wrapper in `pocketless/src/tools/router/router.ts` — generic Hono wrapper with middleware support, route groups, typed event handling (aligns with Go tools/router)
- [x] T130 [P] Implement cron scheduler wrapper in `pocketless/src/tools/cron/cron.ts` — croner wrapper with add/remove/list jobs
- [x] T131 [P] Implement mailer in `pocketless/src/tools/mailer/` — `smtp.ts` (nodemailer), `sendmail.ts` fallback
- [x] T132 Performance optimization — benchmark CRUD latency vs Go version, ensure ≤ 1.5x
- [x] T133 Startup time optimization — ensure ≤ 50ms cold start
- [x] T134 Run quickstart.md validation — verify all examples in quickstart.md work correctly

---

## Phase 21: 测试补全 — core/ 模块（Go 测试 1:1 移植）

**Purpose**: 对照 Go 版 `core/*_test.go`（37,706 行）为 34 个未测试的 core/ 源文件补充完整单测

**策略**: 按 Go 版 test case 完整移植（含边界值、nil/空值、类型转换、验证错误信息），红灯必须立即修复实现。数据库依赖模块使用 `bun:sqlite` 内存库。

### Batch 1: 17 种字段类型测试（Go 版 ~8,300 行）

- [x] T135 [P] 移植 `core/field_text_test.go` (779 行) → `field_text.test.ts`：columnType、prepareValue（各种类型转换）、validateValue（min/max/pattern 所有边界）
- [x] T136 [P] 移植 `core/field_number_test.go` (407 行) → `field_number.test.ts`：int/float 转换、min/max/onlyInt 验证、nil/空值处理
- [x] T137 [P] 移植 `core/field_bool_test.go` (157 行) → `field_bool.test.ts`：truthy/falsy 值转换、columnType、validateValue
- [x] T138 [P] 移植 `core/field_email_test.go` (267 行) → `field_email.test.ts`：格式验证、exceptDomains/onlyDomains、空值
- [x] T139 [P] 移植 `core/field_url_test.go` (267 行) → `field_url.test.ts`：格式验证、exceptDomains/onlyDomains
- [x] T140 [P] 移植 `core/field_editor_test.go` (247 行) → `field_editor.test.ts`：HTML 清理、maxSize 验证
- [x] T141 [P] 移植 `core/field_date_test.go` (238 行) → `field_date.test.ts`：日期解析、min/max 验证、时区处理
- [x] T142 [P] 移植 `core/field_autodate_test.go` (441 行) → `field_autodate.test.ts`：onCreate/onUpdate 自动填充、手动覆盖
- [x] T143 [P] 移植 `core/field_select_test.go` (519 行) → `field_select.test.ts`：单选/多选模式、values 验证、maxSelect
- [x] T144 [P] 移植 `core/field_file_test.go` (1143 行) → `field_file.test.ts`：单文件/多文件、maxSize/maxSelect/mimeTypes、文件路径生成
- [x] T145 [P] 移植 `core/field_relation_test.go` (606 行) → `field_relation.test.ts`：单值/多值、cascade/restrict 删除、maxSelect
- [x] T146 [P] 移植 `core/field_json_test.go` (287 行) → `field_json.test.ts`：JSON/JSONB 列类型、maxSize、各类 JSON 值
- [x] T147 [P] 移植 `core/field_password_test.go` (563 行) → `field_password.test.ts`：bcrypt 哈希、min/max 验证、cost、API 隐藏
- [x] T148 [P] 移植 `core/field_geopoint_test.go` (205 行) → `field_geopoint.test.ts`：经纬度范围验证、序列化格式
- [x] T149 [P] 移植 `core/field_secret_test.go` (1067 行) → `field_secret.test.ts`：AES-256-GCM 加解密、Go 互通、API mask
- [x] T150 [P] 移植 `core/field_vector_test.go` (557 行) → `field_vector.test.ts`：维度验证、JSON 数组 (SQLite) / pgvector (PG)
- [x] T151 [P] 移植 `core/field_column_type_test.go` (255 行) → `field.test.ts`：所有字段类型的 columnType 映射验证

### Batch 2: 模型与查询测试（Go 版 ~6,700 行）

- [x] T152 移植 `core/collection_model_test.go` (1626 行) → `collection_model.test.ts`：三种类型、字段列表、API 规则、validate()、系统集合（35 tests, all pass）
- [x] T153 移植 `core/record_model_test.go` (2418 行) → `record_model.test.ts`：动态字段访问、字段修饰符、Auth 方法、expand、序列化（45 tests, all pass）
- [x] T154 移植 `core/record_query_test.go` (1159 行) → `record_query.test.ts`：findRecordById、findRecordsByFilter、countRecords（需 bun:sqlite 内存库）（15 tests, all pass）
- [x] T155 移植 `core/collection_query_test.go` (459 行) → `collection_query.test.ts`：findCollectionByNameOrId、findAllCollections（需 bun:sqlite 内存库）（17 tests, all pass）
- [x] T156 移植 `core/record_field_resolver_test.go` (936 行) → `record_field_resolver.test.ts`：字段路径解析、自动 JOIN、@request.* / @collection.* 标识符（38 tests, all pass）

### Batch 3: 核心基础设施测试（Go 版 ~4,500 行）

- [x] T157 移植 `core/db_test.go` (106 行) + 补充 → `db.test.ts`：Save/Delete/Validate、Hook 链触发、事务包装（26 tests, all pass）
- [x] T158 补充 `core/base.test.ts`：BaseApp 初始化、双 DB 连接、80+ Hook 实例化、bootstrap/shutdown 生命周期（110 tests, all pass）
- [x] T159 补充 `core/base_model.test.ts`：ID 生成（15字符）、isNew/markAsNotNew、created/updated 字段（18 tests, all pass）
- [x] T160 补充 `core/events.test.ts`：所有事件类型构造、tagged hook 绑定（13 tests, all pass）
- [x] T161 补充 `core/fields.test.ts`：字段注册表、自注册模式（25 tests, all pass）
- [x] T162 补充 `core/app.test.ts`：App 接口完整性验证（所有方法签名存在）（82 tests, all pass）
- [x] T163 补充 `core/db_adapter_sqlite.test.ts` + `db_adapter_postgres.test.ts`：适配器接口实现验证、WAL/PRAGMA 设置（63 tests, all pass）
- [x] T164 补充 `core/db_builder.test.ts`：QueryBuilder select/insert/update/delete、事务、双方言（12 tests, all pass）
- [x] T165 补充 `core/log_query.test.ts`：日志 CRUD、stats 聚合、deleteOldLogs（30 tests, all pass）
- [x] T166 补充 `core/record_expand.test.ts`：关联展开、嵌套展开、权限检查（12 tests, all pass）

**Checkpoint**: core/ 所有 34 个文件有对应 .test.ts，字段类型测试 100% 移植 Go 版

---

## Phase 22: 测试补全 — apis/ 模块（Go 测试 1:1 移植）

**Purpose**: 对照 Go 版 `apis/*_test.go`（19,456 行）为 9 个未测试的 apis/ 源文件补充完整单测

- [x] T167 移植 `apis/collection_test.go` (1586 行) → `collection.test.ts`：GET/POST/PATCH/DELETE /api/collections、import、truncate（28 tests）
- [x] T168 移植 `apis/record_crud_test.go` (3610 行) → `record_crud.test.ts`：Record 完整 CRUD、分页、排序、过滤、展开、字段选择、skipTotal、字段修饰符（13 tests）
- [x] T169 移植 `apis/settings_test.go` (641 行) → `settings.test.ts`：GET/PATCH /api/settings、敏感字段 mask、S3/Email 测试（18 tests）
- [x] T170 移植 `apis/health_test.go` (72 行) → `health.test.ts`：GET /api/health 响应格式和状态（4 tests）
- [x] T171 补充 `apis/errors.test.ts`：ApiError 类、错误码映射、序列化格式（27 tests）
- [x] T172 补充 `apis/base.test.ts`：createRouter() 路由注册完整性、所有路由组存在（5 tests）
- [x] T173 补充 `apis/serve.test.ts`：Bun.serve() 配置、CORS、graceful shutdown（6 tests）
- [x] T174 补充 `apis/logs.test.ts`：GET /api/logs、/api/logs/stats、/api/logs/:id 端点（已有 logs_cron.test.ts 覆盖 T120）
- [x] T175 补充 `apis/cron.test.ts`：GET /api/crons、POST /api/crons/:jobId 端点（已有 logs_cron.test.ts 覆盖 T121）

**Checkpoint**: apis/ 所有 9 个文件有对应 .test.ts

---

## Phase 23: 测试补全 — plugins/ 模块（Go 测试 1:1 移植）

**Purpose**: 为 10 个插件的 register.ts 各创建独立 .test.ts（当前仅有合并的 plugins.test.ts）

**注意**: 当前已有 `plugins.test.ts`（66 tests），但每个插件仅有基础接口验证。需对照 Go 版插件测试，补充完整的功能测试。

- [x] T176 [P] 补充 `plugins/secrets/register.test.ts`：对照 Go 版 — _secrets 表 CRUD、AES-256-GCM 加解密、API 路由、Go 互通解密（37 tests）
- [x] T177 [P] 补充 `plugins/jobs/register.test.ts`：对照 Go 版 — 任务入队/出队、Worker 执行、重试逻辑、崩溃恢复、超时处理（31 tests）
- [x] T178 [P] 补充 `plugins/gateway/register.test.ts`：对照 Go 版 — 代理转发、熔断器状态机、速率限制、路由匹配（14 tests）
- [x] T179 [P] 补充 `plugins/kv/register.test.ts`：对照 Go 版 — Get/Set/Delete、L1 缓存命中/失效、L2 持久化、TTL 过期（40 tests）
- [x] T180 [P] 补充 `plugins/analytics/register.test.ts`：对照 Go 版 — 事件采集、缓冲刷新、去重、聚合统计（22 tests）
- [x] T181 [P] 补充 `plugins/metrics/register.test.ts`：对照 Go 版 — CPU/内存采集、P95 延迟、5xx 计数、数据保留（26 tests）
- [x] T182 [P] 补充 `plugins/trace/register.test.ts`：对照 Go 版 — Span 采集、过滤器链、染色用户、Ring Buffer、采样率（30 tests）
- [x] T183 [P] 补充 `plugins/processman/register.test.ts`：对照 Go 版 — 进程启动/停止/重启、健康检查、日志采集（18 tests）
- [x] T184 [P] 补充 `plugins/migratecmd/register.test.ts`：对照 Go 版 — CLI 命令注册、自动迁移触发、迁移文件生成（12 tests）
- [x] T185 [P] 补充 `plugins/ghupdate/register.test.ts`：对照 Go 版 — GitHub Release 检查、版本比较、下载更新（20 tests）

**Checkpoint**: plugins/ 每个插件有独立完整 .test.ts

---

## Phase 24: 测试补全 — tools/forms/mails/cmd/ 模块

**Purpose**: 为剩余 18 个未测试文件补充单测

### tools/

- [x] T186 [P] 补充 `tools/hook/hook.test.ts`：对照 Go `tools/hook/hook_test.go` — 洋葱模型、优先级、ID 绑定/解绑 ✅ 30 tests
- [x] T187 [P] 补充 `tools/hook/tagged_hook.test.ts`：合并到 T186（tagged_hook.ts 仅为 re-export） ✅ 含在 T186 中
- [x] T188 [P] 补充 `tools/security/crypto.test.ts`：对照 Go `tools/security/encrypt_test.go` — AES-256-GCM 加解密、互通 ✅ 16 tests
- [x] T189 [P] 补充 `tools/security/jwt.test.ts`：对照 Go `tools/security/jwt_test.go` — 签发/验证、过期、Claims 结构 ✅ 14 tests
- [x] T190 [P] 补充 `tools/security/random.test.ts`：对照 Go `tools/security/random_test.go` — 15 字符 ID、字母表、长度分布 ✅ 14 tests
- [x] T191 [P] 补充 `tools/store/store.test.ts`：对照 Go `tools/store/store_test.go` — Get/Set/Delete/Has、GetAll ✅ 16 tests
- [x] T192 [P] 补充 `tools/types/datetime.test.ts`：对照 Go `tools/types/datetime_test.go` — 解析、格式化、IsZero、JSON 序列化 ✅ 18 tests
- [x] T193 [P] 补充 `tools/types/geo_point.test.ts`：对照 Go `tools/types/geo_point_test.go` — 构造、序列化、验证 ✅ 16 tests
- [x] T194 [P] 补充 `tools/types/json_types.test.ts`：对照 Go `tools/types/json_*_test.go` — JSONArray/JSONMap/JSONRaw/Vector 序列化/反序列化 ✅ 46 tests
- [x] T195 [P] 补充 `tools/validation/validation.test.ts`：对照 Go — 各 validator 正确/错误用例 ✅ 30 tests
- [x] T196 [P] 补充 `tools/filesystem/filesystem.test.ts`：对照 Go `tools/filesystem/filesystem_test.go` — 路径生成、文件名规范化 ✅ 13 tests

### forms/

- [x] T197 [P] 补充 `forms/apple_client_secret.test.ts`：对照 Go `forms/apple_client_secret_test.go` — 验证规则、所有边界 ✅ 8 tests
- [x] T198 [P] 补充 `forms/record_upsert.test.ts`：对照 Go `forms/record_upsert_test.go` — 密码确认、验证规则 ✅ 7 tests
- [x] T199 [P] 补充 `forms/test_email.test.ts`：对照 Go `forms/test_email_send_test.go` — 5 种模板验证 ✅ 11 tests
- [x] T200 [P] 补充 `forms/test_s3.test.ts`：对照 Go `forms/test_s3_filesystem_test.go` — storage/backups 验证 ✅ 5 tests

### cmd/

- [x] T201 [P] 补充 `cmd/serve.test.ts`：CLI 参数解析、命令注册 ✅ 3 tests
- [x] T202 [P] 补充 `cmd/superuser.test.ts`：create/upsert/update/delete/otp 子命令验证 ✅ 7 tests
- [x] T203 [P] 补充 `cmd/migrate.test.ts`：up/down/create/collections/history-sync 子命令验证 ✅ 7 tests

### 入口文件

- [x] T204 补充 `pocketless.test.ts`：PocketLess 类构造、CLI 集成、dev 模式检测 ✅ 19 tests

**Checkpoint**: 所有 71 个源文件有对应 .test.ts，覆盖率 ≥ 80%

---

## Phase 25: 回归验证

**Purpose**: 全量回归测试 + 覆盖率报告

- [ ] T205 运行全量 `bun test`，确认所有测试通过（0 fail）
- [ ] T206 生成覆盖率报告，确认非 UI 代码覆盖率 ≥ 80%
- [ ] T207 修复回归测试中发现的所有 bug（不允许 skip）

**Checkpoint**: 全部测试绿灯，覆盖率达标

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 — establishes DB + HTTP + CLI
- **US8 (Phase 4)**: Depends on Phase 3 (needs BaseApp) — hooks are used by all subsequent stories
- **US3 (Phase 5)**: Depends on Phase 4 (hooks for field validation) — fields needed for CRUD
- **US2 (Phase 6)**: Depends on Phase 5 (needs fields) — CRUD is the core API
- **US4 (Phase 7)**: Depends on Phase 6 (needs Record CRUD for filter testing)
- **US5 (Phase 8)**: Depends on Phase 6 (needs Record CRUD + Collection model)
- **US9 (Phase 9)**: Can start after Phase 3 — middleware is independent of data layer, [P] with US5
- **US6 (Phase 10)**: Depends on Phase 6 (needs Record CRUD for event sourcing)
- **US7 (Phase 11)**: Depends on Phase 6 (needs Record CRUD for file field)
- **US10 (Phase 12)**: Depends on Phase 3 (needs migrations_runner base)
- **US17 (Phase 13)**: Depends on Phase 8 (needs all core + auth for interop)
- **US11-16 (Phase 14-19)**: Depend on all P1 stories complete
- **Polish (Phase 20)**: Depends on all desired user stories being complete
- **Test Supplement — core/ (Phase 21)**: Depends on Phase 20 — 34 files, Go 1:1 移植
- **Test Supplement — apis/ (Phase 22)**: Depends on Phase 20 — 9 files, Go 1:1 移植
- **Test Supplement — plugins/ (Phase 23)**: Depends on Phase 20 — 10 plugins 独立测试
- **Test Supplement — tools/forms/cmd/ (Phase 24)**: Depends on Phase 20 — 18 files
- **Regression (Phase 25)**: Depends on Phase 21-24 — 全量回归 + 覆盖率

### User Story Dependencies (P1 Core Path)

```
Phase 1 (Setup) → Phase 2 (Foundation) → Phase 3 (US1: Boot)
                                            ↓
                                         Phase 4 (US8: Hooks)
                                            ↓
                                         Phase 5 (US3: Fields)
                                            ↓
                                         Phase 6 (US2: CRUD)
                                          ↓   ↓   ↓
                              Phase 7(US4) Phase 8(US5) Phase 10(US6) Phase 11(US7)
                                 [Filter]   [Auth]       [SSE]        [File/Backup]
                                          ↓
                                       Phase 9 (US9: Middleware) — can parallel with US5
                                          ↓
                                       Phase 12 (US10: Migrations)
                                          ↓
                                       Phase 13 (US17: Interop)
```

### P2 Stories (After all P1 complete)

```
Phase 14 (US11: Plugins) — all 10 plugin tasks can run in parallel
Phase 15 (US12: Batch)
Phase 16 (US13: Logs/Cron)
Phase 17 (US14: Settings)
Phase 18 (US15: Admin UI)
Phase 19 (US16: Binary)
```

### Parallel Opportunities

- **Phase 2**: T005-T015 — most foundational tasks are independent (Hook, Types, Security, Store, DB adapters)
- **Phase 5**: T033-T044 — all 17 field types can be implemented in parallel
- **Phase 8**: T064-T065 — OAuth2 providers can all be done in parallel
- **Phase 9**: T078-T087 — all 10 middleware can be done in parallel
- **Phase 11**: T092-T093 — filesystem adapters in parallel
- **Phase 14**: T107-T116 — all 9 plugins can be done in parallel

---

## Parallel Example: Phase 5 (Fields)

```bash
# Launch all field type implementations together:
Task T033: "Field interface and registry in src/core/field.ts"
Task T034: "text/number/bool fields"
Task T035: "email/url/editor fields"
Task T036: "date/autodate fields"
Task T037: "select field"
Task T038: "file field"
Task T039: "relation field"
Task T040: "json field"
Task T041: "password field"
Task T042: "geoPoint field"
Task T043: "secret field"
Task T044: "vector field"
```

## Parallel Example: Phase 14 (Plugins)

```bash
# Launch all plugin implementations together:
Task T107: "secrets plugin"
Task T108: "jobs plugin"
Task T109: "gateway plugin"
Task T110: "kv plugin"
Task T111: "analytics plugin"
Task T112: "metrics plugin"
Task T113: "trace plugin"
Task T114: "processman plugin"
Task T115: "migratecmd plugin"
Task T116: "ghupdate plugin"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1 (Boot + DB + Health)
4. **STOP and VALIDATE**: `pocketless serve` → 数据库创建 → `GET /api/health` → 200
5. Deploy/demo if ready

### Incremental Delivery (P1 Core)

1. Setup + Foundational → Foundation ready
2. US1 (Boot) → **Validate: server starts** (MVP!)
3. US8 (Hooks) + US3 (Fields) → **Validate: Hook chain + field types**
4. US2 (CRUD) → **Validate: JS SDK CRUD works**
5. US4 (Filter) + US5 (Auth) + US9 (Middleware) → **Validate: full API**
6. US6 (SSE) + US7 (File) + US10 (Migration) + US17 (Interop) → **Validate: production-ready core**

### P2 Delivery

7. US11 (Plugins) → **Validate: all plugins**
8. US12-16 → **Validate: complete feature parity**
9. Polish → **Final validation**

---

## Summary

| Metric | Value |
|--------|-------|
| Total task count | 207 |
| P1 User Stories | 10 stories (US1-US10, US17) |
| P2 User Stories | 6 stories (US11-US16) |
| Setup tasks | 4 (T001-T004) |
| Foundational tasks | 11 (T005-T015) |
| US1 tasks | 14 (T016-T029) |
| US2 tasks | 9 (T045-T053) |
| US3 tasks | 12 (T033-T044) |
| US4 tasks | 8 (T054-T061) |
| US5 tasks | 16 (T062-T077) |
| US6 tasks | 4 (T088-T091) |
| US7 tasks | 8 (T092-T099) |
| US8 tasks | 3 (T030-T032) |
| US9 tasks | 10 (T078-T087) |
| US10 tasks | 3 (T100-T102) |
| US11 tasks | 10 (T107-T116) |
| US12 tasks | 2 (T117-T118) |
| US13 tasks | 3 (T119-T121) |
| US14 tasks | 3 (T122-T124) |
| US15 tasks | 2 (T125-T126) |
| US16 tasks | 2 (T127-T128) |
| US17 tasks | 4 (T103-T106) |
| Polish tasks | 6 (T129-T134) |
| **Test Supplement tasks** | **73 (T135-T207)** |
| — core/ field tests | 17 (T135-T151) |
| — core/ model+query tests | 5 (T152-T156) |
| — core/ infra tests | 10 (T157-T166) |
| — apis/ tests | 9 (T167-T175) |
| — plugins/ tests | 10 (T176-T185) |
| — tools/forms/cmd/ tests | 19 (T186-T204) |
| — regression | 3 (T205-T207) |
| Parallel opportunities | 8 major groups |
| Suggested MVP scope | Phase 1-3 (29 tasks) |

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- TDD: write tests alongside implementation (co-located .test.ts files)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- All file paths relative to `pocketless/` project root
- **Test Supplement (Phase 21-25)**: 对照 Go 版 `*_test.go` 1:1 移植，字段类型完整移植所有 case，红灯立即修复不允许 skip
- **DB 测试**: 使用 `bun:sqlite` 内存数据库 + 初始化系统表，执行真实 SQL，禁止 Mock
