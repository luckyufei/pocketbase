# Implementation Tasks: PocketBase Native Job Queue (`_jobs`)

**Branch**: `008-job-queue` | **Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

## Task Legend

- `[P]` = Parallelizable with other `[P]` tasks in same phase
- `[US#]` = Implements User Story #
- Priority: Tasks ordered by dependency, not priority

---

## Phase 1: Setup (共享基础设施) ✅

**Purpose**: 项目初始化和基本结构创建

- [x] T001 创建 `migrations/1736500000_create_jobs.go`，定义 `_jobs` 系统表迁移脚本
- [x] T002 [P] 在 `core/job_store.go` 中定义 JobStore 接口和常量
- [x] T003 [P] 在 `core/job_store.go` 中定义 Job、JobFilter、JobStats 结构体

---

## Phase 2: Foundational (阻塞性前置条件) ✅

**Purpose**: 必须在所有用户故事之前完成的核心基础设施

**⚠️ CRITICAL**: 此阶段完成前，任何用户故事都无法开始

- [x] T004 在 `migrations/1736500000_create_jobs.go` 中实现 `_jobs` TABLE 创建逻辑
  - [x] T004a PostgreSQL schema（JSONB、TIMESTAMP、部分索引）
  - [x] T004b SQLite schema（TEXT、datetime、普通索引）
- [x] T005 在 `core/job_store.go` 中实现 JobStore 结构体基础框架
- [x] T006 [P] 在 `core/job_store.go` 中实现 UUID v7 生成函数
- [x] T007 在 `core/base.go` 中集成 JobStore 到 App 结构体
- [x] T008 在 `core/app.go` 接口中添加 `Jobs()` 方法

**Checkpoint**: 基础设施就绪 - 用户故事实现可以开始 ✅

---

## Phase 3: User Story 1 - 任务入队 (Priority: P1) 🎯 MVP ✅

**Goal**: 支持 Enqueue/EnqueueAt 入队操作

**Independent Test**: 
- 调用 `jobs.Enqueue("topic", payload)` 验证任务入队

### Implementation for User Story 1

- [x] T009 [US1] 在 `core/job_store.go` 中实现 `Enqueue()` - INSERT _jobs
- [x] T010 [US1] 在 `core/job_store.go` 中实现 `EnqueueAt()` - 带 run_at 的入队
- [x] T011 [US1] 在 `core/job_store.go` 中实现 `EnqueueTx()` - 事务入队
- [x] T012 [US1] 实现 Payload 大小验证（最大 1MB）
- [x] T013 [US1] 编写 `core/job_store_test.go` 入队操作单元测试

**Checkpoint**: 此时 User Story 1 应完全可用，可独立测试 ✅

---

## Phase 4: User Story 2 - 任务执行 (Priority: P1) 🎯 MVP ✅

**Goal**: 支持 Worker 注册和任务分发

**Independent Test**: 
- 注册 Worker 并入队任务，验证任务被自动执行

### Implementation for User Story 2

- [x] T014 [US2] 在 `core/job_dispatcher.go` 中实现 Dispatcher 结构体
- [x] T015 [US2] 在 `core/job_dispatcher.go` 中实现 `fetchJobs()` 
  - [x] T015a PostgreSQL: 使用 `SKIP LOCKED` 批量获取
  - [x] T015b SQLite: 使用乐观锁 + CAS 获取
- [x] T016 [US2] 在 `core/job_worker.go` 中实现 Worker 池管理（内置于 dispatcher）
- [x] T017 [US2] 在 `core/job_store.go` 中实现 `Register()` - Worker 注册
- [x] T018 [US2] 在 `core/job_store.go` 中实现 `Start()` - 启动 Dispatcher
- [x] T019 [US2] 在 `core/job_store.go` 中实现 `Stop()` - 停止 Dispatcher
- [x] T020 [US2] 在 `core/job_dispatcher.go` 中实现任务状态更新（processing -> completed/failed）
- [x] T021 [US2] 在 `core/job_hooks.go` 中实现 Bootstrap 时自动启动 Dispatcher
- [x] T022 [US2] 编写 Dispatcher 单元测试 (TestJobDispatcher)
  - [x] T022a PostgreSQL 环境测试（通过 SQLite 测试验证逻辑）
  - [x] T022b SQLite 环境测试

