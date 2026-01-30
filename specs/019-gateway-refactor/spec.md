# Feature Specification: Gateway Plugin Refactor (协议归一化)

**Feature Branch**: `019-gateway-refactor`  
**Created**: 2026-01-30  
**Status**: Ready for Dev  
**Input**: Research document: `specs/_research/260130-gateway.md`, Original spec: `specs/005-native-gateway/`

## Background (背景)

原有的 Native Gateway (`_proxies`) 功能存在两个核心问题：

### 问题 1: 架构位置不当

Gateway 功能被放在 `core/` 目录下，但它更适合作为一个可选的 Plugin：
- 并非所有用户都需要网关功能
- 增加了核心模块的复杂度
- 违反了 PocketBase 的模块化设计原则

### 问题 2: ReverseProxy 的协议兼容性问题

最初使用 `httputil.ReverseProxy` 代理 LLM 接口时遇到严重问题：
- **Body Size Mismatch**: Go `httputil` 中经典的 "Content-Length vs Actual Body Size" 不匹配
- **Unexpected EOF**: 流式响应（SSE）时的异常中断
- **Gzip 解码问题**: 上游返回压缩内容时的解码错误

当前已回退到 `http.Client`，但这不是最优解。本次重构将：
1. **重新采用 `httputil.ReverseProxy`** - 统一本地 Sidecar 和外部 LLM
2. **实现 "暴力归一化" 策略** - 彻底解决协议兼容性问题

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 插件化加载 (Priority: P0)

作为开发者，我希望 Gateway 功能作为独立插件存在，以便按需启用，不增加核心模块复杂度。

**Why this priority**: 这是架构重构的核心目标，解决"位置不当"问题。

**Independent Test**: 可以在 `examples/base/main.go` 中选择性注册 Gateway 插件，验证启用/禁用行为。

**Acceptance Scenarios**:

1. **Given** 未注册 Gateway 插件, **When** 请求 `/-/openai/*`, **Then** 返回 `404 Not Found`
2. **Given** 已注册 Gateway 插件, **When** 请求 `/-/openai/*`, **Then** 请求被正确代理
3. **Given** 已注册 Gateway 插件, **When** 应用启动, **Then** 自动创建 `_proxies` 系统表
4. **Given** 使用预编译二进制, **When** 启动服务, **Then** Gateway 功能默认可用

---

### User Story 2 - 协议归一化 (Priority: P0)

作为系统管理员，我希望网关能够自动处理各种 HTTP 协议差异，确保代理 LLM 接口时 100% 成功率。

**Why this priority**: 这是用户实际使用中遇到的核心痛点，必须彻底解决。

**Independent Test**: 代理 OpenAI、Claude、本地 Sidecar 等不同上游，验证流式响应稳定性。

**Acceptance Scenarios**:

1. **Given** 上游返回 Gzip 压缩响应, **When** 代理请求, **Then** 网关强制请求 Plain Text 并正确返回
2. **Given** 上游返回 SSE 流式响应, **When** 代理请求, **Then** 客户端实时收到每个 Token，无延迟
3. **Given** 上游返回 chunked 传输, **When** 代理请求, **Then** 响应正确透传，无 EOF 错误
4. **Given** 上游为 Cloudflare/AWS 托管服务, **When** 代理请求, **Then** Host 头正确，不返回 403

---

### User Story 3 - 连接池优化 (Priority: P1)

作为系统管理员，我希望网关能够复用 HTTP 连接，降低延迟并提升吞吐量。

**Why this priority**: 性能优化是网关的基本要求，Keep-Alive 连接池是最有效的优化手段。

**Independent Test**: 连续发送 100 个请求到同一上游，验证连接复用。

**Acceptance Scenarios**:

1. **Given** 连续多次请求同一上游, **When** 使用共享 Transport, **Then** TCP 连接被复用，无重复握手
2. **Given** 空闲连接超过 90 秒, **When** 新请求到达, **Then** 自动建立新连接
3. **Given** 并发 100 个请求, **When** 同时发送, **Then** 连接池管理正常，无连接泄漏

