# Implementation Plan: Native Gateway (`_proxies`)

**Branch**: `005-native-gateway` | **Date**: 2026-01-08 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-native-gateway/spec.md`

## Summary

为 PocketBase 新增原生网关功能，通过 `_proxies` 系统 Collection 实现动态 API 代理。核心能力包括：路由拦截与转发、基于 PB Rule Engine 的访问控制、密钥自动注入、开发代理模式。采用 Go 标准库 `httputil.ReverseProxy` 实现，支持 Streaming 响应透传。

## Technical Context

**Language/Version**: Go 1.24.0  
**Primary Dependencies**: 
- `net/http/httputil.ReverseProxy` (Go 标准库)
- `github.com/pocketbase/pocketbase/core` (Rule Engine 复用)
- `github.com/pocketbase/pocketbase/tools/security` (密钥加解密)

**Storage**: PostgreSQL / SQLite (`_proxies` 系统表)  
**Testing**: Go test (backend)  
**Target Platform**: Linux/macOS/Windows 服务器  
**Project Type**: Go Backend (PocketBase 核心扩展)  
**Performance Goals**: 代理延迟开销 < 5ms, Hot Reload < 100ms  
**Constraints**: 不支持 WebSocket, 不支持负载均衡/熔断  
**Scale/Scope**: 单机部署, 1000+ 并发连接

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| Single Binary | ✅ PASS | 网关功能编译进主二进制，无外部依赖 |
| Zero External Dependencies | ✅ PASS | 使用 Go 标准库 ReverseProxy，不引入 Kong/Nginx |
| Secure by Default | ✅ PASS | 空 access_rule 默认仅 Superuser 可访问 |
| Rule Engine Reuse | ✅ PASS | 复用现有 PB Rule Engine，统一鉴权逻辑 |
| Hot Reload | ✅ PASS | 监听 `_proxies` 变更事件，无需重启 |

## Project Structure

### Documentation (this feature)

```text
specs/005-native-gateway/
├── spec.md              # Feature specification
├── plan.md              # This file
└── tasks.md             # Implementation tasks
```

### Source Code (repository root)

```text
# Backend (Go)
core/
├── proxy_model.go           # Proxy 数据模型 (系统 Collection 定义)
├── proxy_manager.go         # ProxyManager 核心逻辑 (路由匹配、转发)
├── proxy_auth.go            # 访问控制中间件 (Rule Engine 集成)
├── proxy_header.go          # 请求头模板解析器
└── proxy_hooks.go           # Hot Reload 钩子 (监听 _proxies 变更)

apis/
└── proxy_routes.go          # 动态路由注册

cmd/
└── serve.go                 # --dev-proxy 参数支持

migrations/
└── 1736300000_create_proxies.go  # _proxies 系统表迁移
```

**Structure Decision**: 遵循现有 PocketBase 代码结构，核心逻辑放入 `core/` 目录，API 路由放入 `apis/` 目录，迁移脚本放入 `migrations/` 目录。

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        PocketBase                           │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ /api/*      │  │ /_/*        │  │ /-/* (GW)   │         │
│  │ Data API    │  │ Admin UI    │  │ Proxy Routes│         │
│  └─────────────┘  └─────────────┘  └──────┬──────┘         │
│                                           │                 │
│  ┌────────────────────────────────────────▼────────────────┐│
│  │                   ProxyManager                          ││
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐              ││
│  │  │ Router   │  │ Auth     │  │ Header   │              ││
│  │  │ Matcher  │  │ Engine   │  │ Injector │              ││
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘              ││
│  │       │             │             │                     ││
│  │       ▼             ▼             ▼                     ││
│  │  ┌──────────────────────────────────────────┐          ││
│  │  │           httputil.ReverseProxy           │          ││
│  │  └──────────────────────────────────────────┘          ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  ┌─────────────┐  ┌─────────────┐                          │
│  │ _proxies    │  │ _secrets    │                          │
│  │ (Config)    │  │ (Keys)      │                          │
│  └─────────────┘  └─────────────┘                          │
└─────────────────────────────────────────────────────────────┘
```

## Key Design Decisions

### 1. 路由匹配策略

采用**最长前缀匹配**算法：
- 将所有 `path` 按长度降序排列
- 依次检查请求路径是否以 `path` 开头
- 首个匹配即为目标代理

### 2. Hot Reload 机制

监听 `_proxies` Collection 的 `OnRecordAfterCreateRequest`, `OnRecordAfterUpdateRequest`, `OnRecordAfterDeleteRequest` 事件：
- 事件触发时，重建内存中的路由表
- 使用 `sync.RWMutex` 保护并发访问
- 无需重启服务

### 3. 请求头模板语法

```
{env.VAR_NAME}      → os.Getenv("VAR_NAME")
{secret.VAR_NAME}   → _secrets 表查询 (密文解密)
@request.auth.id    → 当前用户 ID
@request.auth.*     → 当前用户任意字段
```

### 4. Streaming 支持

使用 `httputil.ReverseProxy` 默认行为：
- 不设置 `FlushInterval`，默认立即 flush
- 不缓冲响应体，直接透传

## Complexity Tracking

> 无违规项，架构简单符合 Constitution 原则。

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| 上游服务不可用 | Medium | High | 配置 timeout，返回 504 |
| 密钥泄露到日志 | Low | Critical | 禁止日志打印 headers |
| 路由冲突覆盖核心 API | Low | Critical | 验证层阻止 `/api/`, `/_/` |
| Hot Reload 竞态条件 | Low | Medium | 使用 RWMutex 保护 |