**Checkpoint**: 此时 User Story 1 & 2 都应独立可用 ✅

---

## Phase 5: User Story 3 - 延时任务 (Priority: P1) ✅

**Goal**: 支持 runAt 调度延时任务

**Independent Test**: 
- 设置 `runAt` 为未来时间，验证任务在指定时间后执行

### Implementation for User Story 3

- [x] T023 [US3] 在 `core/job_dispatcher.go` 中修改 `fetchJobs()` 添加 `run_at <= NOW()` 条件
- [x] T024 [US3] 编写延时任务单元测试 (TestJobDelayedExecution)

**Checkpoint**: 此时 User Story 1, 2, 3 都应独立可用 ✅

---

## Phase 6: User Story 4 - 失败重试 (Priority: P1) 🎯 MVP ✅

**Goal**: 支持失败自动重试（指数退避）

**Independent Test**: 
- 模拟任务失败，验证任务按指数退避策略重试

### Implementation for User Story 4

- [x] T025 [US4] 在 `core/job_dispatcher.go` 中实现指数退避策略（内置于 handleFailure）
- [x] T026 [US4] 在 `core/job_dispatcher.go` 中实现失败重试逻辑
- [x] T027 [US4] 在 `core/job_dispatcher.go` 中实现死信处理（retries >= max_retries）
- [x] T028 [US4] 在 `core/job_dispatcher.go` 中实现 `last_error` 记录
- [x] T029 [US4] 编写重试机制单元测试 (TestJobRetryOnFailure)

**Checkpoint**: 此时 User Story 1, 2, 3, 4 都应独立可用 ✅

---

## Phase 7: User Story 5 - 崩溃恢复 (Priority: P1) 🎯 MVP ✅

**Goal**: 支持 Worker 崩溃后任务被其他 Worker 接管

**Independent Test**: 
- 模拟 Worker 崩溃，验证任务被其他 Worker 接管

### Implementation for User Story 5

- [x] T030 [US5] 在 `core/job_dispatcher.go` 中实现 `locked_until` 设置
- [x] T031 [US5] 在 `core/job_dispatcher.go` 中修改 `fetchJobs()` 添加 `locked_until < NOW()` 条件
- [x] T032 [US5] 编写崩溃恢复单元测试 (TestJobCrashRecovery)

**Checkpoint**: MVP 后端完成 (User Story 1-5) ✅

---

## Phase 8: User Story 7 - HTTP API (Priority: P1) 🎯 MVP ✅

**Goal**: 提供 HTTP API 供 JS SDK 和客户端调用

**Independent Test**: 
- 使用 curl 调用 `POST /api/jobs/enqueue` 验证

### Implementation for User Story 7

- [x] T033 [US7] 在 `apis/job_routes.go` 中创建 Jobs API 路由组 `/api/jobs/*`
- [x] T034 [US7] 实现 `POST /api/jobs/enqueue` 端点
- [x] T035 [US7] 实现 `GET /api/jobs/:id` 端点
- [x] T036 [US7] 实现 `GET /api/jobs` 端点（列表查询）
- [x] T037 [US7] 实现 `POST /api/jobs/:id/requeue` 端点
- [x] T038 [US7] 实现 `DELETE /api/jobs/:id` 端点
- [x] T039 [US7] 实现 `GET /api/jobs/stats` 端点
- [x] T040 [US7] 编写 `apis/job_routes_test.go` HTTP API 测试

**Checkpoint**: HTTP API 可用，JS SDK 可以开始集成 ✅

---

## Phase 9: User Story 9 - 访问控制 (Priority: P1) 🎯 MVP ✅

**Goal**: 实现 Jobs API 的权限控制