---

### User Story 4 - 结构化错误响应 (Priority: P2)

作为前端开发者，我希望网关错误返回 JSON 格式，以便统一处理错误逻辑。

**Why this priority**: 良好的错误处理是 API 设计的基本原则。

**Independent Test**: 触发各种错误场景，验证返回格式。

**Acceptance Scenarios**:

1. **Given** 上游服务不可达, **When** 代理请求, **Then** 返回 `{"error": "AI Gateway Error", "details": "..."}`
2. **Given** 请求超时, **When** 代理请求, **Then** 返回 `504` 状态码和 JSON 错误体
3. **Given** 代理配置不存在, **When** 请求 `/-/unknown`, **Then** 返回 `404` 和 JSON 错误体

---

### Edge Cases

- 上游返回非标准 Content-Length（LLM 常见问题）→ 忽略 Content-Length，直接流式读取
- 上游返回超大响应体 → 不缓冲，直接流式转发
- 网关进程 OOM 风险 → 使用固定大小缓冲区（32KB）
- 上游 HTTP/2 支持 → 启用 `ForceAttemptHTTP2` 优化 OpenAI 连接

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Gateway MUST 作为独立 Plugin 存在于 `plugins/gateway/` 目录
- **FR-002**: Plugin MUST 提供 `MustRegister(app)` 函数用于注册
- **FR-003**: Plugin MUST 在注册时自动创建 `_proxies` 系统 Collection（如不存在）
- **FR-004**: 代理请求 MUST 强制删除 `Accept-Encoding` 头，确保上游返回 Plain Text
- **FR-005**: 代理请求 MUST 重写 `Host` 头为上游服务的 Host
- **FR-006**: 代理 MUST 使用共享 `http.Transport` 实现连接池
- **FR-007**: 流式响应 MUST 使用 `FlushInterval` 或手动 Flush 确保实时性
- **FR-008**: 错误响应 MUST 返回 JSON 格式，包含 `error` 和 `details` 字段
- **FR-009**: 原有 `core/proxy_*.go` 文件 MUST 迁移到 `plugins/gateway/`
- **FR-010**: `examples/base/main.go` MUST 默认注册 Gateway Plugin

### Non-Functional Requirements

- **NFR-001**: 代理延迟开销不超过 5ms（不含上游响应时间）
- **NFR-002**: 流式响应首字节延迟不超过 100ms
- **NFR-003**: 支持至少 1000 个并发代理连接
- **NFR-004**: 无 Gzip 导致的带宽增加（约 3-5 倍）是可接受的权衡

### Key Entities

- **Plugin**: Gateway 插件入口，负责注册路由和 Hooks
- **ProxyManager**: 代理管理器，负责路由匹配、协议归一化、请求转发
- **ProxyConfig**: 代理配置，从 `_proxies` 表加载
- **ProtocolNormalizer**: 协议归一化器，处理 Gzip、Host、Streaming 等问题

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 代理 OpenAI/Claude API 成功率 100%（无 EOF 或 Size Mismatch 错误）
- **SC-002**: SSE 流式响应实时性 < 100ms（首字节延迟）
- **SC-003**: 连接池复用率 > 90%（同一上游连续请求）
- **SC-004**: 插件化后 `core/` 目录减少 10 个 proxy_*.go 文件
- **SC-005**: 预编译二进制保持现有功能完全兼容

---

