# PocketBase 完整技术指南

> **ALL-IN-ONE 文档** - 涵盖 PocketBase 核心功能与扩展特性，供 LLM 理解全局架构及 Go 项目开发参考。

## 模块导航

| 模块 | 文件 | 描述 |
|------|------|------|
| 架构概览 | [01-architecture.md](./01-architecture.md) | 分层架构、App 接口、设计理念 |
| 快速开始 | [02-quickstart.md](./02-quickstart.md) | 运行方式、默认路由、目录结构 |
| 数据库层 | [03-database.md](./03-database.md) | SQLite/PostgreSQL、双连接池、事务、Query Builder |
| Collections & Records | [04-collections-records.md](./04-collections-records.md) | 集合类型、字段类型、CRUD 操作 |
| 身份验证 | [05-authentication.md](./05-authentication.md) | Token 设计、密码/OTP/OAuth2/MFA 认证 |
| API 规则与过滤器 | [06-api-rules.md](./06-api-rules.md) | 规则类型、过滤器语法、权限控制 |
| 文件存储 | [07-files.md](./07-files.md) | 存储抽象、文件上传/下载、缩略图 |
| 实时订阅 | [08-realtime.md](./08-realtime.md) | SSE 实现、订阅/取消订阅、权限 |
| KV 存储 | [09-kv.md](./09-kv.md) | 类 Redis API、两级缓存、分布式锁、Hash |
| Secrets Manager | [10-secrets.md](./10-secrets.md) | AES-256-GCM 加密、多环境配置 |
| Job Queue | [11-jobs.md](./11-jobs.md) | 持久化队列、延时执行、自动重试 |
| Gateway | [12-gateway.md](./12-gateway.md) | 反向代理、热重载、请求头注入 |
| Analytics | [13-analytics.md](./13-analytics.md) | PV/UV 统计、HyperLogLog、S3 存储 |
| Trace | [14-trace.md](./14-trace.md) | 分布式追踪、W3C Trace Context、Ring Buffer |
| Hook 系统 | [15-hooks.md](./15-hooks.md) | 泛型 Hook、Tagged Hook、常用 Hook 点 |
| 扩展开发 | [16-extending.md](./16-extending.md) | Go/JS 扩展、路由与中间件 |
| 生产部署 | [17-deployment.md](./17-deployment.md) | Systemd、Docker、生产建议 |
| API 速查表 | [18-api-reference.md](./18-api-reference.md) | 核心 API、扩展 API、App 方法速查 |

## 核心架构图

```
┌─────────────────────────────────────────────────────────────┐
│                     CLI Layer (cobra)                        │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                     APIs Layer                               │
│         REST Endpoints + Middlewares + Realtime             │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                     Core Layer                               │
│     App Interface + Models + Hooks + Business Logic         │
│     KV | Secrets | Jobs | Analytics | Trace | Gateway       │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                     Tools Layer                              │
│   Router / Hook / Mailer / Filesystem / Search / Security   │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                     Database Layer                           │
│              SQLite / PostgreSQL (DBAdapter)                │
└─────────────────────────────────────────────────────────────┘
```

## App 接口核心方法

```go
type App interface {
    // 数据库
    DB() *dbx.DB
    ConcurrentDB() *dbx.DB
    NonconcurrentDB() *dbx.DB
    IsPostgres() bool
    
    // CRUD
    Save(model Model) error
    Delete(model Model) error
    FindRecordById(collection any, id string) (*Record, error)
    FindRecordsByFilter(collection any, filter string, ...) ([]*Record, error)
    
    // 扩展服务
    KV() KVStore
    Secrets() SecretsStore
    Jobs() JobStore
    Analytics() *Analytics
    Trace() *Trace
    ProxyManager() *ProxyManager
    
    // Hooks (60+)
    OnRecordCreate(tags ...string) *TaggedHook[*RecordEvent]
    // ...
}
```

## 代码组织

```
project/
├── cmd/                    # CLI 入口
├── core/                   # 核心业务逻辑
│   ├── app.go              # App 接口定义
│   ├── base.go             # App 实现
│   ├── record_model.go     # Record 模型
│   ├── collection_model.go # Collection 模型
│   ├── db_adapter*.go      # 数据库适配器
│   ├── kv_*.go             # KV 存储
│   ├── secrets_*.go        # Secrets 管理
│   ├── job_*.go            # Job Queue
│   ├── analytics_*.go      # Analytics
│   ├── trace_*.go          # Trace
│   └── proxy_*.go          # Gateway
├── apis/                   # HTTP API
├── tools/                  # 工具库
├── forms/                  # 表单处理
├── mails/                  # 邮件模板
├── migrations/             # 数据库迁移
└── plugins/                # 可选插件
```

---

*本文档基于 PocketBase 扩展版源码，版本对应 Go 1.24+。*