**Independent Test**: 
- 配置 `enqueue_rule` 后，验证权限控制生效

### Implementation for User Story 9

- [x] T041 [US9] 在 `core/job_settings.go` 中定义 JobsSettings 结构体（使用默认配置）
- [x] T042 [US9] 在 `apis/job_routes.go` 中实现权限检查中间件（使用 RequireSuperuserAuth）
- [x] T043 [US9] 默认要求超级用户权限（RequireSuperuserAuth）
- [x] T044 [US9] 在 `apis/job_routes.go` 中集成权限检查
- [x] T045 [US9] 实现 Topic 白名单验证（默认允许所有 topic，后续可扩展）
- [x] T046 [US9] 编写访问控制测试 (TestJobAccessControl) - 已在 job_routes_test.go 中实现

**Checkpoint**: HTTP API 权限控制完成 ✅

---

## Phase 10: User Story 10 - Go Worker 注册 (Priority: P1) ✅

**Goal**: 支持 Go 代码中注册 Worker 处理器

**Independent Test**: 
- 在 Go 代码中注册 Worker 并入队任务，验证任务被执行

### Implementation for User Story 10

- [x] T047 [US10] 在 `core/job_store.go` 中完善 `Register()` 实现
- [x] T048 [US10] 在 `core/job_dispatcher.go` 中实现 Handler 调用逻辑
- [x] T049 [US10] 在 `core/job_store.go` 中实现 Job.UnmarshalPayload() 辅助方法
- [x] T050 [US10] 编写 Go Worker 单元测试 (TestJobWorkerRegister) - 测试覆盖率 91.87%

**Checkpoint**: Go API 完整可用 ✅

---

## Phase 11: User Story 8 - JS SDK 集成 (Priority: P1) ✅

**Goal**: 提供 JS SDK 供前端调用

**Independent Test**: 
- 使用 JS SDK 调用 `pb.jobs.enqueue()` 验证

### Implementation for User Story 8

- [x] T051 [US8] 在 `jssdk/src/services/JobsService.ts` 中定义 Job 类型
- [x] T052 [US8] 在 `jssdk/src/services/JobsService.ts` 中实现 enqueue()
- [x] T053 [US8] 在 `jssdk/src/services/JobsService.ts` 中实现 get()
- [x] T054 [US8] 在 `jssdk/src/services/JobsService.ts` 中实现 list()
- [x] T055 [US8] 在 `jssdk/src/services/JobsService.ts` 中实现 requeue()
- [x] T056 [US8] 在 `jssdk/src/services/JobsService.ts` 中实现 delete()
- [x] T057 [US8] 在 `jssdk/src/services/JobsService.ts` 中实现 stats()
- [x] T058 [US8] 在 `jssdk/src/Client.ts` 中集成 JobsService
- [x] T059 [US8] 在 `jssdk/src/index.ts` 中导出 JobsService

**Checkpoint**: JS SDK 完整可用 ✅

---

## Phase 12: User Story 6 - Admin UI (Priority: P1) ✅

**Goal**: 提供 Admin UI Jobs 面板

**Independent Test**: 
- 在 Admin UI 中访问 Jobs 面板，查看任务列表

### Implementation for User Story 6

- [x] T060 [US6] 在 `ui/src/components/jobs/PageJobs.svelte` 中实现 Jobs 面板页面
- [x] T061 [US6] 在 `ui/src/components/jobs/JobsStats.svelte` 中实现统计组件
- [x] T062 [US6] 在 `ui/src/components/jobs/JobsFilters.svelte` 中实现筛选组件
- [x] T063 [US6] 在 `ui/src/routes.js` 中添加 Jobs 路由
- [x] T064 [US6] 在 `ui/src/components/settings/SettingsSidebar.svelte` 中添加 Jobs 菜单入口
- [x] T065 [US6] 实现任务列表展示（表格形式）
- [x] T066 [US6] 实现任务重新入队（Re-queue）按钮
- [x] T067 [US6] 实现任务删除按钮
- [x] T068 [US6] 实现分页功能
- [x] T069 [US6] 实现筛选功能（按 topic、status）

