# Feature Specification: Native Gateway (`_proxies`)

**Feature Branch**: `005-native-gateway`  
**Created**: 2026-01-08  
**Status**: Ready for Dev  
**Input**: Research document: `specs/_research/native-gateway.md`

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 配置 API 代理路由 (Priority: P1)

作为系统管理员，我希望能够在 Admin UI 中配置 API 代理路由，将前端请求透明转发到上游服务（如 OpenAI、内部微服务），以便前端无需直接暴露第三方 API 密钥。

**Why this priority**: 这是网关功能的核心价值，解决"密钥泄露"和"鉴权割裂"的双重风险，是所有其他功能的基础。

**Independent Test**: 可以通过在 Admin UI 创建代理配置，然后从前端发起请求验证是否正确转发到上游服务。

**Acceptance Scenarios**:

1. **Given** 管理员已登录后台, **When** 访问 `_proxies` Collection, **Then** 显示代理配置列表页面
2. **Given** 管理员在代理配置页面, **When** 创建新代理 `/-/openai` 指向 `https://api.openai.com/v1`, **Then** 代理配置保存成功
3. **Given** 代理配置已保存, **When** 前端请求 `/-/openai/chat/completions`, **Then** 请求被转发到 `https://api.openai.com/v1/chat/completions`
4. **Given** 代理配置 `strip_path=true`, **When** 请求 `/-/openai/models`, **Then** 上游收到 `/models` 而非 `/-/openai/models`

---

### User Story 2 - 基于 PB Rules 的访问控制 (Priority: P1)

作为系统管理员，我希望代理路由能够复用 PocketBase 的 Rule Engine 进行鉴权，以便统一用户体系，无需额外的鉴权逻辑。

**Why this priority**: 安全性是网关的核心需求，"Secure by Default" 原则要求默认拒绝访问，只有显式配置规则才能放行。

**Independent Test**: 可以通过配置不同的 `access_rule`，验证未登录用户被拒绝、登录用户被放行。

**Acceptance Scenarios**:

1. **Given** 代理 `access_rule` 为空, **When** 非管理员请求该代理, **Then** 返回 `403 Forbidden`
2. **Given** 代理 `access_rule` 为空, **When** 管理员请求该代理, **Then** 请求正常转发
3. **Given** 代理 `access_rule = "true"`, **When** 任何人请求该代理, **Then** 请求正常转发（公开访问）
4. **Given** 代理 `access_rule = "@request.auth.id != ''"`, **When** 未登录用户请求, **Then** 返回 `401 Unauthorized`
5. **Given** 代理 `access_rule = "@request.auth.id != ''"`, **When** 已登录用户请求, **Then** 请求正常转发

---

### User Story 3 - 密钥自动注入 (Priority: P1)

作为系统管理员，我希望能够配置请求头模板，在转发时自动注入 API 密钥，以便密钥永远不出服务端内存。

**Why this priority**: 密钥安全是网关的核心价值之一，必须支持从环境变量或 `_secrets` 表动态读取密钥。

**Independent Test**: 可以通过配置 `headers` 模板，验证上游服务收到正确的 Authorization 头。

**Acceptance Scenarios**:

1. **Given** 代理 `headers = {"Authorization": "Bearer {env.OPENAI_KEY}"}`, **When** 请求转发时, **Then** 上游收到从环境变量读取的 Authorization 头
2. **Given** 代理 `headers = {"Authorization": "Bearer {secret.OPENAI_SK}"}`, **When** 请求转发时, **Then** 上游收到从 `_secrets` 表读取的 Authorization 头
3. **Given** 代理 `headers = {"X-User-Id": "@request.auth.id"}`, **When** 已登录用户请求, **Then** 上游收到当前用户的 ID
4. **Given** 模板变量不存在, **When** 请求转发时, **Then** 返回 `500 Internal Server Error` 并记录日志

---

### User Story 4 - 路由保护与冲突检测 (Priority: P2)

作为系统管理员，我希望系统能够阻止我配置冲突的路由路径，以便保护核心 API 和 Admin UI 不被覆盖。

**Why this priority**: 防止误操作导致系统不可用，是运维安全的重要保障。

**Independent Test**: 可以通过尝试创建以 `/api/` 或 `/_/` 开头的代理，验证系统返回验证错误。

**Acceptance Scenarios**:

