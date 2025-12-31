# CODEBUDDY.md This file provides guidance to CodeBuddy when working with code in this repository.

> **IMPORTANT**: 请总是使用中文来写文档和代码注释
> **关于我**: `/ABOUTME.md`
> **产品设计原则**: `/PRINCIPLES.md`
> **深度总结**: `/SUMMARY.md`
> **完整指南** `/MANUAL.md`
## Build & Development Commands

### Run the Application
```bash
cd examples/base && go run main.go serve
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

- **data.db**: Main application data (collections, records, settings)
- **auxiliary.db**: Logs and temporary data
- Dual connection pools per database: concurrent (read) and nonconcurrent (write)
- Pure Go SQLite driver enables CGO_ENABLED=0 builds

## 开发规范

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


## Active Technologies
- Go 1.24.0 (backend), JavaScript/Svelte 4.x (frontend) (001-system-monitoring)
- SQLite (metrics.db - 独立监控数据库) (001-system-monitoring)

## Recent Changes
- 001-system-monitoring: Added Go 1.24.0 (backend), JavaScript/Svelte 4.x (frontend)
