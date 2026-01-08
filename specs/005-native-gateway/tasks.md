# Tasks: Native Gateway (`_proxies`)

**Input**: Design documents from `/specs/005-native-gateway/`
**Prerequisites**: plan.md, spec.md

**Tests**: 每个 Phase 完成后应编写对应的单元测试和集成测试。

**Organization**: 任务按用户故事分组，支持独立实现和测试。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行执行（不同文件，无依赖）
- **[Story]**: 所属用户故事 (US1, US2, US3, US4, US5)
- 包含精确文件路径

## Path Conventions

- **Backend (Go)**: `core/`, `apis/`, `cmd/`, `migrations/`

---

## Phase 1: Setup (共享基础设施) ✅ COMPLETED

**Purpose**: 项目初始化和基本结构创建

- [x] T001 创建 `migrations/1736300000_create_proxies.go`，定义 `_proxies` 系统表迁移脚本
- [x] T002 [P] 在 `core/proxy_model.go` 中定义 Proxy 数据结构和字段常量
- [x] T003 [P] 在 `core/proxy_manager.go` 中创建 ProxyManager 结构体骨架

---

## Phase 2: Foundational (阻塞性前置条件) ✅ COMPLETED

**Purpose**: 必须在所有用户故事之前完成的核心基础设施

- [x] T004 在 `migrations/1736300000_create_proxies.go` 中实现 `_proxies` 表创建逻辑（包含所有字段）
- [x] T005 在 `core/proxy_model.go` 中实现路径验证函数 `ValidatePath()`（禁止 `/api/`, `/_/`）
- [x] T006 [P] 在 `core/proxy_manager.go` 中实现路由表数据结构（按路径长度排序）
- [x] T007 [P] 在 `core/proxy_manager.go` 中实现 `LoadProxies()` 从数据库加载代理配置
- [x] T008 在 `core/proxy_hooks.go` 中实现 Hot Reload 钩子（监听 `_proxies` CRUD 事件）
- [x] T009 在 `core/base.go` 或 `core/app.go` 中集成 ProxyManager 到 App 结构体
- [x] T010 在 `apis/proxy_routes.go` 中注册动态代理路由处理器

**Checkpoint**: 基础设施就绪 ✅

---

## Phase 3: User Story 1 - 配置 API 代理路由 (Priority: P1) 🎯 MVP ✅ COMPLETED

**Goal**: 管理员可以在 Admin UI 配置代理，前端请求被正确转发到上游服务

**Independent Test**: 
- 创建代理 `/-/test` → `https://httpbin.org`
- 请求 `/-/test/get` 验证返回 httpbin 响应

### Implementation for User Story 1

- [x] T011 [US1] 在 `core/proxy_manager.go` 中实现 `MatchProxy()` 路径匹配函数（最长前缀匹配）
- [x] T012 [US1] 在 `core/proxy_manager.go` 中实现 `BuildUpstreamURL()` 构建上游 URL（处理 strip_path）
- [x] T013 [US1] 在 `core/proxy_manager.go` 中实现 `CreateReverseProxy()` 创建 httputil.ReverseProxy 实例
- [x] T014 [US1] 在 `core/proxy_manager.go` 中实现 `ServeHTTP()` 代理请求处理主函数
- [x] T015 [US1] 在 `core/proxy_manager.go` 中实现 timeout 配置和 504 超时处理
- [x] T016 [US1] 在 `core/proxy_manager.go` 中实现 Streaming 响应透传（设置 FlushInterval）
- [x] T017 [US1] 在 `apis/proxy_routes.go` 中实现 catch-all 路由注册（`/-/*` 和自定义路径）
- [x] T018 [US1] 编写 `core/proxy_manager_test.go` 单元测试

**Checkpoint**: User Story 1 完成 ✅

---

## Phase 4: User Story 2 - 基于 PB Rules 的访问控制 (Priority: P1) ✅ COMPLETED

**Goal**: 代理路由复用 PB Rule Engine 进行鉴权，空规则仅允许 Superuser 访问