1. **Given** 管理员尝试创建 `path = "/api/users"`, **When** 保存代理, **Then** 返回 `400 Validation Error`，提示不能以 `/api/` 开头
2. **Given** 管理员尝试创建 `path = "/_/admin"`, **When** 保存代理, **Then** 返回 `400 Validation Error`，提示不能以 `/_/` 开头
3. **Given** 管理员创建 `path = "/-/gpt4"`, **When** 保存代理, **Then** 保存成功
4. **Given** 管理员创建 `path = "/v1/chat/completions"`, **When** 保存代理, **Then** 保存成功（允许自定义绝对路径）

---

### User Story 5 - 开发代理模式 (Priority: P3)

作为开发者，我希望能够使用 `--dev-proxy` 启动参数将未匹配的请求代理到 Vite 开发服务器，以便在开发时只需访问一个端口。

**Why this priority**: 这是 DX 优化功能，在核心功能完成后再实现。

**Independent Test**: 可以通过 `--dev-proxy="http://localhost:5173"` 启动服务，验证访问静态资源时被代理到 Vite。

**Acceptance Scenarios**:

1. **Given** 使用 `--dev-proxy="http://localhost:5173"` 启动, **When** 请求 `/index.html`, **Then** 请求被代理到 Vite
2. **Given** 使用 `--dev-proxy` 启动, **When** 请求 `/api/collections`, **Then** 请求由 PocketBase 处理，不代理
3. **Given** 使用 `--dev-proxy` 启动, **When** 请求 `/-/openai/...`, **Then** 请求由代理路由处理，不走 dev-proxy

---

### Edge Cases

- 上游服务超时如何处理？返回 `504 Gateway Timeout`，记录日志
- 上游服务返回非 2xx 状态码如何处理？透传原始响应，不做修改
- 代理配置 `active=false` 时如何处理？返回 `404 Not Found`
- 同时存在多个匹配路径时如何处理？最长匹配优先
- Streaming 响应（如 SSE）如何处理？透传 chunked 响应，不缓冲

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系统 MUST 创建 `_proxies` 系统级 Collection，包含 `path`, `upstream`, `strip_path`, `access_rule`, `headers`, `timeout`, `active` 字段
- **FR-002**: 系统 MUST 实现 Dynamic Router，拦截匹配 `path` 的请求并转发到 `upstream`
- **FR-003**: 系统 MUST 在 `_proxies` 记录变更时触发路由 Hot Reload，无需重启服务
- **FR-004**: 系统 MUST 复用 PB Rule Engine 评估 `access_rule`，空规则仅允许 Superuser 访问
- **FR-005**: 系统 MUST 支持 `{env.VAR_NAME}` 语法从环境变量读取值并注入请求头
- **FR-006**: 系统 MUST 支持 `{secret.VAR_NAME}` 语法从 `_secrets` 表读取值并注入请求头
- **FR-007**: 系统 MUST 支持 `@request.auth.id` 等上下文变量注入请求头
- **FR-008**: 系统 MUST 阻止创建以 `/api/` 或 `/_/` 开头的代理路径
- **FR-009**: 系统 MUST 支持 `strip_path` 选项，控制转发时是否移除匹配前缀
- **FR-010**: 系统 MUST 支持 `timeout` 配置，超时返回 `504 Gateway Timeout`
- **FR-011**: 系统 MUST 支持 Streaming 响应透传（SSE/chunked）
- **FR-012**: CLI MUST 支持 `--dev-proxy` 参数，将未匹配请求代理到指定地址

### Key Entities

- **Proxy**: 代理配置记录，包含 `id`, `path`, `upstream`, `strip_path`, `access_rule`, `headers`, `timeout`, `active`
- **ProxyManager**: 代理管理器，负责路由匹配、鉴权、请求转发
- **HeaderTemplate**: 请求头模板解析器，支持 `{env.*}`, `{secret.*}`, `@request.*` 变量

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 代理请求延迟开销不超过 5ms（不含上游响应时间）
- **SC-002**: 代理配置变更后 100ms 内生效（Hot Reload）
- **SC-003**: 支持至少 1000 个并发代理连接
- **SC-004**: Streaming 响应首字节延迟不超过 10ms
- **SC-005**: 密钥注入在内存中完成，不写入日志或响应
- **SC-006**: 路由冲突检测在保存时立即返回错误，响应时间 < 50ms

## Assumptions

- `_secrets` 表已存在或将在本功能中创建
- 系统使用 Go 标准库 `net/http/httputil.ReverseProxy` 实现代理
- 不需要支持 WebSocket 代理（仅 HTTP/HTTPS）
- 不需要支持负载均衡或熔断器
- 前端 Admin UI 已有 Collection 管理界面可复用
