# Implementation Plan: Pocketless — Bun.js 版 PocketBase

**Branch**: `032-pocketless` | **Date**: 2026-02-10 | **Spec**: `specs/032-pocketless/spec.md`  
**Input**: Feature specification from `/specs/032-pocketless/spec.md`  
**Status**: Ready for Dev

## Summary

使用 Bun.js + Hono + TypeScript 重新实现 PocketBase 的完整功能，实现 100% API 兼容、数据库表结构兼容和 SDK 兼容。采用与 Go 版一一对应的目录结构（~350 个文件），基于 Kysely 查询构建器、bun:sqlite/Bun.SQL 双数据库驱动、jose JWT 库，通过 `bun build --compile` 支持单二进制部署。

## Technical Context

**Language/Version**: TypeScript 5.x on Bun 1.x runtime  
**Primary Dependencies**: Hono (HTTP), Kysely (Query Builder), jose (JWT), arctic (OAuth2), croner (Cron), Commander.js (CLI), Zod (Validation), nodemailer (Email), @aws-sdk/client-s3 (S3)  
**Storage**: SQLite (bun:sqlite, 默认) + PostgreSQL (Bun.SQL)  
**Testing**: bun:test + 真实数据库（禁止 Mock）  
**Target Platform**: Linux/macOS/Windows — Bun 支持的所有平台  
**Project Type**: single — 独立的后端服务项目  
**Performance Goals**: API 延迟 ≤ 1.5x Go 版，启动 ≤ 50ms  
**Constraints**: 100% API/DB/SDK/Admin UI 兼容 Go 版，单二进制 ≤ 100MB  
**Scale/Scope**: ~350 个 TypeScript 文件，59 个 FR，17 个 User Stories

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

> Constitution 文件为空模板，无具体约束门。以下基于项目 `ARCH_RULES.md` 和 `PM_RULES.md` 中的隐含原则进行检查。

| Gate | Status | Notes |
|------|--------|-------|
| 100% API 兼容 | ✅ PASS | spec.md 明确要求，FR-016~FR-020 覆盖所有 40+ 端点 |
| 100% DB 兼容 | ✅ PASS | FR-057~FR-059 定义互操作要求，data-model.md 对齐所有系统表 |
| 双数据库支持 | ✅ PASS | FR-003 (SQLite) + FR-004 (PostgreSQL)，DBAdapter 抽象层设计 |
| TDD 流程 | ✅ PASS | NFR-008 要求 ≥ 80% 覆盖率，Testing Strategy 定义 5 层测试 + Go 1:1 移植策略 |
| 插件零开销 | ✅ PASS | NFR-010 要求未注册插件时 0 额外内存/路由 |
| 单二进制部署 | ✅ PASS | FR-056 + SC-010，通过 `bun build --compile` 实现 |
| PostgreSQL 测试禁止 Mock | ✅ PASS | Testing Strategy 明确要求真实数据库 |

**结论**: 无门禁违规，可进入 Phase 0。

## Project Structure

### Documentation (this feature)

```text
specs/032-pocketless/
├── plan.md              # This file
├── research.md          # Phase 0 output — 技术研究与决策
├── data-model.md        # Phase 1 output — 数据模型设计
├── quickstart.md        # Phase 1 output — 快速开始指南
├── contracts/           # Phase 1 output — API 契约
│   └── pocketless-api.yaml
├── spec.md              # Feature specification
├── design.md            # 完整技术设计文档
├── old.spec.md          # 旧版 spec（存档）
└── checklists/
    └── requirements.md  # 需求质量清单
```

### Source Code (repository root)

