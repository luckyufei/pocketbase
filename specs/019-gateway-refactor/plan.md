# Implementation Plan: Gateway Plugin Refactor

**Branch**: `019-gateway-refactor` | **Date**: 2026-01-30 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/019-gateway-refactor/spec.md`

## Summary

将 PocketBase 的 Native Gateway 功能从 `core/` 迁移到 `plugins/gateway/`，并实现协议归一化（Protocol Normalizer），彻底解决代理 LLM 接口时的 EOF、Size Mismatch 等问题。核心改进：强制剥离 Gzip、重写 Host 头、优化流式响应。

## Technical Context

**Language/Version**: Go 1.24.0  
**Primary Dependencies**: 
- `net/http` (Go 标准库)
- `github.com/pocketbase/pocketbase/core` (App 接口)
- `github.com/pocketbase/pocketbase/tools/security` (密钥加解密)

**Storage**: PostgreSQL / SQLite (`_proxies` 系统表)  
**Testing**: Go test (backend)  
**Target Platform**: Linux/macOS/Windows 服务器  
**Project Type**: Go Plugin (PocketBase 扩展)  
**Performance Goals**: 代理延迟 < 5ms, SSE 首字节 < 100ms  
**Constraints**: 不支持 WebSocket, 禁用 Gzip 压缩  
**Scale/Scope**: 单机部署, 1000+ 并发连接

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| Single Binary | ✅ PASS | 网关功能编译进主二进制（通过 Plugin 注册） |
| Zero External Dependencies | ✅ PASS | 使用 Go 标准库 http.Client，不引入 Kong/Nginx |
| Secure by Default | ✅ PASS | 空 access_rule 默认仅 Superuser 可访问 |
| Plugin Architecture | ✅ PASS | 遵循 PocketBase Plugin 模式 |
| Protocol Stability | ✅ PASS | 协议归一化确保 100% 成功率 |

## Project Structure

### Documentation (this feature)

```text
specs/019-gateway-refactor/
├── spec.md              # Feature specification
├── plan.md              # This file
└── tasks.md             # Implementation tasks
```

### Source Code (repository root)

```text
# 新增 Plugin 目录
plugins/
└── gateway/
    ├── gateway.go           # Plugin 入口，MustRegister()
    ├── config.go            # 配置加载和验证
    ├── manager.go           # ProxyManager (迁移自 core/proxy_manager.go)
    ├── normalizer.go        # ProtocolNormalizer (新增)
    ├── auth.go              # 访问控制 (迁移自 core/proxy_auth.go)
    ├── header.go            # 请求头注入 (迁移自 core/proxy_header.go)
    ├── routes.go            # 路由注册 (迁移自 apis/proxy_routes.go)
    ├── hooks.go             # Hot Reload 钩子 (迁移自 core/proxy_hooks.go)
    ├── errors.go            # 结构化错误响应 (新增)
    └── *_test.go            # 单元测试

# 待删除的原文件
core/
├── proxy_model.go           # → plugins/gateway/config.go
├── proxy_manager.go         # → plugins/gateway/manager.go
├── proxy_auth.go            # → plugins/gateway/auth.go
├── proxy_header.go          # → plugins/gateway/header.go
├── proxy_hooks.go           # → plugins/gateway/hooks.go
├── proxy_*_test.go          # → plugins/gateway/*_test.go

apis/
└── proxy_routes.go          # → plugins/gateway/routes.go

# 更新的文件
examples/base/main.go        # 添加 gateway.MustRegister(app)
```

**Structure Decision**: 遵循 PocketBase 现有 Plugin 模式（参考 `plugins/jsvm/`, `plugins/migratecmd/`），将所有网关相关代码集中到 `plugins/gateway/` 目录。

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        PocketBase App                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    Gateway Plugin                           ││
│  │  ┌───────────────────────────────────────────────────────┐  ││
│  │  │  MustRegister(app)                                    │  ││
│  │  │    ├── 创建 _proxies Collection (if not exists)       │  ││
│  │  │    ├── 注册 Hot Reload Hooks                          │  ││
│  │  │    └── 注册 /-/* 路由                                  │  ││
│  │  └───────────────────────────────────────────────────────┘  ││
│  │                                                             ││
│  │  ┌───────────────────────────────────────────────────────┐  ││
│  │  │  ProxyManager                                         │  ││
│  │  │    ├── LoadProxies() - 从 DB 加载配置                  │  ││
│  │  │    ├── MatchProxy() - 最长前缀匹配                     │  ││
│  │  │    └── ServeHTTP() - 代理请求                          │  ││
│  │  └───────────────────────────────────────────────────────┘  ││
│  │                                                             ││
│  │  ┌───────────────────────────────────────────────────────┐  ││
│  │  │  ProtocolNormalizer (The Protocol Normalizer)         │  ││
│  │  │    ├── StripGzip() - 删除 Accept-Encoding             │  ││
│  │  │    ├── RewriteHost() - 设置正确 Host 头               │  ││
│  │  │    ├── CleanHopByHop() - 清理 hop-by-hop 头           │  ││
│  │  │    └── StreamFlush() - 100ms 刷新间隔                  │  ││
│  │  └───────────────────────────────────────────────────────┘  ││
│  │                                                             ││
│  │  ┌───────────────────────────────────────────────────────┐  ││
│  │  │  Shared http.Transport (Connection Pool)              │  ││
│  │  │    ├── MaxIdleConns: 100                              │  ││
│  │  │    ├── IdleConnTimeout: 90s                           │  ││
│  │  │    ├── ForceAttemptHTTP2: true                        │  ││
│  │  │    └── DisableCompression: true                       │  ││
│  │  └───────────────────────────────────────────────────────┘  ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐                               │
│  │ _proxies    │  │ _secrets    │                               │
│  │ (Config)    │  │ (Keys)      │                               │
│  └─────────────┘  └─────────────┘                               │
└─────────────────────────────────────────────────────────────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │   Upstream Services   │
        │  - OpenAI API         │
        │  - Claude API         │
        │  - Local Sidecar      │
        └───────────────────────┘
```