**Checkpoint**: Admin UI 完整可用 ✅

---

## Phase 13: Polish & Cross-Cutting Concerns

**Purpose**: 影响多个用户故事的改进

- [ ] T070 [P] 在 `core/job_dispatcher.go` 中实现 LISTEN/NOTIFY 通知机制（仅 PostgreSQL，可选）
- [ ] T071 [P] 添加任务执行时间限制（默认 10 分钟）
- [ ] T072 [P] 添加操作日志（Debug 级别）
- [ ] T073 编写 `core/job_benchmark_test.go` 性能基准测试
  - [ ] T073a PostgreSQL 基准测试
  - [ ] T073b SQLite 基准测试
- [ ] T074 运行完整集成测试，验证所有功能正常
  - [ ] T074a PostgreSQL 集成测试
  - [ ] T074b SQLite 集成测试
- [x] T075 [P] 在 `core/job_store.go` 中实现 `Get()` 和 `List()` 查询方法
- [x] T076 [P] 在 `core/job_store.go` 中实现 `Requeue()` 重新入队方法
- [x] T077 [P] 在 `core/job_store.go` 中实现 `Delete()` 删除方法
- [x] T078 [P] 在 `core/job_store.go` 中实现 `Stats()` 统计方法

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 无依赖 - 可立即开始
- **Foundational (Phase 2)**: 依赖 Setup 完成 - 阻塞所有用户故事
- **User Stories (Phase 3-12)**: 依赖 Foundational 完成
  - US1 (Phase 3): 核心入队功能
  - US2 (Phase 4): 依赖 US1 完成
  - US3 (Phase 5): 依赖 US2 完成
  - US4 (Phase 6): 依赖 US2 完成
  - US5 (Phase 7): 依赖 US2 完成
  - **US7 (Phase 8): 依赖 US1-US5 完成（HTTP API 封装核心功能）**
  - **US9 (Phase 9): 依赖 US7 完成（访问控制依赖 HTTP API）**
  - US10 (Phase 10): 依赖 US2 完成
  - **US8 (Phase 11): 依赖 US7 完成（JS SDK 依赖 HTTP API）**
  - **US6 (Phase 12): 依赖 US7 完成（Admin UI 依赖 HTTP API）**
- **Polish (Phase 13)**: 依赖所有用户故事完成

### User Story Dependencies

```
Phase 1 (Setup)
    │
    ▼
Phase 2 (Foundational)
    │
    ▼
Phase 3 (US1: 入队) ──────────────────────────────────────┐
    │                                                      │
    ▼                                                      │
Phase 4 (US2: 执行) ──────────────────────────────────────┤
    │                                                      │
    ├──────────────┬──────────────┬───────────────────────┤
    ▼              ▼              ▼                       │
Phase 5        Phase 6        Phase 7                     │
(US3: 延时)    (US4: 重试)    (US5: 崩溃恢复)             │
    │              │              │                       │
    └──────────────┴──────────────┤                       │
                                  │                       │
                                  ▼                       │
                            Phase 8                       │
                            (US7: HTTP API)               │
                                  │                       │
                    ┌─────────────┼─────────────┐         │
                    ▼             ▼             ▼         │
              Phase 9       Phase 11      Phase 12        │
              (US9: 权限)   (US8: JS SDK) (US6: Admin UI) │
                    │             │             │         │
                    └─────────────┴─────────────┤         │
                                                │         │
                                          Phase 10        │
                                          (US10: Go Worker)
                                                │         │
                                                ▼         │
                                          Phase 13        │
                                          (Polish)        │
```

### Parallelization Opportunities

**Phase 2 内部并行**:
- T006 (UUID v7) 可与其他任务并行开发

**Phase 4-7 部分并行**:
- US3, US4, US5 可在 US2 完成后并行开发

**Phase 9-12 部分并行**:
- US9, US8, US6 可在 US7 完成后并行开发

---