## Technical Design

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        PocketBase                               │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌────────────────────────────────┐│
│  │ /api/*   │  │ /_/*     │  │      Gateway Plugin            ││
│  │ Data API │  │ Admin UI │  │  ┌──────────────────────────┐  ││
│  └──────────┘  └──────────┘  │  │     ProxyManager         │  ││
│                              │  │  ┌────────────────────┐  │  ││
│                              │  │  │ Protocol Normalizer│  │  ││
│                              │  │  │  - Strip Gzip      │  │  ││
│                              │  │  │  - Rewrite Host    │  │  ││
│                              │  │  │  - Flush Interval  │  │  ││
│                              │  │  └────────────────────┘  │  ││
│                              │  │           │              │  ││
│                              │  │           ▼              │  ││
│                              │  │  ┌────────────────────┐  │  ││
│                              │  │  │    http.Client     │  │  ││
│                              │  │  │  (Shared Transport)│  │  ││
│                              │  │  └────────────────────┘  │  ││
│                              │  └──────────────────────────┘  ││
│                              └────────────────────────────────┘│
│  ┌──────────┐  ┌──────────┐                                    │
│  │ _proxies │  │ _secrets │                                    │
│  │ (Config) │  │ (Keys)   │                                    │
│  └──────────┘  └──────────┘                                    │
└─────────────────────────────────────────────────────────────────┘
           │                              │
           ▼                              ▼
   ┌───────────────┐            ┌───────────────┐
   │  Local Sidecar │            │   OpenAI API  │
   │  (Python/Agno) │            │  Claude API   │
   └───────────────┘            └───────────────┘
```

### Protocol Normalizer 核心实现

**采用 `httputil.ReverseProxy` + "暴力归一化" 策略**

#### 为什么选择 ReverseProxy？

| 方案 | 优点 | 缺点 |
|------|------|------|
| `http.Client` | 完全控制 | 需要手动处理大量细节（Header 复制、Streaming、错误处理） |
| `httputil.ReverseProxy` | Go 标准库，久经考验，自动处理大部分边界情况 | 需要正确配置 Director |

`ReverseProxy` 是实现 "Unified AI Gateway" 的最佳路径，前提是实现 **协议归一化**。

#### 差异点抹平策略

| 特性 | 本地 Sidecar (Python) | 外部 LLM (OpenAI/Claude) | **统一解决方案** |
|------|----------------------|-------------------------|-----------------|
| 网络协议 | HTTP (Plain) | HTTPS (TLS) | 自动识别 Scheme，复用 TLS Transport |
| Gzip 压缩 | 可控 | 强制开启 (Cloudflare) | **强制剥离 `Accept-Encoding`** |
| Host 头 | 不敏感 | **极度敏感** (403) | **强制重写 `req.Host`** |
| Auth | 无 (内网信任) | Bearer Token | Director 中按需注入 |

#### 核心实现代码

```go
// 全局共享 Transport：复用 TCP 连接，对 OpenAI 等外部服务至关重要
var globalTransport = &http.Transport{
    Proxy:                 http.ProxyFromEnvironment,
    ForceAttemptHTTP2:     true,  // 对 OpenAI 启用 HTTP/2
    MaxIdleConns:          100,
    IdleConnTimeout:       90 * time.Second,
    TLSHandshakeTimeout:   10 * time.Second,
    ExpectContinueTimeout: 1 * time.Second,
}

// 创建通用代理（同时适用于本地 Sidecar 和外部 LLM）
func createUniversalProxy(targetURL string, apiKey string) *httputil.ReverseProxy {
    target, _ := url.Parse(targetURL)

    proxy := &httputil.ReverseProxy{
        Director: func(req *http.Request) {
            // 1. 基础地址重写
            req.URL.Scheme = target.Scheme
            req.URL.Host = target.Host

            // 2. [核心防坑点 A] 重写 Host 头
            // OpenAI/Cloudflare 会校验 Host 头，localhost 会被拒绝
            req.Host = target.Host

            // 3. [核心防坑点 B] 暴力剥离压缩
            // 强迫上游发送 Plain Text，彻底解决 "Body Size Mismatch"
            // 代价：带宽增加 3-5 倍，但对 AI 文本流完全可接受
            req.Header.Del("Accept-Encoding")

            // 4. 鉴权注入
            if apiKey != "" {
                req.Header.Set("Authorization", "Bearer "+apiKey)
            }

            // 5. 清理 Hop-by-hop Headers
            req.Header.Del("Connection")
            req.Header.Del("Keep-Alive")
            req.Header.Del("Proxy-Authenticate")
            req.Header.Del("Te")
            req.Header.Del("Trailers")
            req.Header.Del("Upgrade")
        },
        Transport: globalTransport,
        // 6. [关键] SSE 流式响应优化
        FlushInterval: 100 * time.Millisecond,
        // 7. 结构化错误响应
        ErrorHandler: func(w http.ResponseWriter, r *http.Request, err error) {
            w.Header().Set("Content-Type", "application/json")
            w.WriteHeader(http.StatusBadGateway)
            w.Write([]byte(`{"error": "AI Gateway Error", "details": "` + err.Error() + `"}`))
        },
    }

    return proxy
}
```

#### 为什么 "暴力剥离压缩" 能解决问题？

之前失败的原因是 **协议透明度陷阱**：

1. 保留 `Accept-Encoding: gzip` 时，OpenAI 返回 gzip 数据
2. Go Transport 层可能自动解压但没更新 `Content-Length`
3. 导致 **数据流与元数据不一致** → Size Mismatch

**解决方案**：`req.Header.Del("Accept-Encoding")` 强迫 OpenAI 发送 Plain Text

- **代价**：响应体积变大（JSON 约 3-5 倍）
- **收益**：彻底消除编解码 Bug，AI 聊天接口响应通常只有几 KB~几百 KB，完全可接受

### 共享 Transport 配置

```go
// 全局 Transport（用于 httputil.ReverseProxy）
var globalTransport = &http.Transport{
    Proxy:                 http.ProxyFromEnvironment, // 支持系统代理
    ForceAttemptHTTP2:     true,                      // OpenAI HTTP/2 优化
    MaxIdleConns:          100,
    IdleConnTimeout:       90 * time.Second,
    TLSHandshakeTimeout:   10 * time.Second,
    ExpectContinueTimeout: 1 * time.Second,
}
```

### Observability 限制

使用 `ReverseProxy` 的唯一劣势：**数据流直接穿透，PB 难以"偷看"响应内容存入数据库**。

**决策**：
- PB Gateway 只负责代理转发，**不负责存储聊天记录**
- Local Sidecar：Python 端自己入库
- Remote LLM：聊天记录由**前端 UI 异步归档**（调用 `/api/chat/save`）

这样保持了网关的极简和高性能。

---

## Migration Plan

### Phase 1: 创建 Plugin 结构

1. 创建 `plugins/gateway/` 目录
2. 迁移 `core/proxy_*.go` 到 `plugins/gateway/`
3. 更新 `examples/base/main.go` 注册插件

### Phase 2: 协议归一化重构

1. 实现 `ProtocolNormalizer` 组件
2. 确保 `Accept-Encoding` 强制剥离
3. 确保 `Host` 头正确重写
4. 确保流式响应实时 Flush

### Phase 3: 测试验证

1. 单元测试覆盖协议归一化
2. 集成测试代理 OpenAI/Claude
3. 压力测试连接池行为

### Phase 4: 清理

1. 删除 `core/proxy_*.go` 原文件
2. 更新文档和使用指南

---

## Assumptions

- 当前 `http.Client` 方案已基本可用，需要增强协议归一化
- `_proxies` 和 `_secrets` 表结构保持不变
- 预编译二进制需要保持向后兼容
- 带宽增加（禁用 Gzip）是可接受的权衡

---

## Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| 迁移过程中功能中断 | Medium | High | 保留原文件直到验证完成 |
| 协议归一化不完整 | Low | High | 针对 OpenAI/Claude 专项测试 |
| 连接池内存泄漏 | Low | Medium | 监控 MaxIdleConns 配置 |
| 插件加载顺序问题 | Low | Medium | 文档说明正确注册方式 |

---

## References

- Original Spec: `specs/005-native-gateway/`
- Research: `specs/_research/260130-gateway.md`
- Go httputil.ReverseProxy: https://pkg.go.dev/net/http/httputil#ReverseProxy