**Independent Test**: 
- 配置 `access_rule = ""`，验证非管理员被拒绝
- 配置 `access_rule = "@request.auth.id != ''"`，验证未登录被拒绝

### Implementation for User Story 2

- [x] T019 [US2] 在 `core/proxy_auth.go` 中实现 `EvaluateAccessRule()` 规则评估函数
- [x] T020 [US2] 在 `core/proxy_auth.go` 中实现空规则 → 仅 Superuser 逻辑
- [x] T021 [US2] 在 `core/proxy_auth.go` 中实现 `"true"` → 公开访问逻辑
- [x] T022 [US2] 在 `core/proxy_auth.go` 中复用简化的规则匹配（@request.auth.id）
- [x] T023 [US2] 在 `apis/proxy_routes.go` 中集成鉴权检查
- [x] T024 [US2] 编写 `core/proxy_auth_test.go` 单元测试

**Checkpoint**: User Story 1 & 2 完成 ✅

---

## Phase 5: User Story 3 - 密钥自动注入 (Priority: P1) ✅ COMPLETED

**Goal**: 支持请求头模板，自动注入环境变量、_secrets 表值、用户上下文

**Independent Test**: 
- 配置 `headers = {"X-Test": "{env.TEST_VAR}"}`，验证上游收到正确值
- 配置 `headers = {"X-User": "@request.auth.id"}`，验证上游收到用户 ID

### Implementation for User Story 3

- [x] T025 [P] [US3] 在 `core/proxy_header.go` 中实现 `ParseHeaderTemplate()` 模板解析函数
- [x] T026 [P] [US3] 在 `core/proxy_header.go` 中实现 `{env.VAR_NAME}` 环境变量替换
- [x] T027 [P] [US3] 在 `core/proxy_header.go` 中实现 `{secret.VAR_NAME}` 从 `_secrets` 表读取（占位）
- [x] T028 [US3] 在 `core/proxy_header.go` 中实现 `@request.auth.*` 上下文变量替换
- [x] T029 [US3] 在 `core/proxy_header.go` 中实现变量不存在时的错误处理
- [x] T030 [US3] 在 `core/proxy_manager.go` 的 `ServeHTTPWithAuth()` 中集成请求头注入
- [x] T031 [US3] 编写 `core/proxy_header_test.go` 单元测试

**Checkpoint**: MVP 完成 ✅ (User Story 1, 2, 3)

---

## Phase 6: User Story 4 - 路由保护与冲突检测 (Priority: P2) ✅ COMPLETED

**Goal**: 阻止创建以 `/api/` 或 `/_/` 开头的代理路径

**Independent Test**: 
- 尝试创建 `path = "/api/test"`，验证返回 400 错误
- 尝试创建 `path = "/-/test"`，验证保存成功

### Implementation for User Story 4

- [x] T032 [US4] 在 `core/proxy_model.go` 中完善 `ValidatePath()` 验证逻辑
- [x] T033 [US4] 在 `core/proxy_hooks.go` 中注册 `OnRecordValidate` 钩子进行验证
- [x] T034 [US4] 验证逻辑已集成到 hooks 中
- [x] T035 [US4] 编写 `core/proxy_model_test.go` 验证逻辑单元测试

**Checkpoint**: User Story 1, 2, 3, 4 完成 ✅

---

## Phase 7: User Story 5 - 开发代理模式 (Priority: P3) ✅ COMPLETED

**Goal**: 支持 `--dev-proxy` 启动参数，将未匹配请求代理到 Vite 开发服务器

**Independent Test**: 
- 使用 `--dev-proxy="http://localhost:5173"` 启动
- 请求 `/index.html` 验证被代理到 Vite

### Implementation for User Story 5

- [x] T036 [US5] `SetDevProxy()` 已在 `core/proxy_manager.go` 中实现
- [x] T037 [US5] `serveDevProxy()` 已在 `core/proxy_manager.go` 中实现
- [x] T038 [US5] 在 `cmd/serve.go` 中添加 `--dev-proxy` 命令行参数解析
- [x] T039 [US5] 在 `apis/proxy_routes.go` 中实现 fallback 路由（最低优先级）
- [x] T040 [US5] 编写开发代理集成测试