```text
pocketless/                         # 独立仓库（或 monorepo 子目录）
├── src/
│   ├── pocketless.ts               # 入口 — PocketLess 类
│   ├── core/                       # ~84 个文件
│   │   ├── app.ts                  # App 接口
│   │   ├── base.ts                 # BaseApp 实现
│   │   ├── events.ts               # 事件类型
│   │   ├── collection_model.ts     # Collection 模型
│   │   ├── record_model.ts         # Record 模型
│   │   ├── db.ts                   # CRUD + Hook 链
│   │   ├── db_adapter.ts           # DBAdapter 接口
│   │   ├── db_adapter_sqlite.ts    # SQLite 适配器
│   │   ├── db_adapter_postgres.ts  # PostgreSQL 适配器
│   │   ├── db_builder.ts           # QueryBuilder
│   │   ├── field.ts                # Field 接口 + 17 种实现
│   │   ├── field_*.ts              # 每种字段一个文件
│   │   ├── record_field_resolver.ts # 字段解析器
│   │   ├── migrations_runner.ts    # 迁移运行器
│   │   └── ...
│   ├── apis/                       # 38 个文件
│   │   ├── base.ts                 # createRouter()
│   │   ├── serve.ts                # Bun.serve() 启动
│   │   ├── record_crud.ts          # Record CRUD
│   │   ├── record_auth_*.ts        # 认证流程
│   │   ├── middlewares*.ts         # 中间件
│   │   └── ...
│   ├── tools/                      # 21 子目录 ~97 个文件
│   │   ├── auth/                   # 35+ OAuth2 提供商
│   │   ├── hook/                   # Hook 系统
│   │   ├── search/                 # 搜索/过滤引擎
│   │   ├── router/                 # HTTP 路由
│   │   ├── security/               # 加密/JWT
│   │   ├── subscriptions/          # SSE Broker
│   │   └── ...
│   ├── migrations/                 # 12 个文件
│   ├── plugins/                    # 10 子目录 ~110 个文件
│   │   ├── secrets/                # 密钥管理
│   │   ├── jobs/                   # 任务队列
│   │   ├── gateway/                # API 代理
│   │   ├── kv/                     # KV 存储
│   │   ├── analytics/              # 行为分析
│   │   ├── metrics/                # 系统监控
│   │   ├── trace/                  # 分布式追踪
│   │   ├── processman/             # 进程管理
│   │   ├── migratecmd/             # 迁移 CLI
│   │   └── ghupdate/               # GitHub 更新
│   ├── forms/                      # 4 个文件
│   ├── mails/                      # 2 个文件
│   └── cmd/                        # 2 个文件
├── tests/                          # 测试数据/fixtures
├── package.json
├── tsconfig.json
└── bunfig.toml
```

**Structure Decision**: 采用 Single Project 结构，`src/` 目录与 Go 版一一对应。测试文件采用 co-located 模式（`xxx.test.ts` 与 `xxx.ts` 同目录），不使用独立 `tests/` 目录存放单元测试。`tests/` 仅存放共享 fixtures 和测试数据。

---

## Implementation Phases

### Phase 1: 核心骨架（4-6 周）

**目标**: 建立可运行的最小框架——启动→连接数据库→创建系统表→提供健康检查

**任务**:

1. **项目脚手架** — package.json, tsconfig.json, bunfig.toml, 目录结构
2. **tools/hook** — Hook/TaggedHook 实现（洋葱模型、优先级、标签过滤）
3. **tools/types** — DateTime, GeoPoint, JSONArray, JSONMap, JSONRaw, Vector
4. **tools/security** — crypto, encrypt (AES-256-GCM), jwt (jose), random
5. **tools/store** — 并发安全 KV Store
6. **core/db_adapter** — DBAdapter 接口 + SQLiteAdapter + PostgresAdapter
7. **core/db_builder** — QueryBuilder 封装（基于 Kysely）
8. **core/app + core/base** — App 接口 + BaseApp 实现（80+ Hook、Store、Cron 等）
9. **core/models** — BaseModel, Collection, Record（含字段修饰符）
10. **core/fields** — 17 种字段类型实现
11. **core/db** — CRUD (Save/Delete/Validate + Hook 链)
12. **core/migrations** — 迁移运行器 + 12 个系统迁移
13. **cmd/** — CLI: serve, superuser, migrate
14. **apis/health + apis/serve** — 健康检查 + Bun.serve() 启动

**验收标准**:
- `bun run serve` 启动成功，创建 SQLite 数据库和所有系统表
- `GET /api/health` 返回 200
- 系统迁移与 Go 版 `_migrations` 表记录格式兼容

---

### Phase 2: API 层（4-6 周）

**目标**: 实现完整的 REST API，通过 JS SDK 集成测试验证

**任务**:

1. **tools/search** — 移植 fexpr 过滤表达式解析器、FieldResolver
2. **tools/router** — HTTP 路由封装（适配 Hono）
3. **tools/subscriptions** — SSE Broker + Client
4. **apis/middlewares** — 10 个核心中间件
5. **apis/collection** — Collection CRUD + Import + Truncate
6. **apis/record_crud** — Record CRUD（含搜索/过滤/排序/展开/字段选择）
7. **apis/record_auth_*** — 5 种认证流程（密码、OAuth2、OTP、MFA、Impersonation）
8. **tools/auth** — 35+ OAuth2 提供商（基于 arctic）
9. **apis/realtime** — SSE 实时订阅
10. **apis/file** — 文件上传/下载/缩略图
11. **tools/filesystem** — 本地 + S3 存储
12. **apis/batch** — Batch API（事务性多操作）
13. **apis/logs + apis/cron** — 日志 + Cron API
14. **apis/backup** — 备份 CRUD + 恢复
15. **apis/settings** — Settings API
16. **core/settings_model** — Settings 序列化/反序列化
17. **mails/** — 邮件发送（verification, passwordReset, emailChange）
18. **forms/** — Apple client secret, Record upsert, Test email/S3

**验收标准**:
- 所有 40+ API 端点返回正确响应
- JS SDK 连接 Pocketless 执行 CRUD 测试通过
- 过滤表达式与 Go 版输出一致

---

### Phase 3: 插件（2-4 周）

**目标**: 实现所有 9 个插件，与 Go 版功能对齐

**任务**:

1. **plugins/secrets** — 密钥管理（AES-256-GCM 加解密互通）
2. **plugins/jobs** — 任务队列（Worker、重试、崩溃恢复）
3. **plugins/gateway** — API 代理（转发、熔断、限流）
4. **plugins/kv** — KV 存储（L1 缓存 + L2 数据库）
5. **plugins/analytics** — 行为分析（事件缓冲、去重、聚合）
6. **plugins/metrics** — 系统监控（CPU、内存、延迟）
7. **plugins/trace** — 分布式追踪（染色、过滤器）
8. **plugins/processman** — 进程管理
9. **plugins/migratecmd** — 迁移 CLI 命令 + 自动迁移
10. **plugins/ghupdate** — GitHub 自更新

**验收标准**:
- 每个插件独立注册/注销，未注册时零开销
- Go 版加密数据可被 Pocketless 正确解密
- 插件 API 路由与 Go 版一致

---

### Phase 4: 集成验证（2-3 周）

**目标**: 端到端验证兼容性、性能和部署

**任务**:

1. **JS SDK 集成测试** — 使用官方 SDK 连接 Pocketless 运行完整测试套件
2. **API 兼容性测试** — 移植 Go 版 API 测试用例，逐端点对比响应
3. **Go ↔ Bun 互操作测试** — Go 写入 → Pocketless 读取，反之亦然
4. **Admin UI 集成** — 嵌入 webui/ 构建产物，验证 `/_/` 加载
5. **性能基准测试** — CRUD 延迟、SSE 并发、启动时间对比
6. **单二进制编译** — `bun build --compile`，验证无运行时机器部署
7. **PostgreSQL 集成测试** — 全套测试在 PG 下执行

**验收标准**:
- SC-001~SC-010 全部达标
- Go 版数据库双向互操作无损
- 编译产物可在无 Bun 运行时的机器上运行

---

### Phase 5: 测试补全 — Go 测试 1:1 移植（4-6 周）

**目标**: 为 71 个未测试源文件补充完整单测，对照 Go 版 `*_test.go`（67,972 行）1:1 移植

**策略**（来自 Clarifications Session 2026-02-11）:
- 按 Go 版 test case 完整移植，包括边界值、nil/空值、类型转换、验证错误信息
- 字段类型测试不可简化，必须完整移植 Go 版所有 case
- 红灯必须立即修复实现代码，不允许使用 `test.skip`
- 数据库依赖模块使用 `bun:sqlite` 内存库 + 初始化系统表

**任务**:

1. **core/ 字段类型** (17 个 field_*.test.ts) — 对照 Go 版 ~8,300 行字段测试
2. **core/ 模型与查询** (5 个 *_model.test.ts + *_query.test.ts) — 对照 Go 版 ~6,700 行
3. **core/ 基础设施** (10 个: db, base, events, fields, app, db_adapter*, db_builder, log_query, record_expand) — 对照 Go 版 ~4,500 行
4. **apis/** (9 个: collection, record_crud, settings, health, errors, base, serve, logs, cron) — 对照 Go 版 ~19,456 行
5. **plugins/** (10 个独立 register.test.ts) — 对照 Go 版插件测试
6. **tools/forms/mails/cmd/** (19 个: hook, security, store, types, validation, filesystem, forms, cmd, pocketless)

**验收标准**:
- 所有 71 个源文件有对应 `.test.ts`
- 字段类型 Go 版所有 test case 100% 移植
- 全量 `bun test` 通过（0 fail）
- 非 UI 代码覆盖率 ≥ 80%

---

## Key Design Decisions

### 1. Kysely 而非 Drizzle

| 维度 | Kysely | Drizzle |
|------|--------|---------|
| Schema 模式 | 动态（运行时定义） | 静态（编译时定义） |
| PocketBase 适配 | ✅ Collection 动态 schema | ❌ 需要 codegen |
| API 兼容 | 与 Go 版 dbx 风格相似 | 完全不同的 API |
| 多方言 | ✅ SQLite + PostgreSQL | ✅ 支持 |

**Decision**: Kysely — 因为 PocketBase 的 Collection/Field 系统是动态 schema。

### 2. bun:sqlite 而非 better-sqlite3

| 维度 | bun:sqlite | better-sqlite3 |
|------|------------|----------------|
| 性能 | 3-6x 更快 | 基准线 |
| 依赖 | Bun 内置（零依赖） | 需要编译原生模块 |
| API | 同步 + 原生 WAL | 同步 |
| 编译 | `bun build --compile` 友好 | 原生模块打包困难 |

**Decision**: bun:sqlite — 零依赖、高性能、编译友好。

### 3. jose 而非 jsonwebtoken

| 维度 | jose | jsonwebtoken |
|------|------|-------------|
| 标准 | JOSE 标准完整实现 | 仅 JWT |
| 算法 | HS256, RS256, ES256, EdDSA... | 有限 |
| 安全 | 积极维护，无已知漏洞 | 曾有安全问题 |
| TypeScript | 原生 TS | @types 包 |

**Decision**: jose — PocketBase 使用 HS256，但需要完整的 JWT Claims 支持。

### 4. arctic 而非自实现 OAuth2

| 维度 | arctic | 自实现 |
|------|--------|--------|
| 提供商数量 | 50+ | 需要逐个实现 |
| 维护成本 | 社区维护 | 自己跟踪 API 变更 |
| 接口兼容 | 需要适配层 | 完全控制 |

**Decision**: arctic 作为基础，需要编写适配层对齐 Go 版的 `BaseProvider` 接口。

### 5. SQLite 写入策略

Go 版使用双连接（concurrent/nonconcurrent），但 bun:sqlite 是同步 API，不支持多连接并发。

**Decision**: 单 Database 实例 + 写入 Mutex。读取直接调用（bun:sqlite 内部处理 WAL 并发读），写入通过 Mutex 序列化。

---

## Dependencies

### External (npm)

| Package | Version | Purpose | Fallback |
|---------|---------|---------|----------|
| hono | ^4.x | HTTP 框架 | 无 |
| kysely | ^0.27 | 查询构建器 | raw SQL |
| jose | ^5.x | JWT 签发/验证 | node:crypto |
| arctic | ^3.x | OAuth2 提供商 | 自实现 |
| croner | ^8.x | Cron 调度 | 自实现 |
| commander | ^12.x | CLI | process.argv 解析 |
| zod | ^3.x | 验证 | 自实现 |
| nodemailer | ^6.x | SMTP 邮件 | sendmail |
| @aws-sdk/client-s3 | ^3.x | S3 存储 | 无 |
| sharp | ^0.33 | 图片处理/缩略图 | jimp |

### Internal (Bun Built-in)

| Module | Purpose |
|--------|---------|
| bun:sqlite | SQLite 数据库 |
| Bun.SQL | PostgreSQL 连接池 |
| Bun.password | bcrypt/argon2 哈希 |
| Bun.serve() | HTTP 服务器 |
| node:crypto | AES-256-GCM, 随机数 |
| node:fs | 文件系统操作 |
| node:path | 路径处理 |

---

## Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| SQLite WAL + PRAGMA 行为差异 | 中 | 高 | Phase 1 第一周编写 SQLite 兼容性测试集，覆盖 PRAGMA 设置、WAL checkpoint、busy_timeout |
| bcrypt 哈希格式不兼容 | 低 | 高 | Phase 1 早期验证 `Bun.password.verify()` 可验证 Go 版 bcrypt 输出 |
| fexpr 解析器移植语法差异 | 中 | 高 | Phase 2 移植 Go 版 fexpr 测试用例（200+ case），逐个验证 |
| Kysely 不支持某些查询模式 | 中 | 中 | 对特殊查询使用 `sql.raw()` fallback |
| `bun build --compile` 体积过大 | 中 | 低 | 排除开发依赖、tree shaking、按需引入 |
| SSE 高并发内存占用 | 中 | 中 | 实现与 Go 版一致的分块广播（150/chunk）和 5 分钟空闲超时 |
| OAuth2 提供商 API 变更 | 低 | 中 | 使用 arctic 库，跟踪上游更新 |
| AES-256-GCM 实现不兼容 | 低 | 高 | Phase 1 编写加解密互通测试，Go 加密 → Bun 解密、反之亦然 |

---

## Timeline

| Phase | Duration | Deliverable | Dependencies |
|-------|----------|-------------|-------------|
| Phase 1: 核心骨架 | 4-6 周 | App、DB、Models、Fields、Hook、迁移、CLI | — |
| Phase 2: API 层 | 4-6 周 | CRUD、Auth、Search、SSE、File、Batch、中间件 | Phase 1 |
| Phase 3: 插件 | 2-4 周 | 9 个插件完整实现 | Phase 2 |
| Phase 4: 集成验证 | 2-3 周 | SDK 测试、Admin UI、互操作、性能、编译 | Phase 3 |
| Phase 5: 测试补全 | 4-6 周 | 71 个文件 Go 测试 1:1 移植 + 覆盖率 ≥ 80% | Phase 4 |
| **Total** | **16-25 周** | | |

## Complexity Tracking

> No constitution violations to justify.

| Aspect | Complexity | Justification |
|--------|-----------|---------------|
| ~350 个文件 | 高 | 与 Go 版一一对应是核心需求（NFR-009），非过度工程 |
| 双数据库适配器 | 中 | Go 版同样支持，DBAdapter 抽象层是最简设计 |
| 35+ OAuth2 提供商 | 高 | Go 版已有，使用 arctic 库降低实现成本 |
| 插件系统 (9 个) | 中 | 采用统一 register() 模式，Go 版已验证的架构 |
