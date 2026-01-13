# CODEBUDDY.md This file provides guidance to CodeBuddy when working with code in this repository.

> **IMPORTANT**: 请总是使用中文来写文档和代码注释
> **🎯 ALL-IN-ONE 完整指南**: `/guide-aio/` ← LLM 首选阅读（模块化文档）
> **系统架构设计原则**: `/ARCH_RULES.md`
> **产品设计原则**: `/PM_RULES.md`
## Build & Development Commands

### Run the Application
```bash
# SQLite 模式（默认）
cd examples/base && go run main.go serve

# PostgreSQL 模式
cd examples/base && go run main.go serve --pg="postgres://user:pass@localhost:5432/pocketbase?sslmode=disable"

# 或使用环境变量
PB_POSTGRES_DSN="postgres://user:pass@localhost:5432/pocketbase?sslmode=disable" go run main.go serve
```
Starts the server at `http://localhost:8090` with the embedded Admin UI. The `examples/base` directory contains the reference implementation used for prebuilt releases.

### Run Tests
```bash
go test ./...
# or with verbose output and coverage
make test
```
Uses standard Go testing. Tests are a mix of unit and integration tests spread across `*_test.go` files alongside their implementations.

### Run a Single Test
```bash
go test -v -run TestFunctionName ./path/to/package
```