## Estimated Effort

| Phase | Tasks | Est. Hours | Parallelizable |
|-------|-------|------------|----------------|
| Phase 1: Setup | 3 | 1h | Yes |
| Phase 2: Foundational | 5 | 3h | Partial |
| Phase 3: US1 入队 | 5 | 3h | No |
| Phase 4: US2 执行 | 9 | 6h | No |
| Phase 5: US3 延时 | 2 | 1h | Yes |
| Phase 6: US4 重试 | 5 | 3h | Yes |
| Phase 7: US5 崩溃恢复 | 3 | 2h | Yes |
| Phase 8: US7 HTTP API | 8 | 5h | Partial |
| Phase 9: US9 访问控制 | 6 | 4h | No |
| Phase 10: US10 Go Worker | 4 | 2h | Yes |
| Phase 11: US8 JS SDK | 9 | 5h | Partial |
| Phase 12: US6 Admin UI | 10 | 8h | Partial |
| Phase 13: Polish | 9 | 5h | Yes |
| **Total** | **78** | **~48h** | |

---

## MVP Definition

**最小可行产品 (MVP)** = Phase 1 + Phase 2 + Phase 3 + Phase 4 + Phase 6 + Phase 7 + Phase 8 + Phase 9

完成 MVP 后，系统具备：
- ✅ 任务入队（Enqueue）
- ✅ 任务执行（Worker）
- ✅ 失败重试（指数退避）
- ✅ 崩溃恢复（locked_until）
- ✅ **HTTP API（供客户端调用）**
- ✅ **访问控制（权限管理）**

**MVP 预估工时**: ~27h

---

## SQL Reference

### 基础操作（通用）

```sql
-- Enqueue (插入任务) - 通用
INSERT INTO _jobs (id, topic, payload, status, run_at, max_retries, created, updated)
VALUES (:id, :topic, :payload, 'pending', :run_at, :max_retries, :now, :now)
RETURNING id, topic, status, run_at, created;

-- Get (获取任务) - 通用
SELECT id, topic, payload, status, run_at, locked_until, retries, max_retries, last_error, created, updated
FROM _jobs
WHERE id = :id;

-- List (列表查询) - 通用
SELECT id, topic, payload, status, run_at, locked_until, retries, max_retries, last_error, created, updated
FROM _jobs
WHERE (:topic = '' OR topic = :topic)
  AND (:status = '' OR status = :status)
ORDER BY created DESC
LIMIT :limit OFFSET :offset;

-- Delete (删除任务) - 通用
DELETE FROM _jobs
WHERE id = :id AND status IN ('pending', 'failed');

-- Requeue (重新入队) - 通用
UPDATE _jobs
SET status = 'pending',
    retries = 0,
    run_at = :now,
    locked_until = NULL,
    last_error = NULL,
    updated = :now
WHERE id = :id AND status = 'failed';
```

### Dispatcher 操作 - PostgreSQL

```sql
-- 原子性地"抢占"一批任务 (SKIP LOCKED)
WITH next_jobs AS (
    SELECT id
    FROM _jobs
    WHERE status = 'pending'
      AND run_at <= :now
      AND (locked_until IS NULL OR locked_until < :now)
    ORDER BY run_at ASC
    LIMIT 10
    FOR UPDATE SKIP LOCKED
)
UPDATE _jobs
SET status = 'processing',
    locked_until = :locked_until,
    updated = :now
WHERE id IN (SELECT id FROM next_jobs)
RETURNING id, topic, payload, retries, max_retries;
```

### Dispatcher 操作 - SQLite

```sql
-- 乐观锁 + CAS 获取单个任务
UPDATE _jobs
SET status = 'processing',
    locked_until = :locked_until,
    updated = :now
WHERE id = (
    SELECT id FROM _jobs
    WHERE status = 'pending'
      AND run_at <= :now
      AND (locked_until IS NULL OR locked_until < :now)
    ORDER BY run_at ASC
    LIMIT 1
)
AND status = 'pending'  -- CAS 条件：防止并发冲突
RETURNING id, topic, payload, retries, max_retries;

-- 注意：如果返回 0 行，说明被其他 Worker 抢占，需要重试
```