**Checkpoint**: User Story 5 完成 ✅

---

## Phase 8: Polish & Cross-Cutting Concerns ✅ COMPLETED

**Purpose**: 影响多个用户故事的改进

- [x] T041 [P] 在 `core/proxy_manager.go` 中添加请求/响应日志（不打印敏感 headers）
- [ ] T042 [P] 在 `core/proxy_manager.go` 中添加 Prometheus 指标（可选，未实现）
- [x] T043 在 `apis/proxy_routes.go` 中添加 `active=false` 时返回 404 逻辑
- [x] T044 [P] 在 `core/proxy_manager.go` 中添加上游错误响应透传逻辑
- [x] T045 运行完整集成测试，验证所有功能正常

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 无依赖 - 可立即开始
- **Foundational (Phase 2)**: 依赖 Setup 完成 - 阻塞所有用户故事
- **User Stories (Phase 3-7)**: 依赖 Foundational 完成
  - US1 (Phase 3): 核心代理功能
  - US2 (Phase 4): 依赖 US1 完成（需要代理基础）
  - US3 (Phase 5): 依赖 US1 完成（需要代理基础）
  - US4 (Phase 6): 可与 US2, US3 并行
  - US5 (Phase 7): 依赖 US1 完成
- **Polish (Phase 8)**: 依赖所有用户故事完成

### User Story Dependencies

```
Phase 1 (Setup)
    │
    ▼
Phase 2 (Foundational)
    │
    ▼
Phase 3 (US1: 代理路由) ──────────────────┐
    │                                      │
    ├──────────────┬──────────────┐        │
    ▼              ▼              ▼        │
Phase 4        Phase 5        Phase 6      │
(US2: 鉴权)    (US3: 密钥)    (US4: 验证)  │
    │              │              │        │
    └──────────────┴──────────────┘        │
                   │                       │
                   ▼                       │
              Phase 7 (US5: Dev Proxy) ◄───┘
                   │
                   ▼
              Phase 8 (Polish)
```

### Parallel Opportunities

- T002, T003 可并行
- T006, T007 可并行
- T025, T026, T027 可并行
- T041, T042, T044 可并行

---

## Implementation Strategy

### MVP First (User Story 1, 2, 3)

1. 完成 Phase 1: Setup
2. 完成 Phase 2: Foundational (关键 - 阻塞所有故事)
3. 完成 Phase 3: User Story 1 (代理路由)
4. 完成 Phase 4: User Story 2 (访问控制)
5. 完成 Phase 5: User Story 3 (密钥注入)
6. **停止并验证**: 独立测试代理、鉴权、密钥注入
7. 可部署/演示 MVP

### Incremental Delivery

1. Setup + Foundational → 基础就绪
2. 添加 US1 → 独立测试 → 部署/演示 (基础代理)
3. 添加 US2 + US3 → 独立测试 → 部署/演示 (安全代理 - **MVP!**)
4. 添加 US4 → 独立测试 → 部署/演示 (路由保护)
5. 添加 US5 → 独立测试 → 部署/演示 (开发体验)
6. 每个故事增加价值而不破坏之前的功能

---

## Estimated Effort

| Phase | Tasks | Estimated Hours |
|-------|-------|-----------------|
| Phase 1: Setup | 3 | 2h |
| Phase 2: Foundational | 7 | 8h |
| Phase 3: US1 | 8 | 12h |
| Phase 4: US2 | 6 | 8h |
| Phase 5: US3 | 7 | 8h |
| Phase 6: US4 | 4 | 4h |
| Phase 7: US5 | 5 | 6h |
| Phase 8: Polish | 5 | 4h |
| **Total** | **45** | **~52h** |

---

## Notes

- [P] 任务 = 不同文件，无依赖，可并行
- [Story] 标签映射任务到特定用户故事以便追踪
- 每个用户故事应可独立完成和测试
- 每个任务或逻辑组完成后提交
- 在任何检查点停止以独立验证故事
- 避免：模糊任务、同文件冲突、破坏独立性的跨故事依赖
- **密钥安全**: 禁止在日志中打印 `headers` 内容