### Lint
```bash
make lint
# or directly
golangci-lint run -c ./golangci.yml ./...
```
Requires [golangci-lint](https://golangci-lint.run/usage/install/).

### Build Executable
```bash
cd examples/base
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build
```
Produces a statically linked binary. Uses pure Go SQLite driver (modernc.org/sqlite) - no CGO required.

### Admin UI Development
```bash
cd ui
npm install
npm run dev      # Start dev server at http://localhost:3000
npm run build    # Build for embedding into Go binary
```
The UI is a Svelte SPA. Requires the backend running at `http://localhost:8090` (configurable via `ui/.env.development.local`).

### Generate JS Types
```bash
make jstypes
```
Generates TypeScript definitions for the JSVM plugin.

## Architecture Overview

PocketBase is an open-source Go backend providing an embedded SQLite database with realtime subscriptions, file/user management, Admin UI, and REST API - all in a single executable.

### Core Package (`core/`)

The backbone of PocketBase. Key components:

- **`app.go`**: Defines the `App` interface - the main contract for the PocketBase application. All functionality is accessed through this interface (DB access, settings, cron, filesystem, subscriptions broker, migrations, hooks).

- **`base.go`**: `BaseApp` struct implements the `App` interface. Manages:
  - Dual SQLite connection pools (concurrent for reads, nonconcurrent for writes) to minimize SQLITE_BUSY errors
  - Auxiliary database for logs
  - Event hook system for lifecycle events
  - Settings, cron scheduler, realtime subscriptions broker

- **`events.go`**: Defines all event types used in the hook system (BootstrapEvent, ServeEvent, ModelEvent, RecordEvent, CollectionEvent, etc.). Events carry context and support tagging for selective hook binding.

- **Collection & Record Models**: `collection_model.go` defines the Collection schema structure. `record_model.go` defines the Record data model. Collections are schema definitions; Records are the actual data entries.

- **Field System** (`field_*.go`): Typed field implementations (text, number, bool, date, file, relation, select, email, URL, JSON, password, autodate, editor, geo_point). Each field type handles validation, serialization, and database column mapping.

- **Query Builders** (`*_query.go`): Type-safe query helpers for Collections, Records, Logs, ExternalAuths, MFAs, OTPs, AuthOrigins.

### APIs Package (`apis/`)

HTTP handlers and middleware built on the custom router.

- **`serve.go`**: Entry point for the web server. Sets up CORS, static file serving for Admin UI, TLS/autocert, graceful shutdown.

- **`base.go`**: Creates the router with all API routes via `NewRouter()`.

- **Route Handlers**: Organized by feature:
  - `record_crud.go`: CRUD operations for records
  - `record_auth*.go`: Authentication flows (password, OAuth2, OTP, email verification, password reset)
  - `collection.go`, `collection_import.go`: Collection management
  - `realtime.go`: SSE-based realtime subscriptions
  - `file.go`: File upload/download with thumbnail generation
  - `batch.go`: Batch request handling
  - `settings.go`, `logs.go`, `health.go`, `backup*.go`: System endpoints

- **Middlewares** (`middlewares*.go`): Rate limiting, CORS, Gzip, body limits, authentication, activity logging.

### Tools Package (`tools/`)

Standalone utilities used throughout PocketBase:

- **`router/`**: Generic HTTP router wrapper around `http.ServeMux` with middleware support, route groups, and typed event handling via hooks.

- **`hook/`**: Event hook system supporting prioritized handlers, tagging, and chained execution with `Next()` pattern.

- **`auth/`**: OAuth2 provider implementations (35+ providers including Google, GitHub, Apple, Discord, etc.). Each provider in its own file extending `BaseProvider`.

- **`search/`**: Filter expression parser and query builder for the List API. Supports complex filter syntax with field resolution.

- **`filesystem/`**: Abstraction over local and S3-compatible storage for file uploads and backups.

- **`subscriptions/`**: Realtime subscription broker and client management for SSE connections.

- **`cron/`**: Cron job scheduler with standard cron expression support.

- **`types/`**: Custom types (DateTime, GeoPoint, JSONArray, JSONMap, JSONRaw) with JSON/DB serialization.

- **`security/`**: Cryptographic utilities (random strings, encryption, JWT handling).

- **`mailer/`**: SMTP and sendmail implementations.

### Plugins Package (`plugins/`)

Optional extensions:

- **`jsvm/`**: JavaScript VM plugin using Goja. Enables extending PocketBase with JavaScript hooks (`pb_hooks/`) and migrations (`pb_migrations/`). Includes a pool of prewarmed Goja runtimes.

- **`migratecmd/`**: CLI command for managing migrations with auto-migration support. Generates Go or JS migration templates.

- **`ghupdate/`**: GitHub-based self-update functionality.

### Entry Point (`pocketbase.go`)

The `PocketBase` struct wraps `core.App` and adds CLI support via Cobra. `New()` creates an instance, `Start()` registers default commands (serve, superuser) and executes. The app auto-detects `go run` vs compiled binary for dev mode defaults.

### UI Package (`ui/`)

Svelte-based Admin dashboard SPA. Built assets in `ui/dist/` are embedded into the Go binary via `embed.go`. During development, run the Vite dev server separately.

### Benchmarks Package (`benchmarks/`)

性能基准测试套件，用于验证 PocketBase 在 SQLite 和 PostgreSQL 环境下的性能表现。

- **测试类型**:
  - SQLite 基准测试（小/中/大规模）
  - PostgreSQL vs SQLite 对比测试
  - PostgreSQL 集群扩展性测试（1主2从 + HAProxy）

- **目录结构**:
  - `cmd/` - 命令行工具入口
  - `configs/` - 环境配置文件（local-sqlite.json, docker-postgres.json 等）
  - `docker/` - Docker Compose 配置（单节点和集群环境）
  - `http/` - HTTP API 负载测试
  - `websocket/` - WebSocket 测试
  - `database/` - 数据库直连测试
  - `reports/` - 测试报告输出

- **运行方式**:
  ```bash
  cd benchmarks
  make build          # 构建测试工具
  make run-sqlite-small   # 小规模 SQLite 测试
  make run-pg-compare-all # PostgreSQL vs SQLite 对比
  make run-cluster-3node  # 3 节点集群测试
  ```

### JS SDK Package (`jssdk/`)

官方 JavaScript SDK，支持浏览器和 Node.js 环境与 PocketBase API 交互。

- **核心功能**:
  - 完整的 CRUD 操作（`pb.collection().getList/getOne/create/update/delete`）
  - 认证管理（密码登录、OAuth2、OTP、邮箱验证）
  - 实时订阅（SSE-based realtime subscriptions）
  - 文件上传下载
  - 批量请求（Batch API）
  - TypeScript 类型定义

- **目录结构**:
  - `src/Client.ts` - 主客户端类
  - `src/services/` - API 服务实现（RecordService, CollectionService 等）
  - `src/stores/` - 认证存储（LocalAuthStore, AsyncAuthStore）
  - `tests/` - 单元测试

- **开发命令**:
  ```bash
  cd jssdk
  npm install
  npm test          # 运行单元测试
  npm run build     # 构建发布包
  ```

- **SSR 集成**: 支持 SvelteKit, Astro, Nuxt 3, Next.js 等框架的服务端渲染

### Data Flow

1. HTTP request → Router middleware chain → Route handler
2. Handler uses `App` interface to access DB, settings, filesystem
3. DB operations trigger Model/Record/Collection hooks
4. Hooks can modify, validate, or reject operations
5. Realtime changes broadcast via subscriptions broker to SSE clients

### Hook System Pattern

Hooks use a chain-of-responsibility pattern. Handlers must call `e.Next()` to continue the chain or return early to short-circuit. Handlers can be bound with priorities and IDs for ordering and selective unbinding.

```go
app.OnRecordCreate("posts").BindFunc(func(e *core.RecordEvent) error {
    // pre-processing
    if err := e.Next(); err != nil {
        return err
    }
    // post-processing
    return nil
})
```

### Database Architecture

PocketBase 支持两种数据库后端：

#### SQLite（默认）
- **data.db**: Main application data (collections, records, settings)
- **auxiliary.db**: Logs and temporary data
- Dual connection pools per database: concurrent (read) and nonconcurrent (write)
- Pure Go SQLite driver enables CGO_ENABLED=0 builds

#### PostgreSQL
- 通过 `--pg` 命令行参数或 `PB_POSTGRES_DSN` 环境变量启用
- 支持 PostgreSQL 15+ 版本
- 完整的 JSONB 支持，GIN 索引优化
- 行级安全策略 (RLS) 支持
- 详细配置请参考 [PostgreSQL 使用指南](docs/POSTGRESQL.md)

## Using PocketBase as a Library

When using PocketBase as a Go library in your own project, you need to explicitly import and register the plugins you want to use. Unlike the prebuilt binary which includes all plugins by default, the library approach follows a modular design where you only include what you need.

### Required Imports for Full Functionality

To get the complete PocketBase experience similar to the prebuilt binary, you need these imports:

```go
package main

import (
    "log"
    
    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
    
    // Plugin imports - these are NOT automatically included
    "github.com/pocketbase/pocketbase/plugins/jsvm"      // JavaScript/TypeScript support
    "github.com/pocketbase/pocketbase/plugins/migratecmd" // Migration CLI commands  
    "github.com/pocketbase/pocketbase/plugins/tofauth"   // TOF authentication (Tencent)
    
    // System migrations - required for system tables (_jobs, _secrets, etc.)
    _ "github.com/pocketbase/pocketbase/migrations"
)

func main() {
    app := pocketbase.New()
    
    // Register plugins explicitly
    jsvm.MustRegister(app, jsvm.Config{
        MigrationsDir: "./pb_migrations",
        HooksDir:      "./pb_hooks",
    })
    
    migratecmd.MustRegister(app, app.RootCmd, migratecmd.Config{
        TemplateLang: migratecmd.TemplateLangJS,
        Automigrate:  true,
    })
    
    // TOF plugin (only if environment variables are configured)
    if os.Getenv("TOF_APP_TOKEN") != "" {
        tofauth.MustRegister(app, tofauth.Config{
            SafeMode:       tofauth.Bool(true),
            CheckTimestamp: tofauth.Bool(true),
        })
    }
    
    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### Plugin Descriptions

| Plugin | Import Path | Purpose | Required For |
|--------|-------------|---------|--------------|
| **jsvm** | `github.com/pocketbase/pocketbase/plugins/jsvm` | JavaScript/TypeScript runtime for hooks and migrations | JS/TS hooks, JS migrations |
| **migratecmd** | `github.com/pocketbase/pocketbase/plugins/migratecmd` | CLI migration commands and auto-migration | `migrate` command, auto-migrations |
| **tofauth** | `github.com/pocketbase/pocketbase/plugins/tofauth` | Tencent Open Framework authentication | TOF SSO integration |
| **migrations** | `_ "github.com/pocketbase/pocketbase/migrations"` | System table migrations | `_jobs`, `_secrets`, `_kv` tables |

### Why Plugins Are Not Auto-Imported

This modular design provides several benefits:

1. **Smaller Binaries**: Only include dependencies you actually use
2. **Reduced Attack Surface**: Fewer dependencies mean fewer potential vulnerabilities  
3. **Dependency Flexibility**: Avoid version conflicts with existing project dependencies
4. **Conditional Loading**: Enable plugins based on environment or configuration

### Common Plugin Combinations

**Minimal Setup** (REST API + Admin UI only):
```go
import "github.com/pocketbase/pocketbase"
// No additional plugins needed
```

**JavaScript Development** (hooks + migrations):
```go
import (
    "github.com/pocketbase/pocketbase/plugins/jsvm"
    _ "github.com/pocketbase/pocketbase/migrations"
)
```

**Full Featured** (equivalent to prebuilt binary):
```go
import (
    "github.com/pocketbase/pocketbase/plugins/jsvm"
    "github.com/pocketbase/pocketbase/plugins/migratecmd"
    "github.com/pocketbase/pocketbase/plugins/tofauth"
    _ "github.com/pocketbase/pocketbase/migrations"
)
```

### Troubleshooting Missing Features

If you're missing expected functionality:

- **Missing system tables** (`_jobs`, `_secrets`): Add `_ "github.com/pocketbase/pocketbase/migrations"`
- **JS/TS hooks not working**: Add `"github.com/pocketbase/pocketbase/plugins/jsvm"`
- **TOF auth routes 404**: Add `"github.com/pocketbase/pocketbase/plugins/tofauth"` and configure environment variables
- **Migration commands missing**: Add `"github.com/pocketbase/pocketbase/plugins/migratecmd"`

## 开发规范

### UI 设计规范 - 苹果式黑白灰审美

**设计理念**：黑白灰为主基调，保持简洁；在关键交互处使用精致的蓝色点缀，营造苹果式的优雅与细腻。

**核心原则**：
- ✅ 主体使用 `slate` 系列（黑白灰）
- ✅ 交互关键点使用 `blue` 系列（苹果蓝）
- ✅ 精致阴影 + 大圆角 + 细腻动效
- ❌ 避免使用 `purple`、`green`、`emerald`、`amber`、`red` 等其他彩色

**标准色板**：

| 用途 | Tailwind Class | 说明 |
|------|---------------|------|
| 主色调 | `slate-900` | 深黑色，用于文字、图标 |
| **强调色** | `blue-500` | **苹果蓝**，用于激活、交互 |
| 选中背景 | `blue-50` | 极浅蓝背景（精致） |
| 选中文字 | `blue-600` | 蓝色文字，`font-semibold` |
| 未选中文字 | `slate-500/600/700` | 中灰色，按层级递增 |
| 悬停背景 | `slate-50` | 极浅灰 |
| 边框 | `slate-200` | 浅灰边框 |
| 图标 | `slate-400` | 中灰图标 |
| 禁用状态 | `slate-300` | 浅灰禁用 |

**组件状态规范**：

```typescript
// ✅ 选中态（侧边栏菜单、列表项）
className="bg-blue-50 text-blue-600 font-semibold shadow-sm"

// ✅ 未选中态
className="text-slate-600 hover:bg-slate-50 hover:text-slate-900"

// ✅ 激活指示器
className="bg-blue-500"  // 圆点、边条（苹果蓝）

// ✅ 按钮主色
className="bg-blue-500 text-white hover:bg-blue-600 shadow-md shadow-blue-200/50"

// ✅ 标签/徽章
className="bg-slate-100 text-slate-600"
// 选中态
className="bg-blue-100 text-blue-700"

// ✅ 链接/文本按钮
className="text-blue-600 font-semibold hover:underline"

// ❌ 错误示例 - 避免使用其他彩色
className="bg-purple-50 text-purple-600"  // 不要这样
className="hover:bg-green-50"             // 不要这样
className="border-amber-200"              // 不要这样
```

**关键区域统一规范**：

| 区域 | 元素 | 颜色规范 |
|------|------|---------|
| Logo/品牌 | 背景色 | `bg-blue-500`（苹果蓝）|
| 主侧边栏 | 选中态 | `bg-blue-50 text-blue-600` |
| 主侧边栏 | 激活指示条 | `bg-blue-500` |
| 二级侧边栏 | 选中态 | `bg-blue-50 text-blue-600` |
| 列表项 | 激活指示点 | `bg-blue-500` |
| 主按钮 | 背景 | `bg-blue-500 hover:bg-blue-600` |
| 卡片悬停 | 边框 | `hover:border-blue-300 hover:shadow-md` |
| 状态徽章 | 背景 | `bg-slate-100 text-slate-600` |
| 状态徽章（激活）| 背景 | `bg-blue-100 text-blue-700` |
| 链接/文本按钮 | 颜色 | `text-blue-600 font-semibold` |

**圆角与阴影规范**：
- **圆角**：使用 `rounded-xl`（12px）或 `rounded-2xl`（16px），营造柔和流畅感
- **阴影**：在卡片和悬浮元素上使用 `shadow-sm`/`shadow-md`，增加景深
- **按钮阴影**：`shadow-md shadow-blue-200/50`（蓝色投影，50% 透明度）

**对齐规范（苹果式精确对齐）**：

对齐是苹果设计的核心原则之一，所有相邻区域的元素必须严格对齐。

| 规范 | 值 | 说明 |
|------|-----|------|
| **头部高度** | `h-14`（56px） | 所有页面/面板的头部统一高度 |
| **二级侧边栏头部** | `h-14`（56px） | 与主侧边栏 Logo 区域对齐 |
| **内容区头部** | `h-14`（56px） | 与侧边栏头部水平对齐 |
| **头部内边距** | `px-3` 或 `px-4` | 保持一致的水平内边距 |

```typescript
// ✅ 正确：头部高度统一为 h-14
<div className="h-14 px-3 border-b border-slate-200 flex items-center">
  {/* 头部内容 */}
</div>

// ❌ 错误：使用 padding 代替固定高度（会导致不对齐）
<div className="px-4 py-3 border-b border-slate-200">
  {/* 头部内容 */}
</div>

// ❌ 错误：使用不同高度（h-12 与 h-14 不对齐）
<div className="h-12 px-3 border-b border-slate-200">
  {/* 头部内容 */}
</div>
```

**关键对齐检查点**：
1. 主侧边栏 Logo 区域：`h-14`
2. 二级侧边栏（TableExplorer、ChatsView 等）头部：`h-14`
3. 内容区页面（DataSourcesView、AgentsView 等）头部：`h-14`
4. 所有相邻区域的头部必须在同一水平线上

### 测试驱动开发 (TDD)

- 采用测试驱动开发流程，先编写测试再实现功能
- 非界面逻辑的代码行覆盖率必须达到 95% 以上
- 非界面逻辑的分支覆盖率必须达到 95% 以上
- 每个公开 API 必须有对应的单元测试
- 每个用户故事必须有对应的集成测试

### "丰田式"追求

- 优先选择免费或低成本的依赖和工具
- 代码必须高可靠性，关键路径需有错误恢复机制
- 模块设计遵循"即插即用"原则，最小化配置需求
- 避免过度工程，只实现明确需要的功能

### 认知负荷优先 (COGNITIVE First)

- 代码应该易于理解，优先选择简单直接的实现
- 避免使用过于复杂的设计模式或抽象
- 函数和方法应保持单一职责，长度不超过 50 行
- 命名必须清晰表达意图，避免缩写和隐晦命名
- 复杂逻辑必须有清晰的注释说明
- 偏好函数式而非 OOP

## TDD 开发流程（严格执行）

**适用范围**: 所有非 UI 逻辑
**测试文件位置**: 与源文件同目录

```
apps/web/src/features/core/services/
├── duckdb.ts
├── duckdb.test.ts        # ← 测试文件
```

**严格 TDD 流程**:

```
┌─────────────────────────────────────────────────────────────────┐
│  Step 1: 创建测试文件                                            │
│  ├── 创建 xxx.test.ts                                           │
│  ├── 编写测试用例（描述期望行为）                                  │
│  └── 运行测试 → 确认失败（红灯 🔴）                               │
│                                                                 │
│  Step 2: 实现代码                                                │
│  ├── 编写最小实现使测试通过                                       │
│  └── 运行测试 → 确认通过（绿灯 🟢）                               │
│                                                                 │
│  Step 3: 重构                                                    │
│  ├── 优化代码结构                                                │
│  ├── 提取公共逻辑                                                │
│  └── 运行测试 → 保持通过（绿灯 🟢）                               │
└─────────────────────────────────────────────────────────────────┘
```

**禁止行为**:
- ❌ 先写实现代码再补测试
- ❌ 跳过红灯阶段直接写实现
- ❌ 测试和实现同时提交但测试未先运行


## Active Technologies
- Go 1.24.0 (backend), JavaScript/Svelte 4.x (frontend) (001-system-monitoring)
- SQLite (metrics.db - 独立监控数据库) (001-system-monitoring)

## Recent Changes
- 001-system-monitoring: Added Go 1.24.0 (backend), JavaScript/Svelte 4.x (frontend)