## Key Design Decisions

### 1. 采用 `httputil.ReverseProxy` + "暴力归一化"（核心！）

**问题根源**: 之前使用 `ReverseProxy` 失败是因为保留了 `Accept-Encoding: gzip`，导致 Go Transport 层自动解压但没更新 `Content-Length`。

**解决方案**: "暴力归一化" 策略

```go
proxy := &httputil.ReverseProxy{
    Director: func(req *http.Request) {
        // 关键点 1: 重写 Host 头（解决 Cloudflare/AWS 403）
        req.Host = target.Host
        
        // 关键点 2: 暴力剥离压缩（彻底解决 Size Mismatch）
        req.Header.Del("Accept-Encoding")
        
        // 关键点 3: 清理 Hop-by-hop Headers
        req.Header.Del("Connection")
        req.Header.Del("Keep-Alive")
        // ...
    },
    Transport:     globalTransport,
    FlushInterval: 100 * time.Millisecond, // SSE 优化
}
```

**为什么选择 ReverseProxy 而非 http.Client**：
- Go 标准库，久经考验
- 自动处理大部分边界情况
- 统一本地 Sidecar 和外部 LLM 的代理逻辑
- 代码更简洁，维护成本更低

### 2. Plugin 注册模式

参考 `plugins/jsvm/` 的实现模式：

```go
package gateway

type Config struct {
    // 可选配置
}

func MustRegister(app core.App, config Config) {
    plugin := &gatewayPlugin{app: app, config: config}
    plugin.register()
}

type gatewayPlugin struct {
    app     core.App
    config  Config
    proxies map[string]*httputil.ReverseProxy // 每个上游一个 Proxy 实例
}

func (p *gatewayPlugin) register() {
    // 1. 创建 _proxies Collection
    p.ensureProxiesCollection()
    
    // 2. 注册 Hot Reload Hooks
    p.registerHooks()
    
    // 3. 注册路由
    p.registerRoutes()
}
```

### 3. 结构化错误响应

```go
type GatewayError struct {
    Error   string `json:"error"`
    Details string `json:"details,omitempty"`
}

func writeErrorJSON(w http.ResponseWriter, status int, message, details string) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(status)
    json.NewEncoder(w).Encode(GatewayError{
        Error:   message,
        Details: details,
    })
}
```

### 4. 迁移策略

采用**渐进式迁移**，确保功能不中断：

1. **Phase 1**: 创建 Plugin 结构，复制（非移动）代码
2. **Phase 2**: 更新 `examples/base/main.go` 使用新 Plugin
3. **Phase 3**: 验证新 Plugin 功能正常
4. **Phase 4**: 删除 `core/proxy_*.go` 原文件

## Complexity Tracking

| 组件 | 复杂度 | 说明 |
|------|--------|------|
| ProtocolNormalizer | Low | 简单的请求头处理 |
| ProxyManager | Medium | 核心代理逻辑，已验证 |
| Plugin 注册 | Low | 参考现有 Plugin 模式 |
| 迁移过程 | Medium | 需要小心处理依赖 |

> 总体复杂度可控，无架构违规。

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| 迁移过程中功能中断 | Medium | High | 保留原文件直到验证完成，使用 feature flag |
| 协议归一化不完整 | Low | High | 针对 OpenAI/Claude 专项测试，完善 Edge Case |
| Plugin 加载顺序问题 | Low | Medium | 文档说明正确注册顺序 |
| 连接池配置不当 | Low | Low | 使用经过验证的默认配置 |

## Estimated Effort

| Phase | Tasks | Estimated Hours |
|-------|-------|-----------------|
| Phase 1: Plugin 结构 | 8 | 4h |
| Phase 2: 协议归一化 | 6 | 4h |
| Phase 3: 测试验证 | 5 | 6h |
| Phase 4: 清理迁移 | 4 | 2h |
| **Total** | **23** | **~16h** |

## Notes

- 保持与原 `_proxies` 表结构完全兼容
- 预编译二进制默认启用 Gateway Plugin
- 带宽增加（禁用 Gzip）是可接受的权衡，对文本流影响很小
- 协议归一化是本次重构的核心价值