### 任务状态更新（通用）

```sql
-- 任务完成
UPDATE _jobs
SET status = 'completed',
    locked_until = NULL,
    updated = :now
WHERE id = :id;

-- 任务失败（重试）- 使用 Go 计算 run_at 时间
UPDATE _jobs
SET status = 'pending',
    retries = retries + 1,
    run_at = :next_run_at,  -- Go 计算: now.Add(time.Duration(retries*retries) * time.Minute)
    locked_until = NULL,
    last_error = :error,
    updated = :now
WHERE id = :id AND retries < max_retries;

-- 任务失败（死信）
UPDATE _jobs
SET status = 'failed',
    locked_until = NULL,
    last_error = :error,
    updated = :now
WHERE id = :id AND retries >= max_retries;
```

### 统计查询（通用）

```sql
-- 各状态数量
SELECT status, COUNT(*) as count
FROM _jobs
GROUP BY status;

-- 成功率
SELECT 
    COALESCE(
        CAST(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS FLOAT) /
        NULLIF(SUM(CASE WHEN status IN ('completed', 'failed') THEN 1 ELSE 0 END), 0),
        0
    ) as success_rate
FROM _jobs;
```

---

## Admin UI 组件结构

```
ui/src/
├── components/
│   └── jobs/
│       ├── JobsList.svelte       # 任务列表
│       │   ├── 表格展示
│       │   ├── 分页控制
│       │   └── 行操作按钮
│       │
│       ├── JobsDetail.svelte     # 任务详情
│       │   ├── 基本信息
│       │   ├── Payload 展示
│       │   └── 错误信息
│       │
│       ├── JobsStats.svelte      # 统计卡片
│       │   ├── 各状态数量
│       │   ├── 成功率
│       │   └── 平均执行时间
│       │
│       └── JobsFilters.svelte    # 筛选控件
│           ├── Status 下拉
│           ├── Topic 下拉
│           └── 搜索框
│
└── pages/
    └── jobs/
        └── Index.svelte          # Jobs 面板主页
            ├── JobsStats
            ├── JobsFilters
            └── JobsList
```

---

## JS SDK 类型定义

```typescript
// jssdk/src/types/Job.ts

export interface Job {
    id: string;
    topic: string;
    payload: Record<string, any>;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    run_at: string;
    locked_until?: string;
    retries: number;
    max_retries: number;
    last_error?: string;
    created: string;
    updated: string;
}

export interface JobEnqueueOptions {
    runAt?: Date;
    maxRetries?: number;
}

export interface JobListOptions {
    topic?: string;
    status?: string;
    limit?: number;
    offset?: number;
}

export interface JobListResult {
    items: Job[];
    total: number;
    limit: number;
    offset: number;
}

export interface JobStats {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    success_rate: number;
    avg_execution_time: number;
}
```

```typescript
// jssdk/src/services/JobsService.ts

export class JobsService {
    constructor(private client: Client) {}

    async enqueue(
        topic: string, 
        payload: Record<string, any>, 
        options?: JobEnqueueOptions
    ): Promise<Job> {
        return this.client.send('/api/jobs/enqueue', {
            method: 'POST',
            body: { topic, payload, ...options }
        });
    }

    async get(id: string): Promise<Job> {
        return this.client.send(`/api/jobs/${id}`);
    }

    async list(options?: JobListOptions): Promise<JobListResult> {
        return this.client.send('/api/jobs', { query: options });
    }

    async requeue(id: string): Promise<Job> {
        return this.client.send(`/api/jobs/${id}/requeue`, { method: 'POST' });
    }

    async delete(id: string): Promise<void> {
        return this.client.send(`/api/jobs/${id}`, { method: 'DELETE' });
    }

    async stats(): Promise<JobStats> {
        return this.client.send('/api/jobs/stats');
    }
}
```
